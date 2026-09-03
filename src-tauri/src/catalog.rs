use crate::models::{CatalogProgram, MuckManifest, ProgramRelease};
use crate::paths;
use crate::settings;
use serde::Deserialize;
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
struct OfficialIndex {
    #[serde(default)]
    programs: Vec<IndexEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct IndexEntry {
    id: String,
    #[serde(default)]
    official: bool,
    #[serde(default)]
    featured: bool,
    #[serde(default)]
    local_resource: Option<String>,
    #[serde(default)]
    stars: Option<u64>,
    #[serde(default)]
    forks: Option<u64>,
    #[serde(default)]
    language: Option<String>,
}

pub fn load_index(app: &AppHandle, file: &str, official: bool) -> Vec<CatalogProgram> {
    let path = paths::resolve_resource(app, file);
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    let Ok(index) = serde_json::from_str::<OfficialIndex>(&raw) else {
        return Vec::new();
    };
    let registry = settings::load_registry();
    let mut out = Vec::new();
    for entry in index.programs {
        let Some(rel) = entry.local_resource.clone() else {
            continue;
        };
        let dir = paths::resolve_resource(app, &rel);
        let manifest_path = if dir.join("muck.json").exists() {
            dir.join("muck.json")
        } else {
            dir.join(".muck").join("muck.json")
        };
        let Ok(manifest) = MuckManifest::load(&manifest_path) else {
            continue;
        };
        let mut program = CatalogProgram::from_manifest(manifest, official || entry.official, Some(rel));
        program.featured = entry.featured;
        program.id = entry.id;
        program.stars = entry.stars.or(program.stars);
        program.forks = entry.forks.or(program.forks);
        program.language = entry.language.or(program.language);
        if let Ok(readme) = std::fs::read_to_string(dir.join("README.md")) {
            program.readme = Some(readme);
        }
        if let Some(inst) = registry.programs.get(&program.id) {
            program.installed = true;
            program.installed_version = Some(inst.version.clone());
        }
        out.push(program);
    }
    out
}

pub fn official_catalog(app: &AppHandle) -> Vec<CatalogProgram> {
    load_index(app, "catalog/official.json", true)
}

pub fn community_samples(app: &AppHandle) -> Vec<CatalogProgram> {
    load_index(app, "catalog/community.json", false)
}

pub fn find_local(app: &AppHandle, id: &str) -> Option<CatalogProgram> {
    official_catalog(app)
        .into_iter()
        .chain(community_samples(app))
        .find(|p| p.id == id)
}

#[derive(Debug, Deserialize)]
struct GithubRepo {
    full_name: String,
    description: Option<String>,
    stargazers_count: u64,
    #[serde(default)]
    forks_count: u64,
    #[serde(default)]
    language: Option<String>,
    updated_at: Option<String>,
    default_branch: Option<String>,
    html_url: String,
    owner: GithubOwner,
    license: Option<GithubLicense>,
    #[serde(default)]
    private: bool,
    #[serde(default)]
    archived: bool,
    #[serde(default)]
    fork: bool,
}

#[derive(Debug, Deserialize)]
struct GithubOwner {
    login: String,
    avatar_url: String,
}

#[derive(Debug, Deserialize)]
struct GithubLicense {
    spdx_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    items: Vec<GithubRepo>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    body: Option<String>,
    prerelease: bool,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

fn client(token: Option<&str>, proxy: Option<&str>) -> anyhow::Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .user_agent("MuckStore/0.1 (+https://github.com/muckstore/muck-store)")
        .gzip(true);
    if let Some(p) = proxy {
        if !p.is_empty() {
            builder = builder.proxy(reqwest::Proxy::all(p)?);
        }
    }
    let built = builder.build()?;
    let _ = token;
    Ok(built)
}

fn apply_auth(req: reqwest::RequestBuilder, token: Option<&str>) -> reqwest::RequestBuilder {
    match token {
        Some(t) if !t.is_empty() => req.bearer_auth(t),
        _ => req,
    }
}

async fn cached_get(
    http: &reqwest::Client,
    url: &str,
    token: Option<&str>,
) -> anyhow::Result<String> {
    let key = crate::security::sha256_bytes(url.as_bytes());
    let cache_file = paths::cache_dir().join("github").join(format!("{key}.json"));
    if let Ok(meta) = std::fs::metadata(&cache_file) {
        if let Ok(modified) = meta.modified() {
            if modified.elapsed().map(|d| d.as_secs() < 600).unwrap_or(false) {
                if let Ok(raw) = std::fs::read_to_string(&cache_file) {
                    return Ok(raw);
                }
            }
        }
    }
    let req = apply_auth(http.get(url), token);
    let res = req.send().await?;
    let status = res.status().as_u16();
    let remaining = res
        .headers()
        .get("x-ratelimit-remaining")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    if status == 429 || (status == 403 && remaining == "0") {
        anyhow::bail!("rate-limited");
    }
    if !res.status().is_success() {
        anyhow::bail!("GitHub request failed: {} {url}", res.status());
    }
    let text = res.text().await?;
    let _ = std::fs::create_dir_all(cache_file.parent().unwrap());
    let _ = std::fs::write(&cache_file, &text);
    Ok(text)
}

pub async fn github_json(
    url: &str,
    token: Option<&str>,
    proxy: Option<&str>,
    cache_secs: u64,
) -> anyhow::Result<(u16, String)> {
    if cache_secs > 0 {
        let key = crate::security::sha256_bytes(url.as_bytes());
        let cache_file = paths::cache_dir().join("github").join(format!("{key}.json"));
        if let Ok(meta) = std::fs::metadata(&cache_file) {
            if let Ok(modified) = meta.modified() {
                if modified.elapsed().map(|d| d.as_secs() < cache_secs).unwrap_or(false) {
                    if let Ok(raw) = std::fs::read_to_string(&cache_file) {
                        return Ok((200, raw));
                    }
                }
            }
        }
    }
    let http = client(token, proxy)?;
    let res = apply_auth(http.get(url), token)
        .header("X-GitHub-Api-Version", "2022-11-28")
        .header("Accept", "application/vnd.github+json")
        .send()
        .await?;
    let status = res.status().as_u16();
    let remaining = res
        .headers()
        .get("x-ratelimit-remaining")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();
    let text = res.text().await?;
    if status == 429 || (status == 403 && remaining == "0") {
        anyhow::bail!("rate-limited");
    }
    if status == 200 && cache_secs > 0 {
        let key = crate::security::sha256_bytes(url.as_bytes());
        let cache_file = paths::cache_dir().join("github").join(format!("{key}.json"));
        let _ = std::fs::create_dir_all(cache_file.parent().unwrap());
        let _ = std::fs::write(&cache_file, &text);
    }
    Ok((status, text))
}

pub async fn fetch_github_program(
    github: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<CatalogProgram> {
    let github = github.trim().trim_end_matches('/').replace("https://github.com/", "");
    let (owner, repo) = github
        .split_once('/')
        .ok_or_else(|| anyhow::anyhow!("expected owner/repo"))?;
    let http = client(token, proxy)?;
    let repo_url = format!("https://api.github.com/repos/{owner}/{repo}");
    let repo_raw = cached_get(&http, &repo_url, token).await?;
    let repo_info: GithubRepo = serde_json::from_str(&repo_raw)?;
    let branch = repo_info.default_branch.clone().unwrap_or_else(|| "main".into());
    let mut manifest_raw = fetch_raw(&http, owner, repo, &branch, "muck.json", token).await;
    if manifest_raw.is_err() {
        manifest_raw = fetch_raw(&http, owner, repo, &branch, ".muck/muck.json", token).await;
    }
    let manifest: MuckManifest = serde_json::from_str(&manifest_raw?)?;
    manifest.validate()?;
    if repo_info.private {
        anyhow::bail!("repository is private — Muck Store only installs public GitHub sources");
    }
    let mut program = CatalogProgram::from_manifest(manifest, false, None);
    program.stars = Some(repo_info.stargazers_count);
    program.forks = Some(repo_info.forks_count);
    if program.language.is_none() {
        program.language = repo_info.language.clone();
    }
    program.updated_at = repo_info.updated_at;
    program.owner_avatar = Some(repo_info.owner.avatar_url);
    program.archived = repo_info.archived;
    program.html_url = Some(repo_info.html_url.clone());
    if let Ok(sha) = commit_sha(&http, owner, repo, &branch, token).await {
        program.commit_sha = Some(sha);
    }
    if program.license.is_empty() {
        program.license = repo_info
            .license
            .and_then(|l| l.spdx_id)
            .unwrap_or_else(|| "UNKNOWN".into());
    }
    if program.description.is_none() {
        program.description = repo_info.description;
    }
    if let Ok(readme) = fetch_raw(&http, owner, repo, &branch, "README.md", token).await {
        program.readme = Some(readme);
    }
    let _ = repo_info.html_url;
    let _ = repo_info.full_name;
    let _ = repo_info.owner.login;
    let registry = settings::load_registry();
    if let Some(inst) = registry.programs.get(&program.id) {
        program.installed = true;
        program.installed_version = Some(inst.version.clone());
    }
    Ok(program)
}

async fn fetch_raw(
    http: &reqwest::Client,
    owner: &str,
    repo: &str,
    branch: &str,
    file: &str,
    token: Option<&str>,
) -> anyhow::Result<String> {
    let url = format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{file}");
    cached_get(http, &url, token).await
}

#[derive(Debug, Clone)]
pub struct GithubFacts {
    pub full_name: String,
    pub private: bool,
    pub archived: bool,
    pub fork: bool,
    pub commit_sha: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubCommit {
    sha: String,
}

async fn commit_sha(
    http: &reqwest::Client,
    owner: &str,
    repo: &str,
    branch: &str,
    token: Option<&str>,
) -> anyhow::Result<String> {
    let url = format!("https://api.github.com/repos/{owner}/{repo}/commits/{branch}");
    let raw = cached_get(http, &url, token).await?;
    let commit: GithubCommit = serde_json::from_str(&raw)?;
    Ok(commit.sha)
}

pub async fn github_facts(
    github: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<GithubFacts> {
    let github = github.trim().trim_end_matches('/').replace("https://github.com/", "");
    let (owner, repo) = github
        .split_once('/')
        .ok_or_else(|| anyhow::anyhow!("expected owner/repo"))?;
    let http = client(token, proxy)?;
    let raw = cached_get(&http, &format!("https://api.github.com/repos/{owner}/{repo}"), token).await?;
    let info: GithubRepo = serde_json::from_str(&raw)?;
    let branch = info.default_branch.clone().unwrap_or_else(|| "main".into());
    let sha = commit_sha(&http, owner, repo, &branch, token).await.ok();
    Ok(GithubFacts {
        full_name: info.full_name,
        private: info.private,
        archived: info.archived,
        fork: info.fork,
        commit_sha: sha,
    })
}

pub async fn search_github(
    query: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<Vec<CatalogProgram>> {
    search_github_topic("muck-store", query, token, proxy).await
}

pub async fn search_github_topic(
    topic: &str,
    query: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<Vec<CatalogProgram>> {
    let http = client(token, proxy)?;
    let q = if query.trim().is_empty() {
        format!("topic:{topic}")
    } else if query.contains("topic:") {
        query.trim().to_string()
    } else {
        format!("topic:{topic} {}", query.trim())
    };
    let url = format!(
        "https://api.github.com/search/repositories?q={}&per_page=20",
        urlencoding::encode(&q)
    );
    let raw = cached_get(&http, &url, token).await?;
    let search: SearchResponse = serde_json::from_str(&raw)?;
    let mut out = Vec::new();
    for repo in search.items {
        match fetch_github_program(&repo.full_name, token, proxy).await {
            Ok(p) => out.push(p),
            Err(_) => {
                let mut stub = CatalogProgram {
                    id: format!("github.{}", repo.full_name.replace('/', ".")),
                    name: repo.full_name.clone(),
                    version: "0.0.0".into(),
                    summary: repo
                        .description
                        .clone()
                        .unwrap_or_else(|| "Repository is missing a valid muck.json".into()),
                    description: repo.description,
                    license: repo.license.and_then(|l| l.spdx_id).unwrap_or_default(),
                    official: false,
                    featured: false,
                    source_github: repo.full_name,
                    stars: Some(repo.stargazers_count),
                    forks: Some(repo.forks_count),
                    language: repo.language.clone(),
                    updated_at: repo.updated_at,
                    owner_avatar: Some(repo.owner.avatar_url),
                    readme: None,
                    permissions: vec![],
                    categories: vec![],
                    tags: vec!["incomplete".into()],
                    icon: None,
                    screenshots: vec![],
                    installed: false,
                    installed_version: None,
                    has_settings: false,
                    local_resource: None,
                    manifest: None,
                    archived: repo.archived,
                    commit_sha: None,
                    html_url: Some(repo.html_url),
                };
                stub.tags.push("needs-manifest".into());
                out.push(stub);
            }
        }
    }
    Ok(out)
}

pub async fn latest_release(
    github: &str,
    token: Option<&str>,
    proxy: Option<&str>,
    include_pre: bool,
) -> anyhow::Result<Option<(String, Option<String>, Vec<(String, String)>)>> {
    let releases = fetch_releases(github, token, proxy).await?;
    let rel = releases.into_iter().find(|r| include_pre || !r.prerelease);
    Ok(rel.map(release_tuple))
}

pub async fn release_by_tag(
    github: &str,
    tag: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<Option<(String, Option<String>, Vec<(String, String)>)>> {
    let want = tag.trim_start_matches('v');
    let releases = fetch_releases(github, token, proxy).await?;
    Ok(releases
        .into_iter()
        .find(|r| r.tag_name.trim_start_matches('v') == want)
        .map(release_tuple))
}

pub async fn list_releases(
    github: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<Vec<ProgramRelease>> {
    let releases = fetch_releases(github, token, proxy).await?;
    Ok(releases
        .into_iter()
        .map(|r| ProgramRelease {
            tag: r.tag_name.trim_start_matches('v').to_string(),
            prerelease: r.prerelease,
            body: r.body,
        })
        .collect())
}

async fn fetch_releases(
    github: &str,
    token: Option<&str>,
    proxy: Option<&str>,
) -> anyhow::Result<Vec<GithubRelease>> {
    let github = github.replace("https://github.com/", "");
    let http = client(token, proxy)?;
    let url = format!("https://api.github.com/repos/{github}/releases");
    let raw = cached_get(&http, &url, token).await?;
    Ok(serde_json::from_str(&raw)?)
}

fn release_tuple(r: GithubRelease) -> (String, Option<String>, Vec<(String, String)>) {
    let assets = r
        .assets
        .into_iter()
        .map(|a| (a.name, a.browser_download_url))
        .collect();
    (r.tag_name.trim_start_matches('v').to_string(), r.body, assets)
}
