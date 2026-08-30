use sha2::{Digest, Sha256};
use std::path::Path;

pub fn sha256_file(path: &Path) -> anyhow::Result<String> {
    let bytes = std::fs::read(path)?;
    Ok(sha256_bytes(&bytes))
}

pub fn sha256_bytes(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    hex::encode(hasher.finalize())
}

pub fn hashes_equal(expected: &str, actual: &str) -> bool {
    expected.eq_ignore_ascii_case(actual)
}

/// Removes the Windows Mark-of-the-Web alternate data stream after the user
/// confirmed the download. Never call this before trust acceptance.
pub fn strip_motw(path: &Path) -> anyhow::Result<()> {
    #[cfg(windows)]
    {
        let ads = format!("{}:Zone.Identifier", path.display());
        match std::fs::remove_file(&ads) {
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
    }
    Ok(())
}

pub fn strip_motw_tree(root: &Path) -> anyhow::Result<()> {
    if root.is_file() {
        strip_motw(root)?;
        return Ok(());
    }
    for entry in walkdir::WalkDir::new(root).into_iter().flatten() {
        if entry.file_type().is_file() {
            let _ = strip_motw(entry.path());
        }
    }
    Ok(())
}

pub fn is_quiet_hours(start: Option<&str>, end: Option<&str>) -> bool {
    let (Some(s), Some(e)) = (start, end) else {
        return false;
    };
    let now = chrono::Local::now().format("%H:%M").to_string();
    if s <= e {
        now >= s.to_string() && now <= e.to_string()
    } else {
        now >= s.to_string() || now <= e.to_string()
    }
}
