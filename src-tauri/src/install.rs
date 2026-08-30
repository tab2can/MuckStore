use crate::archive;
use crate::helper::{self, HelperJob};
use crate::models::{
    CatalogProgram, InstallRequest, InstalledProgram, MuckManifest, ProgressEvent,
};
use crate::paths;
use crate::security;
use crate::settings;
use crate::verify;
use chrono::Utc;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter};

pub async fn install(
    app: &AppHandle,
    request: InstallRequest,
    token: Option<&str>,
    proxy: Option<&str>,
    install_root: Option<&str>,
    hash_fail_policy: &str,
) -> anyhow::Result<InstalledProgram> {
    emit(
        app,
        "prepare",
        5,
        "Resolving program",
        request.id.as_deref().unwrap_or("program"),
    );
    let catalog = resolve_source(app, &request, token, proxy).await?;
    let report = verify::verify(app, &request, token, proxy).await?;
    if report.blocked() {
        anyhow::bail!("verification_blocked");
    }
    let already = crate::trust::is_approved(
        &report.program_id,
        &report.version,
        report.commit_sha.as_deref(),
    );
    if !catalog.official && !request.trust_accepted && !already {
        anyhow::bail!("trust_required");
    }
    let manifest = catalog
        .manifest
        .clone()
        .ok_or_else(|| anyhow::anyhow!("program is missing a valid muck.json"))?;
    if !catalog.official && !request.trust_accepted {
        anyhow::bail!("trust_required");
    }
    let dest = paths::programs_root(install_root)
        .join(&manifest.id)
        .join(&manifest.version);
    std::fs::create_dir_all(dest.parent().unwrap())?;

    let mut previous_path = None;
    if dest.exists() {
        let prev = dest.parent().unwrap().join("previous");
        let _ = std::fs::remove_dir_all(&prev);
        std::fs::rename(&dest, &prev)?;
        previous_path = Some(prev.to_string_lossy().to_string());
    }
    std::fs::create_dir_all(&dest)?;

    emit(app, "fetch", 20, "Fetching payload", &manifest.id);
    let mut inventory = match catalog.local_resource.as_ref() {
        Some(rel) => {
            let src = paths::resolve_resource(app, rel);
            archive::copy_tree(&src, &dest)?
        }
        None => fetch_remote(&manifest, &dest, token, proxy, hash_fail_policy).await?,
    };
    if inventory.is_empty() {
        inventory = archive::collect_inventory(&dest);
    }

    emit(app, "security", 55, "Clearing download marks", &manifest.id);
    let _ = security::strip_motw_tree(&dest);

    emit(app, "runtime", 70, "Preparing runtimes", &manifest.id);
    let resolved = crate::runtime::ensure_runtimes(&manifest.runtimes, &|msg| {
        emit(app, "runtime", 72, &msg, &manifest.id);
    })
    .await?;
    crate::runtime::save_resolved(&dest, &resolved)?;

    let kind = manifest.install.kind.as_str();
    if matches!(kind, "msi" | "nsis" | "inno" | "script") {
        run_declared_installer(&manifest, &dest)?;
    }

    if let Some(script) = &manifest.install.postinstall {
        let script_path = dest.join(script);
        let sha = manifest
            .install
            .postinstall_sha256
            .clone()
            .ok_or_else(|| anyhow::anyhow!("postinstall requires postinstallSha256"))?;
        helper::run_or_elevate(
            HelperJob {
                action: "runPostinstall".into(),
                path: Some(script_path.to_string_lossy().to_string()),
                target: None,
                args: None,
                name: None,
                working_dir: Some(dest.to_string_lossy().to_string()),
                expected_sha256: Some(sha),
            },
            manifest.needs_admin(),
        )?;
    }

    let entry = dest.join(&manifest.entry);
    if !entry.exists() {
        anyhow::bail!("installed payload is missing entry {}", manifest.entry);
    }

    if manifest.install.shortcuts.start_menu {
        create_start_menu_shortcut(&manifest, &entry, &dest)?;
    }
    if manifest.install.shortcuts.desktop {
        create_desktop_shortcut(&manifest, &entry, &dest, manifest.needs_admin())?;
    }

    if let Some(schema) = manifest
        .settings
        .as_ref()
        .and_then(|s| s.schema.as_ref())
    {
        if !paths::program_settings_path(&manifest.id).exists() {
            let defaults = settings::defaults_from_schema(schema);
            settings::save_program_settings(&manifest.id, &defaults)?;
        }
    }

    let installed = InstalledProgram {
        id: manifest.id.clone(),
        version: manifest.version.clone(),
        install_path: dest.to_string_lossy().to_string(),
        official: catalog.official,
        source_github: manifest.source.github.clone(),
        enabled: true,
        autostart: false,
        pinned_version: None,
        update_channel: "stable".into(),
        installed_at: Utc::now().to_rfc3339(),
        manifest,
        inventory,
        previous_path,
    };
    let mut registry = settings::load_registry();
    registry
        .programs
        .insert(installed.id.clone(), installed.clone());
    settings::save_registry(&registry)?;
    let _ = crate::verify::record_approval(&report);
    emit(app, "done", 100, "Installed", &installed.id);
    Ok(installed)
}

