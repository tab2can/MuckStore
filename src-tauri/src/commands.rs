use crate::helper::{self, HelperJob};
use crate::models::{
    AppPaths, CatalogProgram, InstallRequest, InstalledProgram, ProcessStatus, ProgramInstallOptions,
    ProgramRelease, StoreSettings, ThemePack, TrustRecord, UpdateInfo, VerifyReport,
};
use crate::paths;
use crate::settings;
use crate::state::AppState;
use std::path::PathBuf;
use tauri::{AppHandle, State};

fn token(state: &AppState) -> Option<String> {
    state.settings.lock().github_token.clone()
}

fn proxy(state: &AppState) -> Option<String> {
    state.settings.lock().proxy.clone()
}

#[tauri::command]
pub fn get_store_settings(state: State<AppState>) -> StoreSettings {
    state.settings.lock().clone()
}

#[tauri::command]
pub fn save_store_settings(
    app: AppHandle,
    state: State<AppState>,
    settings: StoreSettings,
) -> Result<(), String> {
    crate::settings::save_store_settings(&settings).map_err(|e| e.to_string())?;
    let saved = crate::settings::load_store_settings();
    let tray_on = saved.tray_enabled;
    *state.settings.lock() = saved;
    crate::apply_tray(&app, tray_on).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_app_paths(state: State<AppState>) -> AppPaths {
    let install = state.settings.lock().install_path.clone();
    AppPaths {
        programs: paths::programs_root(install.as_deref())
            .to_string_lossy()
            .into(),
        config: paths::config_dir().to_string_lossy().into(),
        cache: paths::cache_dir().to_string_lossy().into(),
        logs: paths::logs_dir().to_string_lossy().into(),
        themes: paths::themes_dir().to_string_lossy().into(),
        runtimes: paths::runtimes_dir().to_string_lossy().into(),
        data_root: paths::localdata().to_string_lossy().into(),
    }
}

#[tauri::command]
pub fn official_catalog(app: AppHandle) -> Vec<CatalogProgram> {
    crate::catalog::official_catalog(&app)
}

#[tauri::command]
pub fn community_catalog(app: AppHandle) -> Vec<CatalogProgram> {
    crate::catalog::community_samples(&app)
}

#[tauri::command]
pub async fn search_github(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<CatalogProgram>, String> {
    let token = token(&state);
    let proxy = proxy(&state);
    crate::catalog::search_github(&query, token.as_deref(), proxy.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn fetch_github_program(
    state: State<'_, AppState>,
    github: String,
) -> Result<CatalogProgram, String> {
    let token = token(&state);
    let proxy = proxy(&state);
    crate::catalog::fetch_github_program(&github, token.as_deref(), proxy.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_program(app: AppHandle, id: String) -> Result<CatalogProgram, String> {
    crate::catalog::find_local(&app, &id).ok_or_else(|| "program not found".into())
}

#[tauri::command]
pub async fn install_program(
    app: AppHandle,
    state: State<'_, AppState>,
    request: InstallRequest,
) -> Result<InstalledProgram, String> {
    let (token, proxy, install_path, hash_policy) = {
        let s = state.settings.lock();
        (
            s.github_token.clone(),
            s.proxy.clone(),
            s.install_path.clone(),
            s.hash_fail_policy.clone(),
        )
    };
    crate::install::install(
        &app,
        request,
        token.as_deref(),
        proxy.as_deref(),
        install_path.as_deref(),
        &hash_policy,
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn verify_program(
    app: AppHandle,
    state: State<'_, AppState>,
    request: InstallRequest,
) -> Result<VerifyReport, String> {
    let token = token(&state);
    let proxy = proxy(&state);
    crate::verify::verify(&app, &request, token.as_deref(), proxy.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_trust() -> Vec<TrustRecord> {
    crate::trust::list()
}

#[tauri::command]
pub fn revoke_trust(id: String) -> Result<(), String> {
    crate::trust::revoke(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn uninstall_program(id: String, wipe_config: bool) -> Result<(), String> {
    crate::install::uninstall(&id, wipe_config).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rollback_program(id: String) -> Result<(), String> {
    crate::install::rollback(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_installed() -> Vec<InstalledProgram> {
    settings::load_registry().programs.into_values().collect()
}

#[tauri::command]
pub async fn start_program(state: State<'_, AppState>, id: String) -> Result<u32, String> {
    let registry = settings::load_registry();
    let inst = registry
        .programs
        .get(&id)
        .cloned()
        .ok_or_else(|| "not installed".to_string())?;
    let isolation = state.settings.lock().isolation_job_object;
    state
        .processes
        .lock()
        .start(&inst, isolation)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn stop_program(state: State<'_, AppState>, id: String) -> Result<(), String> {
    state.processes.lock().stop(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn restart_program(state: State<'_, AppState>, id: String) -> Result<u32, String> {
    state.processes.lock().stop(&id).map_err(|e| e.to_string())?;
    start_program(state, id).await
}

#[tauri::command]
pub fn program_status(state: State<AppState>, id: String) -> ProcessStatus {
    state.processes.lock().status(&id)
}

#[tauri::command]
pub fn program_logs(id: String) -> String {
    crate::process::read_logs(&id, 400)
}

#[tauri::command]
pub fn get_program_settings(id: String) -> serde_json::Value {
    settings::load_program_settings(&id)
}

#[tauri::command]
pub fn save_program_settings(id: String, value: serde_json::Value) -> Result<(), String> {
    settings::save_program_settings(&id, &value).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_updates(state: State<'_, AppState>) -> Result<Vec<UpdateInfo>, String> {
    let token = token(&state);
    let proxy = proxy(&state);
    let mut items = crate::update::check_program_updates(token.as_deref(), proxy.as_deref())
        .await
        .map_err(|e| e.to_string())?;
    match crate::update::check_store_update(token.as_deref(), proxy.as_deref()).await {
        Ok(store) => items.insert(0, store),
        Err(e) if e.to_string().contains("rate-limited") => return Err(e.to_string()),
        Err(_) => {}
    }
    Ok(items)
}

#[tauri::command]
pub async fn apply_program_update(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    version: Option<String>,
) -> Result<InstalledProgram, String> {
    let registry = settings::load_registry();
    let inst = registry
        .programs
        .get(&id)
        .ok_or_else(|| "not installed".to_string())?;
    let request = InstallRequest {
        github: Some(inst.source_github.clone()),
        local_resource: None,
        id: Some(id),
        trust_accepted: true,
        official: inst.official,
        version,
    };
    install_program(app, state, request).await
}

#[tauri::command]
pub async fn list_program_releases(
    state: State<'_, AppState>,
    id: String,
) -> Result<Vec<ProgramRelease>, String> {
    let registry = settings::load_registry();
    let inst = registry
        .programs
        .get(&id)
        .ok_or_else(|| "not installed".to_string())?;
    crate::catalog::list_releases(
        &inst.source_github,
        token(&state).as_deref(),
        proxy(&state).as_deref(),
    )
    .await
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_program_install_options(options: ProgramInstallOptions) -> Result<InstalledProgram, String> {
    let mut registry = settings::load_registry();
    let inst = registry
        .programs
        .get_mut(&options.id)
        .ok_or_else(|| "not installed".to_string())?;
    if options.autostart != inst.autostart {
        if options.autostart && !inst.manifest.permissions.iter().any(|p| p == "autostart") {
            return Err("program did not declare the autostart permission".into());
        }
        let entry = PathBuf::from(&inst.install_path).join(&inst.manifest.entry);
        helper::run_or_elevate(
            HelperJob {
                action: if options.autostart {
                    "autostart".into()
                } else {
                    "removeAutostart".into()
                },
                path: None,
                target: Some(entry.to_string_lossy().into()),
                args: None,
                name: Some(format!("MuckStore_{}", options.id)),
                working_dir: Some(inst.install_path.clone()),
                expected_sha256: None,
            },
            false,
        )
        .map_err(|e| e.to_string())?;
    }
    inst.pinned_version = options.pinned_version.filter(|v| !v.is_empty());
    inst.launch_args = options.launch_args;
    inst.update_channel = if options.update_channel == "pre" {
        "pre".into()
    } else {
        "stable".into()
    };
    inst.autostart = options.autostart;
    inst.enabled = options.enabled;
    let saved = inst.clone();
    settings::save_registry(&registry).map_err(|e| e.to_string())?;
    Ok(saved)
}

#[tauri::command]
pub fn list_themes(app: AppHandle) -> Vec<ThemePack> {
    let mut themes = crate::theme::bundled_themes(&app);
    themes.extend(crate::theme::load_installed_themes());
    themes
}

#[tauri::command]
pub fn import_theme(path: String) -> Result<ThemePack, String> {
    crate::theme::import_theme_file(&PathBuf::from(path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_theme(pack: ThemePack) -> Result<ThemePack, String> {
    crate::theme::save_theme_pack(pack).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_theme(id: String) -> Result<(), String> {
    crate::theme::delete_theme_pack(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sideload_program(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> Result<InstalledProgram, String> {
    let dev = state.settings.lock().developer_mode;
    crate::install::sideload(&app, &PathBuf::from(path), dev).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    opener_open(&path)
}

fn opener_open(path: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn clear_cache() -> Result<(), String> {
    let dir = paths::cache_dir();
    if dir.exists() {
        std::fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_defender_exclusion(state: State<AppState>) -> Result<(), String> {
    let consent = state.settings.lock().defender_exclusion_consent;
    if !consent {
        return Err("defender exclusion requires explicit consent".into());
    }
    let path = paths::programs_root(state.settings.lock().install_path.as_deref());
    helper::run_or_elevate(
        HelperJob {
            action: "defenderExclusion".into(),
            path: Some(path.to_string_lossy().into()),
            target: None,
            args: None,
            name: None,
            working_dir: None,
            expected_sha256: None,
        },
        true,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_autostart_program(id: String, enabled: bool) -> Result<(), String> {
    let mut registry = settings::load_registry();
    let inst = registry
        .programs
        .get_mut(&id)
        .ok_or_else(|| "not installed".to_string())?;
    if enabled && !inst.manifest.permissions.iter().any(|p| p == "autostart") {
        return Err("program did not declare the autostart permission".into());
    }
    let entry = PathBuf::from(&inst.install_path).join(&inst.manifest.entry);
    helper::run_or_elevate(
        HelperJob {
            action: if enabled {
                "autostart".into()
            } else {
                "removeAutostart".into()
            },
            path: None,
            target: Some(entry.to_string_lossy().into()),
            args: None,
            name: Some(format!("MuckStore_{id}")),
            working_dir: Some(inst.install_path.clone()),
            expected_sha256: None,
        },
        false,
    )
    .map_err(|e| e.to_string())?;
    inst.autostart = enabled;
    settings::save_registry(&registry).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_program_enabled(id: String, enabled: bool) -> Result<(), String> {
    let mut registry = settings::load_registry();
    if let Some(inst) = registry.programs.get_mut(&id) {
        inst.enabled = enabled;
        settings::save_registry(&registry).map_err(|e| e.to_string())
    } else {
        Err("not installed".into())
    }
}

#[tauri::command]
pub fn validate_manifest_path(path: String) -> Result<crate::models::MuckManifest, String> {
    let p = PathBuf::from(&path);
    let file = if p.is_dir() {
        if p.join("muck.json").exists() {
            p.join("muck.json")
        } else {
            p.join(".muck").join("muck.json")
        }
    } else {
        p
    };
    crate::models::MuckManifest::load(&file).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_theme_github(
    state: State<'_, AppState>,
    query: String,
) -> Result<Vec<CatalogProgram>, String> {
    let token = token(&state);
    let proxy = proxy(&state);
    crate::catalog::search_github_topic("muck-theme", &query, token.as_deref(), proxy.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn launch_store_updater(app: AppHandle) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let updater = exe
        .parent()
        .ok_or_else(|| "no install directory".to_string())?
        .join("muck-updater.exe");
    if !updater.exists() {
        return Err("the updater ships with the installed app, not with cargo tauri dev".into());
    }
    std::process::Command::new(updater)
        .spawn()
        .map_err(|e| e.to_string())?;
    app.exit(0);
    Ok(())
}
