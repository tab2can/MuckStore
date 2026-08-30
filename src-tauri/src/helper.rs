use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HelperJob {
    pub action: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub args: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub working_dir: Option<String>,
    #[serde(default)]
    pub expected_sha256: Option<String>,
}

pub fn run_job(job_path: &Path) -> anyhow::Result<()> {
    let raw = std::fs::read_to_string(job_path)?;
    let job: HelperJob = serde_json::from_str(&raw)?;
    match job.action.as_str() {
        "defenderExclusion" => defender_exclusion(job.path.as_deref().ok_or_else(|| anyhow::anyhow!("path required"))?),
        "shortcut" => create_shortcut(&job),
        "autostart" => set_autostart(&job, true),
        "removeAutostart" => set_autostart(&job, false),
        "installMsi" => install_msi(&job),
        "installNsis" => install_nsis(&job),
        "installInno" => install_inno(&job),
        "runPostinstall" => run_postinstall(&job),
        other => anyhow::bail!("unknown helper action: {other}"),
    }
}

fn defender_exclusion(path: &str) -> anyhow::Result<()> {
    let status = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!(
                "Add-MpPreference -ExclusionPath {}",
                ps_quote(path)
            ),
        ])
        .status()?;
    if !status.success() {
        anyhow::bail!("Add-MpPreference failed");
    }
    Ok(())
}

fn create_shortcut(job: &HelperJob) -> anyhow::Result<()> {
    let target = job.target.as_deref().ok_or_else(|| anyhow::anyhow!("target required"))?;
    let path = job.path.as_deref().ok_or_else(|| anyhow::anyhow!("path required"))?;
    let work = job.working_dir.clone().unwrap_or_default();
    let args_line = if let Some(args) = &job.args {
        format!("$s.Arguments = {}; ", ps_quote(args))
    } else {
        String::new()
    };
    let script = format!(
        "$ErrorActionPreference = 'Stop'; $ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut({}); $s.TargetPath = {}; {args_line}$s.WorkingDirectory = {}; $s.Save()",
        ps_quote(path),
        ps_quote(target),
        ps_quote(&work)
    );
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .status()?;
    if !status.success() {
        anyhow::bail!("shortcut creation failed");
    }
    Ok(())
}

fn set_autostart(job: &HelperJob, enable: bool) -> anyhow::Result<()> {
    let name = job.name.as_deref().ok_or_else(|| anyhow::anyhow!("name required"))?;
    let key = r"HKCU:\Software\Microsoft\Windows\CurrentVersion\Run";
    let script = if enable {
        let target = job.target.as_deref().ok_or_else(|| anyhow::anyhow!("target required"))?;
        format!(
            "New-ItemProperty -Path {} -Name {} -Value {} -PropertyType String -Force | Out-Null",
            ps_quote(key),
            ps_quote(name),
            ps_quote(target)
        )
    } else {
        format!(
            "Remove-ItemProperty -Path {} -Name {} -ErrorAction SilentlyContinue",
            ps_quote(key),
            ps_quote(name)
        )
    };
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .status()?;
    if !status.success() {
        anyhow::bail!("autostart registry update failed");
    }
    Ok(())
}

fn install_msi(job: &HelperJob) -> anyhow::Result<()> {
    let msi = job.path.as_deref().ok_or_else(|| anyhow::anyhow!("msi path required"))?;
    verify_hash(msi, job.expected_sha256.as_deref())?;
    let dest = job.target.clone().unwrap_or_default();
    let prop = job
        .args
        .clone()
        .unwrap_or_else(|| "INSTALLDIR".into());
    let mut cmd = std::process::Command::new("msiexec");
    cmd.args(["/i", msi, "/qn", "/norestart"]);
    if !dest.is_empty() {
        cmd.arg(format!("{prop}={dest}"));
    }
    let status = cmd.status()?;
    if !status.success() {
        anyhow::bail!("msiexec failed");
    }
    Ok(())
}

