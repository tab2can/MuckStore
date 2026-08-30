use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MuckManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub license: String,
    pub summary: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    pub source: Source,
    pub entry: String,
    pub install: InstallSpec,
    #[serde(default)]
    pub runtimes: Vec<RuntimeSpec>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub filesystem_paths: Vec<String>,
    #[serde(default)]
    pub settings: Option<SettingsSpec>,
    #[serde(default)]
    pub update: Option<UpdateSpec>,
    #[serde(default)]
    pub watchdog: Option<WatchdogSpec>,
    #[serde(default)]
    pub i18n: Option<HashMap<String, ManifestI18n>>,
    #[serde(default)]
    pub ui: Option<UiSpec>,
    #[serde(default)]
    pub build: Option<BuildSpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub github: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallSpec {
    pub kind: String,
    #[serde(default)]
    pub assets: Vec<Asset>,
    #[serde(default)]
    pub silent_args: Option<String>,
    #[serde(default)]
    pub installdir_property: Option<String>,
    #[serde(default)]
    pub postinstall: Option<String>,
    #[serde(default)]
    pub postinstall_sha256: Option<String>,
    #[serde(default)]
    pub shortcuts: ShortcutSpec,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Asset {
    pub file: String,
    pub platform: String,
    pub sha256: String,
    #[serde(default)]
    pub url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShortcutSpec {
    #[serde(default = "default_true")]
    pub start_menu: bool,
    #[serde(default)]
    pub desktop: bool,
}

impl Default for ShortcutSpec {
    fn default() -> Self {
        Self {
            start_menu: true,
            desktop: false,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeSpec {
    pub id: String,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub strategy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsSpec {
    #[serde(default)]
    pub schema: Option<serde_json::Value>,
    #[serde(default)]
    pub schema_file: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSpec {
    #[serde(default)]
    pub channel: Option<String>,
    #[serde(default)]
    pub include_prerelease: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchdogSpec {
    #[serde(default)]
    pub on_crash: Option<String>,
    #[serde(default)]
    pub max_restarts: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestI18n {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiSpec {
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub screenshots: Vec<String>,
    #[serde(default)]
    pub accent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildSpec {
    pub workflow: String,
    #[serde(default)]
    pub reproducible: Option<bool>,
    #[serde(default)]
    pub attestations: Option<String>,
}

impl MuckManifest {
    pub fn load(path: &Path) -> anyhow::Result<Self> {
        let raw = std::fs::read_to_string(path)?;
        let manifest: Self = serde_json::from_str(&raw)?;
        manifest.validate()?;
        Ok(manifest)
    }

    pub fn validate(&self) -> anyhow::Result<()> {
        if !self.id.contains('.') {
            anyhow::bail!("id must be reverse-DNS, got {}", self.id);
        }
        if self.source.github.split('/').count() != 2 {
            anyhow::bail!("source.github must be owner/repo");
        }
        if self.entry.trim().is_empty() {
            anyhow::bail!("entry is required");
        }
        let kind = self.install.kind.as_str();
        match kind {
            "portable" | "archive" | "msi" | "nsis" | "inno" | "script" | "runtime" => {}
            other => anyhow::bail!("unknown install.kind: {other}"),
        }
        for perm in &self.permissions {
            if !PERMISSIONS.contains(&perm.as_str()) {
                anyhow::bail!("unknown permission: {perm}");
            }
        }
        if self.requires_github_actions_attestation() {
            let build = self
                .build
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("remote Release assets require a build.workflow (GitHub Actions)"))?;
            if !build.workflow.contains(".github/workflows/") {
                anyhow::bail!("build.workflow must point at a GitHub Actions file under .github/workflows/");
            }
            if build.reproducible == Some(false) {
                anyhow::bail!("build.reproducible must be true for store distribution");
            }
            if let Some(att) = &build.attestations {
                if att != "required" {
                    anyhow::bail!("build.attestations must be required for store distribution");
                }
            }
        }
        Ok(())
    }

    pub fn requires_github_actions_attestation(&self) -> bool {
        if self.install.assets.is_empty() {
            return false;
        }
        matches!(
            self.install.kind.as_str(),
            "archive" | "msi" | "nsis" | "inno" | "runtime" | "portable"
        )
    }

    pub fn has_settings(&self) -> bool {
        self.settings
            .as_ref()
            .and_then(|s| s.schema.as_ref())
            .is_some()
    }

    pub fn needs_admin(&self) -> bool {
        self.permissions.iter().any(|p| p == "admin")
    }
}

pub const PERMISSIONS: &[&str] = &[
    "network",
    "filesystem",
    "autostart",
    "input-hook",
    "clipboard",
    "notifications",
    "screenshot",
    "shell-integration",
    "other-process",
    "windows-settings",
    "admin",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogProgram {
    pub id: String,
    pub name: String,
    pub version: String,
    pub summary: String,
    #[serde(default)]
    pub description: Option<String>,
    pub license: String,
    pub official: bool,
    #[serde(default)]
    pub featured: bool,
    pub source_github: String,
    #[serde(default)]
    pub stars: Option<u64>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub owner_avatar: Option<String>,
    #[serde(default)]
    pub readme: Option<String>,
    #[serde(default)]
    pub permissions: Vec<String>,
    #[serde(default)]
    pub categories: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub screenshots: Vec<String>,
    #[serde(default)]
    pub installed: bool,
    #[serde(default)]
    pub installed_version: Option<String>,
    #[serde(default)]
    pub has_settings: bool,
    #[serde(default)]
    pub local_resource: Option<String>,
    #[serde(default)]
    pub manifest: Option<MuckManifest>,
    #[serde(default)]
    pub archived: bool,
    #[serde(default)]
    pub commit_sha: Option<String>,
    #[serde(default)]
    pub html_url: Option<String>,
}

impl CatalogProgram {
    pub fn from_manifest(manifest: MuckManifest, official: bool, local_resource: Option<String>) -> Self {
        Self {
            id: manifest.id.clone(),
            name: manifest.name.clone(),
            version: manifest.version.clone(),
            summary: manifest.summary.clone(),
            description: manifest.description.clone(),
            license: manifest.license.clone(),
            official,
            featured: false,
            source_github: manifest.source.github.clone(),
            stars: None,
            updated_at: None,
            owner_avatar: None,
            readme: None,
            permissions: manifest.permissions.clone(),
            categories: manifest.categories.clone(),
            tags: manifest.tags.clone(),
            icon: manifest.ui.as_ref().and_then(|u| u.icon.clone()),
            screenshots: manifest
                .ui
                .as_ref()
                .map(|u| u.screenshots.clone())
                .unwrap_or_default(),
            installed: false,
            installed_version: None,
            has_settings: manifest.has_settings(),
            local_resource,
            manifest: Some(manifest),
            archived: false,
            commit_sha: None,
            html_url: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledProgram {
    pub id: String,
    pub version: String,
    pub install_path: String,
    pub official: bool,
    pub source_github: String,
    pub enabled: bool,
    pub autostart: bool,
    #[serde(default)]
    pub pinned_version: Option<String>,
    #[serde(default)]
    pub update_channel: String,
    pub installed_at: String,
    pub manifest: MuckManifest,
    #[serde(default)]
    pub inventory: Vec<String>,
    #[serde(default)]
    pub previous_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstalledRegistry {
    #[serde(default)]
    pub programs: HashMap<String, InstalledProgram>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoreSettings {
    pub language: String,
    pub theme_id: String,
    pub density: String,
    pub sidebar_position: String,
    pub mica: bool,
    #[serde(default)]
    pub accent: Option<String>,
    pub animations: bool,
    pub reduced_motion: bool,
    pub font_scale: f32,
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub tray_enabled: bool,
    #[serde(default)]
    pub install_path: Option<String>,
    #[serde(default)]
    pub github_token: Option<String>,
    #[serde(default)]
    pub proxy: Option<String>,
    pub warn_third_party: bool,
    pub hash_fail_policy: String,
    pub auto_update_store: bool,
    pub auto_update_programs: String,
    #[serde(default)]
    pub quiet_hours_start: Option<String>,
    #[serde(default)]
    pub quiet_hours_end: Option<String>,
    pub developer_mode: bool,
    #[serde(default)]
    pub sideload_path: Option<String>,
    pub verbose_logs: bool,
    pub defender_exclusion_consent: bool,
    pub isolation_job_object: bool,
    pub telemetry: bool,
    pub update_channel: String,
    pub custom_css: bool,
}

impl Default for StoreSettings {
    fn default() -> Self {
        Self {
            language: "en".into(),
            theme_id: "midnight".into(),
            density: "comfortable".into(),
            sidebar_position: "left".into(),
            mica: false,
            accent: None,
            animations: true,
            reduced_motion: false,
            font_scale: 1.0,
            start_with_windows: false,
            start_minimized: false,
            tray_enabled: true,
            install_path: None,
            github_token: None,
            proxy: None,
            warn_third_party: true,
            hash_fail_policy: "reject".into(),
            auto_update_store: true,
            auto_update_programs: "notify".into(),
            quiet_hours_start: None,
            quiet_hours_end: None,
            developer_mode: false,
            sideload_path: None,
            verbose_logs: false,
            defender_exclusion_consent: false,
            isolation_job_object: false,
            telemetry: false,
            update_channel: "stable".into(),
            custom_css: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThemePack {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub author: Option<String>,
    pub tokens: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallRequest {
    #[serde(default)]
    pub github: Option<String>,
    #[serde(default)]
    pub local_resource: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    pub trust_accepted: bool,
    #[serde(default)]
    pub official: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyCheck {
    pub id: String,
    pub status: String,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyReport {
    pub program_id: String,
    pub name: String,
    pub official: bool,
    pub verdict: String,
    pub github: String,
    pub version: String,
    #[serde(default)]
    pub commit_sha: Option<String>,
    pub checks: Vec<VerifyCheck>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrustRecord {
    pub id: String,
    pub github: String,
    pub version: String,
    #[serde(default)]
    pub commit_sha: Option<String>,
    pub official: bool,
    pub approved_at: String,
    pub verdict: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub id: String,
    pub stage: String,
    pub percent: u8,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStatus {
    pub id: String,
    pub running: bool,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub id: String,
    pub current: String,
    pub available: Option<String>,
    pub changelog: Option<String>,
    pub store: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppPaths {
    pub programs: String,
    pub config: String,
    pub cache: String,
    pub logs: String,
    pub themes: String,
    pub runtimes: String,
    pub data_root: String,
}
