use crate::models::TrustRecord;
use crate::paths;
use std::collections::HashMap;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TrustStore {
    #[serde(default)]
    pub records: HashMap<String, TrustRecord>,
}

pub fn path() -> std::path::PathBuf {
    paths::appdata().join("trust.json")
}

pub fn load() -> TrustStore {
    match std::fs::read_to_string(path()) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => TrustStore::default(),
    }
}

pub fn save(store: &TrustStore) -> anyhow::Result<()> {
    std::fs::create_dir_all(paths::appdata())?;
    std::fs::write(path(), serde_json::to_string_pretty(store)?)?;
    Ok(())
}

pub fn get(id: &str) -> Option<TrustRecord> {
    load().records.get(id).cloned()
}

pub fn is_approved(id: &str, version: &str, commit_sha: Option<&str>) -> bool {
    let Some(rec) = get(id) else {
        return false;
    };
    if rec.version != version {
        return false;
    }
    match (commit_sha, rec.commit_sha.as_deref()) {
        (Some(a), Some(b)) => a.eq_ignore_ascii_case(b),
        (None, None) => true,
        (None, Some(_)) if rec.official => true,
        _ => rec.official && rec.version == version,
    }
}

pub fn record(entry: TrustRecord) -> anyhow::Result<()> {
    let mut store = load();
    store.records.insert(entry.id.clone(), entry);
    save(&store)
}

pub fn revoke(id: &str) -> anyhow::Result<()> {
    let mut store = load();
    store.records.remove(id);
    save(&store)
}

pub fn list() -> Vec<TrustRecord> {
    load().records.into_values().collect()
}