async fn resolve_source(
    app: &AppHandle,
    request: &InstallRequest,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<CatalogProgram> {
    if let Some(id) = &request.id {
        if let Some(local) = crate::catalog::find_local(app, id) {
            return Ok(local);
        }
    }
    if let Some(rel) = &request.local_resource {
        let dir = paths::resolve_resource(app, rel);
        let manifest = load_manifest_dir(&dir)?;
        return Ok(CatalogProgram::from_manifest(
            manifest,
            request.official,
            Some(rel.clone()),
        ));
    }
    if let Some(github) = &request.github {
        return crate::catalog::fetch_github_program(github, token, proxy).await;
    }
    anyhow::bail!("install request is missing github, localResource, or id")
}

fn load_manifest_dir(dir: &Path) -> anyhow::Result<MuckManifest> {
    let a = dir.join("muck.json");
    let b = dir.join(".muck").join("muck.json");
    if a.exists() {
        MuckManifest::load(&a)
    } else {
        MuckManifest::load(&b)
    }
}

async fn fetch_remote(
    manifest: &MuckManifest,
    dest: &Path,
    token: Option<&str>,
    proxy: Option<&str>,
    hash_fail_policy: &str,
) -> anyhow::Result<Vec<String>> {
    let asset = manifest
        .install
        .assets
        .iter()
        .find(|a| a.platform == "windows-x64" || a.platform == "any")
        .cloned();
    let release = crate::catalog::latest_release(
        &manifest.source.github,
        token,
        proxy,
        manifest
            .update
            .as_ref()
            .and_then(|u| u.include_prerelease)
            .unwrap_or(false),
    )
    .await?;
    let (url, sha, file_name) = if let Some(asset) = asset {
        let url = if let Some(url) = asset.url.clone() {
            url
        } else {
            let rel = release
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("no GitHub release found"))?;
            rel.2
                .iter()
                .find(|(name, _)| name == &asset.file)
                .map(|(_, u)| u.clone())
                .ok_or_else(|| anyhow::anyhow!("release is missing asset {}", asset.file))?
        };
        (url, Some(asset.sha256), asset.file)
    } else {
        anyhow::bail!("remote install requires install.assets with sha256");
    };

    let zip_path = archive::downloads_dir().join(&file_name);
    let attested = manifest.requires_github_actions_attestation();
    match archive::download_file(&url, &zip_path, sha.as_deref()).await {
        Ok(()) => {}
        Err(e)
            if !attested && hash_fail_policy == "warn" && e.to_string().contains("SHA256") => {}
        Err(e) => return Err(e),
    };
    if attested {
        let expected = sha
            .as_deref()
            .ok_or_else(|| anyhow::anyhow!("attested install requires sha256"))?
            .to_lowercase();
        let actual = security::sha256_file(&zip_path)?;
        if actual != expected {
            anyhow::bail!("downloaded bytes do not match the attested SHA-256");
        }
        let workflow = manifest
            .build
            .as_ref()
            .map(|b| b.workflow.as_str())
            .unwrap_or("");
        crate::attest::verify_digest(
            &manifest.source.github,
            &actual,
            &file_name,
            workflow,
            token,
            proxy,
        )
        .await?;
    }
    security::strip_motw(&zip_path)?;
    let kind = manifest.install.kind.as_str();
    if matches!(kind, "archive" | "portable" | "runtime")
        && file_name.to_ascii_lowercase().ends_with(".zip")
    {
        archive::extract_zip(&zip_path, dest)
    } else {
        let dest_file = dest.join(&file_name);
        std::fs::copy(&zip_path, &dest_file)?;
        Ok(vec![file_name])
    }
}

