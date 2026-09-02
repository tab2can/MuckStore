use crate::models::ThemePack;
use crate::paths;
use std::path::Path;

const FORBIDDEN: &[&str] = &[
    "javascript:",
    "expression(",
    "@import",
    "url(http",
    "url('http",
    "url(\"http",
    "<script",
    "behavior:",
];

pub fn sanitize_tokens(tokens: &mut std::collections::HashMap<String, String>) -> anyhow::Result<()> {
    for (key, value) in tokens.iter() {
        let lower = value.to_lowercase();
        for bad in FORBIDDEN {
            if lower.contains(bad) {
                anyhow::bail!("theme token '{key}' contains forbidden CSS");
            }
        }
        if key.contains("font") {
            continue;
        }
        if matches!(key.as_str(), "radius" | "radiusSm" | "blur") {
            continue;
        }
        if is_fill_key(key) {
            if !valid_fill(value) {
                anyhow::bail!("theme token '{key}' must be none or a local linear/radial gradient");
            }
            continue;
        }
        if !value.starts_with('#') && !value.starts_with("rgb") {
            anyhow::bail!("theme token '{key}' must be a color or size token");
        }
    }
    Ok(())
}

fn is_fill_key(key: &str) -> bool {
    key.ends_with("Fill")
}

fn valid_fill(value: &str) -> bool {
    let v = value.trim();
    if v.eq_ignore_ascii_case("none") {
        return true;
    }
    let lower = v.to_ascii_lowercase();
    if !(lower.starts_with("linear-gradient(") || lower.starts_with("radial-gradient(")) {
        return false;
    }
    if !v.ends_with(')') {
        return false;
    }
    v.chars().all(|c| {
        c.is_ascii_alphanumeric() || matches!(c, '#' | '(' | ')' | ',' | '.' | '%' | ' ' | '-' | '/')
    })
}

pub fn load_installed_themes() -> Vec<ThemePack> {
    let mut out = Vec::new();
    let dir = paths::themes_dir();
    let Ok(entries) = std::fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(mut pack) = serde_json::from_str::<ThemePack>(&raw) {
                if sanitize_tokens(&mut pack.tokens).is_ok() {
                    out.push(pack);
                }
            }
        }
    }
    out
}

pub fn import_theme_file(path: &Path) -> anyhow::Result<ThemePack> {
    let raw = std::fs::read_to_string(path)?;
    let mut pack: ThemePack = serde_json::from_str(&raw)?;
    sanitize_tokens(&mut pack.tokens)?;
    save_theme_pack(pack)
}

pub fn save_theme_pack(mut pack: ThemePack) -> anyhow::Result<ThemePack> {
    pack.id = pack
        .id
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect();
    pack.id = pack.id.trim_matches('-').to_string();
    if pack.id.is_empty() {
        anyhow::bail!("theme id is empty");
    }
    if pack.name.trim().is_empty() {
        anyhow::bail!("theme name is empty");
    }
    sanitize_tokens(&mut pack.tokens)?;
    std::fs::create_dir_all(paths::themes_dir())?;
    let dest = paths::themes_dir().join(format!("{}.json", pack.id));
    std::fs::write(&dest, serde_json::to_string_pretty(&pack)?)?;
    Ok(pack)
}

pub fn delete_theme_pack(id: &str) -> anyhow::Result<()> {
    let dest = paths::themes_dir().join(format!("{id}.json"));
    if dest.exists() {
        std::fs::remove_file(dest)?;
    }
    Ok(())
}

pub fn bundled_themes(app: &tauri::AppHandle) -> Vec<ThemePack> {
    let dir = crate::paths::resolve_resource(app, "themes");
    let mut out = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(raw) = std::fs::read_to_string(entry.path()) {
                if let Ok(mut pack) = serde_json::from_str::<ThemePack>(&raw) {
                    if sanitize_tokens(&mut pack.tokens).is_ok() {
                        out.push(pack);
                    }
                }
            }
        }
    }
    out
}