fn install_nsis(job: &HelperJob) -> anyhow::Result<()> {
    let setup = job.path.as_deref().ok_or_else(|| anyhow::anyhow!("setup path required"))?;
    verify_hash(setup, job.expected_sha256.as_deref())?;
    let dest = job.target.clone().unwrap_or_default();
    let extra = job.args.clone().unwrap_or_else(|| "/S".into());
    let mut cmd = std::process::Command::new(setup);
    for part in extra.split_whitespace() {
        cmd.arg(part);
    }
    if !dest.is_empty() {
        cmd.arg(format!("/D={dest}"));
    }
    let status = cmd.status()?;
    if !status.success() {
        anyhow::bail!("NSIS installer failed");
    }
    Ok(())
}

fn install_inno(job: &HelperJob) -> anyhow::Result<()> {
    let setup = job.path.as_deref().ok_or_else(|| anyhow::anyhow!("setup path required"))?;
    verify_hash(setup, job.expected_sha256.as_deref())?;
    let dest = job.target.clone().unwrap_or_default();
    let extra = job
        .args
        .clone()
        .unwrap_or_else(|| "/VERYSILENT /NORESTART".into());
    let mut cmd = std::process::Command::new(setup);
    for part in extra.split_whitespace() {
        cmd.arg(part);
    }
    if !dest.is_empty() {
        cmd.arg(format!("/DIR={dest}"));
    }
    let status = cmd.status()?;
    if !status.success() {
        anyhow::bail!("Inno Setup installer failed");
    }
    Ok(())
}

fn run_postinstall(job: &HelperJob) -> anyhow::Result<()> {
    let script = job.path.as_deref().ok_or_else(|| anyhow::anyhow!("script path required"))?;
    verify_hash(script, job.expected_sha256.as_deref())?;
    let work = job
        .working_dir
        .as_deref()
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("."));
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script])
        .current_dir(work)
        .status()?;
    if !status.success() {
        anyhow::bail!("postinstall script failed");
    }
    Ok(())
}

fn verify_hash(path: &str, expected: Option<&str>) -> anyhow::Result<()> {
    let Some(expected) = expected else {
        anyhow::bail!("helper refuses to run an unsigned payload without sha256");
    };
    let actual = crate::security::sha256_file(Path::new(path))?;
    if !crate::security::hashes_equal(expected, &actual) {
        anyhow::bail!("helper hash mismatch for {path}");
    }
    Ok(())
}

pub fn relaunch_elevated(job: &HelperJob) -> anyhow::Result<()> {
    let dir = crate::paths::cache_dir().join("helper");
    std::fs::create_dir_all(&dir)?;
    let job_path = dir.join(format!("{}.json", uuid::Uuid::new_v4()));
    std::fs::write(&job_path, serde_json::to_vec_pretty(job)?)?;
    let exe = std::env::current_exe()?;
    let script = format!(
        "Start-Process -FilePath {} -ArgumentList @('--helper-job', {}) -Verb RunAs -Wait",
        ps_quote(&exe.to_string_lossy()),
        ps_quote(&job_path.to_string_lossy())
    );
    let status = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", &script])
        .status()?;
    let _ = std::fs::remove_file(&job_path);
    if !status.success() {
        anyhow::bail!("UAC elevation was cancelled or the helper failed");
    }
    Ok(())
}

pub fn run_or_elevate(job: HelperJob, needs_admin: bool) -> anyhow::Result<()> {
    if needs_admin {
        relaunch_elevated(&job)
    } else {
        let dir = crate::paths::cache_dir().join("helper");
        std::fs::create_dir_all(&dir)?;
        let job_path = dir.join(format!("{}.json", uuid::Uuid::new_v4()));
        std::fs::write(&job_path, serde_json::to_vec_pretty(&job)?)?;
        let result = run_job(&job_path);
        let _ = std::fs::remove_file(&job_path);
        result
    }
}

fn ps_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}