fn run_declared_installer(manifest: &MuckManifest, dest: &Path) -> anyhow::Result<()> {
    let asset = manifest
        .install
        .assets
        .iter()
        .find(|a| a.platform == "windows-x64" || a.platform == "any")
        .ok_or_else(|| anyhow::anyhow!("installer asset missing"))?;
    let setup = dest.join(&asset.file);
    if !setup.exists() {
        anyhow::bail!("installer file missing: {}", asset.file);
    }
    let action = match manifest.install.kind.as_str() {
        "msi" => "installMsi",
        "nsis" => "installNsis",
        "inno" => "installInno",
        _ => return Ok(()),
    };
    helper::run_or_elevate(
        HelperJob {
            action: action.into(),
            path: Some(setup.to_string_lossy().to_string()),
            target: Some(dest.to_string_lossy().to_string()),
            args: manifest
                .install
                .silent_args
                .clone()
                .or_else(|| manifest.install.installdir_property.clone()),
            name: None,
            working_dir: Some(dest.to_string_lossy().to_string()),
            expected_sha256: Some(asset.sha256.clone()),
        },
        manifest.needs_admin() || matches!(action, "installMsi"),
    )
}

fn create_start_menu_shortcut(
    manifest: &MuckManifest,
    entry: &Path,
    work: &Path,
) -> anyhow::Result<()> {
    let dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Microsoft/Windows/Start Menu/Programs/Muck Store");
    std::fs::create_dir_all(&dir)?;
    let lnk = dir.join(format!("{}.lnk", sanitize_name(&manifest.name)));
    helper::run_or_elevate(
        HelperJob {
            action: "shortcut".into(),
            path: Some(lnk.to_string_lossy().to_string()),
            target: Some(shortcut_exe(entry)),
            args: shortcut_args(entry),
            name: None,
            working_dir: Some(work.to_string_lossy().to_string()),
            expected_sha256: None,
        },
        false,
    )
}

fn create_desktop_shortcut(
    manifest: &MuckManifest,
    entry: &Path,
    work: &Path,
    admin: bool,
) -> anyhow::Result<()> {
    let desktop = dirs::desktop_dir().unwrap_or_else(|| PathBuf::from("."));
    let lnk = desktop.join(format!("{}.lnk", sanitize_name(&manifest.name)));
    helper::run_or_elevate(
        HelperJob {
            action: "shortcut".into(),
            path: Some(lnk.to_string_lossy().to_string()),
            target: Some(shortcut_exe(entry)),
            args: shortcut_args(entry),
            name: None,
            working_dir: Some(work.to_string_lossy().to_string()),
            expected_sha256: None,
        },
        admin,
    )
}

fn shortcut_exe(entry: &Path) -> String {
    if is_powershell_script(entry) {
        let root = std::env::var("SystemRoot").unwrap_or_else(|_| r"C:\Windows".into());
        format!(r"{root}\System32\WindowsPowerShell\v1.0\powershell.exe")
    } else {
        entry.to_string_lossy().to_string()
    }
}

