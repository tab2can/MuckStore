use crate::models::{InstalledRegistry, StoreSettings};
use crate::paths;

pub fn load_store_settings() -> StoreSettings {
    let path = paths::settings_path();
    let mut settings: StoreSettings = match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => return StoreSettings::default(),
    };
    if settings.prefs_revision < 1 {
        if settings.language == "en" {
            settings.language = "system".into();
        }
        if settings.theme_id == "midnight" {
            settings.theme_id = "system".into();
        }
        settings.prefs_revision = 1;
        let _ = save_store_settings(&settings);
    }
    let needs_policy = settings.store_update_policy.is_empty()
        || settings.program_update_policy.is_empty();
    migrate_update_policies(&mut settings);
    if needs_policy {
        let _ = write_store_settings(&settings);
    }
    settings
}

fn migrate_update_policies(settings: &mut StoreSettings) {
    if settings.store_update_policy.is_empty() {
        settings.store_update_policy = if settings.auto_update_store {
            "startup".into()
        } else {
            "manual".into()
        };
    }
    if settings.program_update_policy.is_empty() {
        settings.program_update_policy = match settings.auto_update_programs.as_str() {
            "auto" => "auto".into(),
            "off" => "manual".into(),
            _ => "startup".into(),
        };
    }
    settings.auto_update_store = settings.store_update_policy != "manual";
    settings.auto_update_programs = match settings.program_update_policy.as_str() {
        "auto" => "auto".into(),
        "manual" => "off".into(),
        _ => "notify".into(),
    };
}

pub fn save_store_settings(settings: &StoreSettings) -> anyhow::Result<()> {
    let mut settings = settings.clone();
    migrate_update_policies(&mut settings);
    write_store_settings(&settings)
}

fn write_store_settings(settings: &StoreSettings) -> anyhow::Result<()> {
    paths::ensure_dirs(settings.install_path.as_deref())?;
    let path = paths::settings_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(settings)?)?;
    Ok(())
}

pub fn load_registry() -> InstalledRegistry {
    match std::fs::read_to_string(paths::registry_path()) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => InstalledRegistry::default(),
    }
}

pub fn save_registry(reg: &InstalledRegistry) -> anyhow::Result<()> {
    let path = paths::registry_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(reg)?)?;
    Ok(())
}

pub fn load_program_settings(id: &str) -> serde_json::Value {
    let path = paths::program_settings_path(id);
    match std::fs::read_to_string(path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or(serde_json::json!({})),
        Err(_) => serde_json::json!({}),
    }
}

pub fn save_program_settings(id: &str, value: &serde_json::Value) -> anyhow::Result<()> {
    std::fs::create_dir_all(paths::config_dir())?;
    std::fs::write(
        paths::program_settings_path(id),
        serde_json::to_string_pretty(value)?,
    )?;
    Ok(())
}

pub fn defaults_from_schema(schema: &serde_json::Value) -> serde_json::Value {
    let mut out = serde_json::Map::new();
    if let Some(props) = schema.get("properties").and_then(|p| p.as_object()) {
        for (key, prop) in props {
            if let Some(default) = prop.get("default") {
                out.insert(key.clone(), default.clone());
            } else if let Some(ty) = prop.get("type").and_then(|t| t.as_str()) {
                let v = match ty {
                    "boolean" => serde_json::Value::Bool(false),
                    "number" | "integer" => serde_json::json!(0),
                    "array" => serde_json::json!([]),
                    _ => serde_json::Value::String(String::new()),
                };
                out.insert(key.clone(), v);
            }
        }
    }
    serde_json::Value::Object(out)
}

pub fn wipe_program_settings(id: &str) {
    let _ = std::fs::remove_file(paths::program_settings_path(id));
}

