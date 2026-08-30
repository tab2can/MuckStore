use crate::paths;
use crate::security;
use futures_util::StreamExt;
use std::io::Write;
use std::path::{Path, PathBuf};

pub async fn download_file(
    url: &str,
    dest: &Path,
    expected_sha: Option<&str>,
) -> anyhow::Result<()> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let res = reqwest::Client::builder()
        .user_agent("MuckStore/0.1")
        .build()?
        .get(url)
        .send()
        .await?;
    if !res.status().is_success() {
        anyhow::bail!("download failed {} for {url}", res.status());
    }
    let mut file = std::fs::File::create(dest)?;
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        file.write_all(&chunk?)?;
    }
    file.flush()?;
    if let Some(expected) = expected_sha {
        let actual = security::sha256_file(dest)?;
        if !security::hashes_equal(expected, &actual) {
            let _ = std::fs::remove_file(dest);
            anyhow::bail!("SHA256 mismatch for {}", dest.display());
        }
    }
    Ok(())
}

pub fn extract_zip(zip_path: &Path, dest: &Path) -> anyhow::Result<Vec<String>> {
    std::fs::create_dir_all(dest)?;
    let file = std::fs::File::open(zip_path)?;
    let mut archive = zip::ZipArchive::new(file)?;
    let dest_canon = dunce_canonicalize(dest)?;
    let mut inventory = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        let rel = entry
            .enclosed_name()
            .ok_or_else(|| anyhow::anyhow!("refusing zip entry with illegal path"))?
            .to_path_buf();
        let out = dest.join(&rel);
        let parent_check = if entry.is_dir() {
            out.clone()
        } else {
            out.parent().unwrap_or(dest).to_path_buf()
        };
        let canon_parent = dunce_canonicalize_or_create(&parent_check, dest)?;
        if !canon_parent.starts_with(&dest_canon) {
            anyhow::bail!("zip slip blocked: {}", rel.display());
        }
        if entry.is_dir() {
            std::fs::create_dir_all(&out)?;
            continue;
        }
        if let Some(parent) = out.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut outfile = std::fs::File::create(&out)?;
        std::io::copy(&mut entry, &mut outfile)?;
        inventory.push(rel.to_string_lossy().replace('\\', "/"));
    }
    Ok(inventory)
}

fn dunce_canonicalize(path: &Path) -> anyhow::Result<PathBuf> {
    Ok(std::fs::canonicalize(path)?)
}

fn dunce_canonicalize_or_create(path: &Path, dest: &Path) -> anyhow::Result<PathBuf> {
    std::fs::create_dir_all(path)?;
    match std::fs::canonicalize(path) {
        Ok(p) => Ok(p),
        Err(_) => Ok(dest.to_path_buf()),
    }
}

pub fn copy_tree(from: &Path, to: &Path) -> anyhow::Result<Vec<String>> {
    std::fs::create_dir_all(to)?;
    let mut inventory = Vec::new();
    for entry in walkdir::WalkDir::new(from).into_iter().flatten() {
        let rel = match entry.path().strip_prefix(from) {
            Ok(r) => r,
            Err(_) => continue,
        };
        if rel.as_os_str().is_empty() {
            continue;
        }
        let dest = to.join(rel);
        if entry.file_type().is_dir() {
            std::fs::create_dir_all(&dest)?;
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(entry.path(), &dest)?;
            inventory.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    Ok(inventory)
}

pub fn collect_inventory(root: &Path) -> Vec<String> {
    walkdir::WalkDir::new(root)
        .into_iter()
        .flatten()
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| {
            e.path()
                .strip_prefix(root)
                .ok()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        })
        .collect()
}

pub fn downloads_dir() -> PathBuf {
    paths::cache_dir().join("downloads")
}