fn shortcut_args(entry: &Path) -> Option<String> {
    if is_powershell_script(entry) {
        Some(format!(
            "-NoProfile -ExecutionPolicy Bypass -File \"{}\"",
            entry.display()
        ))
    } else {
        None
    }
}

fn is_powershell_script(entry: &Path) -> bool {
    entry
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.eq_ignore_ascii_case("ps1"))
        .unwrap_or(false)
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| if r#"<>:"/\|?*"#.contains(c) { '-' } else { c })
        .collect()
}

pub fn uninstall(id: &str, wipe_config: bool) -> anyhow::Result<()> {
    let mut registry = settings::load_registry();
    let Some(inst) = registry.programs.remove(id) else {
        anyhow::bail!("program is not installed");
    };
    let _ = std::fs::remove_dir_all(&inst.install_path);
    if let Some(prev) = inst.previous_path {
        let _ = std::fs::remove_dir_all(prev);
    }
    let start = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Microsoft/Windows/Start Menu/Programs/Muck Store")
        .join(format!("{}.lnk", sanitize_name(&inst.manifest.name)));
    let _ = std::fs::remove_file(start);
    if wipe_config {
        settings::wipe_program_settings(id);
    }
    let _ = helper::run_or_elevate(
        HelperJob {
            action: "removeAutostart".into(),
            path: None,
            target: None,
            args: None,
            name: Some(format!("MuckStore_{id}")),
            working_dir: None,
            expected_sha256: None,
        },
        false,
    );
    settings::save_registry(&registry)?;
    Ok(())
}

pub fn rollback(id: &str) -> anyhow::Result<()> {
    let mut registry = settings::load_registry();
    let inst = registry
        .programs
        .get_mut(id)
        .ok_or_else(|| anyhow::anyhow!("not installed"))?;
    let Some(prev) = inst.previous_path.clone() else {
        anyhow::bail!("no previous version to restore");
    };
    let current = PathBuf::from(&inst.install_path);
    let failed = current.parent().unwrap().join("failed");
    let _ = std::fs::remove_dir_all(&failed);
    if current.exists() {
        std::fs::rename(&current, &failed)?;
    }
    std::fs::rename(&prev, &current)?;
    inst.previous_path = None;
    settings::save_registry(&registry)?;
    Ok(())
}

fn emit(app: &AppHandle, stage: &str, percent: u8, message: &str, id: &str) {
    let _ = app.emit(
        "install-progress",
        ProgressEvent {
            id: id.into(),
            stage: stage.into(),
            percent,
            message: message.into(),
        },
    );
}

pub fn sideload(app: &AppHandle, folder: &Path, developer_mode: bool) -> anyhow::Result<InstalledProgram> {
    if !developer_mode {
        anyhow::bail!("sideload requires developer mode");
    }
    let manifest = load_manifest_dir(folder)?;
    let dest = paths::programs_root(None)
        .join(&manifest.id)
        .join(&manifest.version);
    std::fs::create_dir_all(&dest)?;
    let inventory = archive::copy_tree(folder, &dest)?;
    if let Some(schema) = manifest.settings.as_ref().and_then(|s| s.schema.as_ref()) {
        if !paths::program_settings_path(&manifest.id).exists() {
            settings::save_program_settings(&manifest.id, &settings::defaults_from_schema(schema))?;
        }
    }
    let installed = InstalledProgram {
        id: manifest.id.clone(),
        version: manifest.version.clone(),
        install_path: dest.to_string_lossy().to_string(),
        official: false,
        source_github: manifest.source.github.clone(),
        enabled: true,
        autostart: false,
        pinned_version: None,
        update_channel: "stable".into(),
        installed_at: Utc::now().to_rfc3339(),
        manifest,
        inventory,
        previous_path: None,
    };
    let mut registry = settings::load_registry();
    registry
        .programs
        .insert(installed.id.clone(), installed.clone());
    settings::save_registry(&registry)?;
    let _ = app;
    Ok(installed)
}
