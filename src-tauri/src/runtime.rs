use crate::models::RuntimeSpec;
use crate::paths;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedRuntime {
    pub id: String,
    pub bin: PathBuf,
    pub extra_path: Option<PathBuf>,
}

pub async fn ensure_runtimes(
    runtimes: &[RuntimeSpec],
    on_progress: &impl Fn(String),
) -> anyhow::Result<Vec<ResolvedRuntime>> {
    let mut out = Vec::new();
    for spec in runtimes {
        on_progress(format!("runtime {}", spec.id));
        match spec.id.as_str() {
            "python" => out.push(ensure_python(spec).await?),
            "node" => out.push(ensure_node(spec).await?),
            "dotnet" => out.push(ensure_dotnet(spec)?),
            other => anyhow::bail!("unsupported runtime: {other}"),
        }
    }
    Ok(out)
}

fn find_on_path(names: &[&str]) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path) {
        for name in names {
            let candidate = dir.join(name);
            if candidate.exists() {
                return Some(candidate);
            }
            #[cfg(windows)]
            {
                let exe = dir.join(format!("{name}.exe"));
                if exe.exists() {
                    return Some(exe);
                }
            }
        }
    }
    None
}

async fn ensure_python(spec: &RuntimeSpec) -> anyhow::Result<ResolvedRuntime> {
    let strategy = spec.strategy.as_deref().unwrap_or("system");
    if strategy != "download" {
        if let Some(bin) = find_on_path(&["python", "python3"]) {
            return Ok(ResolvedRuntime {
                id: spec.id.clone(),
                bin,
                extra_path: None,
            });
        }
        if strategy == "system" {
            anyhow::bail!("Python was not found on PATH. Install Python or set runtime strategy to download.");
        }
    }
    let version = spec.version.as_deref().unwrap_or("3.12.7");
    let dest = paths::runtimes_dir().join("python").join(version);
    let exe = dest.join("python.exe");
    if exe.exists() {
        return Ok(ResolvedRuntime {
            id: spec.id.clone(),
            bin: exe,
            extra_path: Some(dest),
        });
    }
    std::fs::create_dir_all(&dest)?;
    let url = format!("https://www.python.org/ftp/python/{version}/python-{version}-embed-amd64.zip");
    let zip_path = paths::cache_dir()
        .join("downloads")
        .join(format!("python-{version}-embed-amd64.zip"));
    crate::archive::download_file(&url, &zip_path, None).await?;
    crate::archive::extract_zip(&zip_path, &dest)?;
    if !exe.exists() {
        anyhow::bail!("Python embeddable extract did not produce python.exe");
    }
    Ok(ResolvedRuntime {
        id: spec.id.clone(),
        bin: exe,
        extra_path: Some(dest),
    })
}

async fn ensure_node(spec: &RuntimeSpec) -> anyhow::Result<ResolvedRuntime> {
    let strategy = spec.strategy.as_deref().unwrap_or("system");
    if strategy != "download" {
        if let Some(bin) = find_on_path(&["node"]) {
            return Ok(ResolvedRuntime {
                id: spec.id.clone(),
                bin,
                extra_path: None,
            });
        }
        if strategy == "system" {
            anyhow::bail!("Node.js was not found on PATH. Install Node or set runtime strategy to download.");
        }
    }
    let version = spec.version.as_deref().unwrap_or("20.18.1");
    let dest = paths::runtimes_dir().join("node").join(version);
    let exe = dest.join("node.exe");
    if exe.exists() {
        return Ok(ResolvedRuntime {
            id: spec.id.clone(),
            bin: exe,
            extra_path: Some(dest),
        });
    }
    std::fs::create_dir_all(&dest)?;
    let folder = format!("node-v{version}-win-x64");
    let url = format!("https://nodejs.org/dist/v{version}/{folder}.zip");
    let zip_path = paths::cache_dir()
        .join("downloads")
        .join(format!("{folder}.zip"));
    crate::archive::download_file(&url, &zip_path, None).await?;
    let tmp = dest.join("_extract");
    crate::archive::extract_zip(&zip_path, &tmp)?;
    let inner = tmp.join(&folder);
    if inner.exists() {
        copy_dir(&inner, &dest)?;
    } else {
        copy_dir(&tmp, &dest)?;
    }
    let _ = std::fs::remove_dir_all(&tmp);
    if !exe.exists() {
        anyhow::bail!("Node extract did not produce node.exe");
    }
    Ok(ResolvedRuntime {
        id: spec.id.clone(),
        bin: exe,
        extra_path: Some(dest),
    })
}

fn ensure_dotnet(spec: &RuntimeSpec) -> anyhow::Result<ResolvedRuntime> {
    if let Some(bin) = find_on_path(&["dotnet"]) {
        return Ok(ResolvedRuntime {
            id: spec.id.clone(),
            bin,
            extra_path: None,
        });
    }
    anyhow::bail!(
        "dotnet was not found on PATH. Muck Store will not download the full .NET SDK automatically (too large). Install .NET {} from https://dot.net",
        spec.version.as_deref().unwrap_or("8")
    )
}

pub fn copy_dir(from: &Path, to: &Path) -> anyhow::Result<()> {
    std::fs::create_dir_all(to)?;
    let mut options = fs_extra::dir::CopyOptions::new();
    options.overwrite = true;
    options.copy_inside = true;
    fs_extra::dir::copy(from, to, &options)?;
    Ok(())
}

pub fn save_resolved(dest: &Path, runtimes: &[ResolvedRuntime]) -> anyhow::Result<()> {
    std::fs::write(dest.join(".muck-runtime.json"), serde_json::to_vec_pretty(runtimes)?)?;
    Ok(())
}

pub fn load_resolved(dest: &Path) -> Vec<ResolvedRuntime> {
    std::fs::read_to_string(dest.join(".muck-runtime.json"))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}
