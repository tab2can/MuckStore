use std::path::PathBuf;
use tauri::{AppHandle, Manager};

pub fn workspace_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

pub fn resolve_resource(app: &AppHandle, rel: &str) -> PathBuf {
    if let Ok(dir) = app.path().resource_dir() {
        let bundled = dir.join(rel);
        if bundled.exists() {
            return bundled;
        }
        let nested = dir.join("_up_").join(rel);
        if nested.exists() {
            return nested;
        }
    }
    workspace_root().join(rel)
}

pub fn appdata() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("MuckStore")
}

pub fn localdata() -> PathBuf {
    dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("MuckStore")
}

pub fn programs_root(custom: Option<&str>) -> PathBuf {
    if let Some(p) = custom {
        if !p.trim().is_empty() {
            return PathBuf::from(p);
        }
    }
    localdata().join("programs")
}

pub fn config_dir() -> PathBuf {
    appdata().join("config")
}

pub fn cache_dir() -> PathBuf {
    localdata().join("cache")
}

pub fn runtimes_dir() -> PathBuf {
    localdata().join("runtimes")
}

pub fn logs_dir() -> PathBuf {
    localdata().join("logs")
}

pub fn themes_dir() -> PathBuf {
    appdata().join("themes")
}

pub fn settings_path() -> PathBuf {
    appdata().join("store-settings.json")
}

pub fn registry_path() -> PathBuf {
    appdata().join("installed.json")
}

pub fn program_settings_path(id: &str) -> PathBuf {
    config_dir().join(format!("{id}.json"))
}

pub fn ensure_dirs(custom_install: Option<&str>) -> std::io::Result<()> {
    for d in [
        appdata(),
        localdata(),
        config_dir(),
        cache_dir(),
        runtimes_dir(),
        logs_dir(),
        themes_dir(),
        programs_root(custom_install),
        cache_dir().join("github"),
        cache_dir().join("downloads"),
    ] {
        std::fs::create_dir_all(d)?;
    }
    Ok(())
}
