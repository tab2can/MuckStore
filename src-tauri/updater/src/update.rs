use serde::Deserialize;
use std::fs::{self, File};
use std::io::{copy, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Duration;

const LATEST_JSON: &str =
    "https://github.com/tab2can/MuckStore/releases/latest/download/latest.json";
const USER_AGENT: &str = "MuckStore-Updater";

#[derive(Debug)]
pub enum Outcome {
    Launch,
    InstallerStarted,
    Failed(String),
}

#[derive(Deserialize)]
struct Latest {
    version: String,
    platforms: Option<serde_json::Map<String, serde_json::Value>>,
}

#[derive(Deserialize)]
struct Platform {
    url: String,
}

pub fn run(on_status: impl Fn(&str, u8)) -> Outcome {
    on_status("Checking for updates…", 12);
    if !auto_update_enabled() {
        on_status("Automatic updates are off.", 100);
        std::thread::sleep(Duration::from_millis(280));
        return Outcome::Launch;
    }

    let current = env!("MUCK_STORE_VERSION");
    let latest = match fetch_latest() {
        Ok(v) => v,
        Err(_) => {
            on_status("Offline — opening Muck Store.", 100);
            std::thread::sleep(Duration::from_millis(400));
            return Outcome::Launch;
        }
    };

    let remote = latest.version.trim_start_matches('v');
    if !is_newer(remote, current) {
        on_status("You're up to date.", 100);
        std::thread::sleep(Duration::from_millis(450));
        return Outcome::Launch;
    }

    on_status(&format!("Downloading {remote}…"), 22);
    let url = match platform_url(&latest) {
        Some(u) => u,
        None => {
            return Outcome::Failed("This release has no Windows installer.".into());
        }
    };

    let temp = std::env::temp_dir().join("MuckStore-update");
    let _ = fs::create_dir_all(&temp);
    let download_name = url
        .rsplit('/')
        .next()
        .unwrap_or("update.bin")
        .replace("%20", " ");
    let archive = temp.join(download_name);

    if let Err(e) = download(&url, &archive, &on_status) {
        return Outcome::Failed(format!("Download failed: {e}"));
    }

    on_status("Preparing installer…", 88);
    let setup = match prepare_setup(&archive, &temp) {
        Ok(p) => p,
        Err(e) => return Outcome::Failed(format!("Could not unpack installer: {e}")),
    };

    on_status("Installing update…", 94);
    if let Err(e) = start_installer(&setup) {
        return Outcome::Failed(format!("Could not start installer: {e}"));
    }
    Outcome::InstallerStarted
}

pub fn launch_store() {
    if let Some(exe) = store_exe() {
        let mut cmd = Command::new(exe);
        cmd.arg("--from-updater")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x00000200 | 0x00000008);
        }
        let _ = cmd.spawn();
    }
}

fn auto_update_enabled() -> bool {
    let path = dirs_settings();
    let Ok(raw) = fs::read_to_string(path) else {
        return true;
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return true;
    };
    if let Some(policy) = v.get("storeUpdatePolicy").and_then(|x| x.as_str()) {
        return policy != "manual";
    }
    v.get("autoUpdateStore")
        .and_then(|x| x.as_bool())
        .unwrap_or(true)
}

fn dirs_settings() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("MuckStore")
        .join("store-settings.json")
}

fn fetch_latest() -> Result<Latest, String> {
    let client = http();
    let resp = client
        .get(LATEST_JSON)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?;
    resp.json().map_err(|e| e.to_string())
}

fn http() -> reqwest::blocking::Client {
    reqwest::blocking::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(20))
        .redirect(reqwest::redirect::Policy::limited(8))
        .build()
        .expect("http client")
}

fn platform_url(latest: &Latest) -> Option<String> {
    let key = if cfg!(target_arch = "x86") {
        "windows-i686"
    } else {
        "windows-x86_64"
    };
    let platforms = latest.platforms.as_ref()?;
    let value = platforms.get(key).or_else(|| {
        platforms
            .keys()
            .find(|k| k.starts_with("windows-"))
            .and_then(|k| platforms.get(k))
    })?;
    serde_json::from_value::<Platform>(value.clone())
        .ok()
        .map(|p| p.url)
}

fn is_newer(remote: &str, current: &str) -> bool {
    let Ok(r) = semver::Version::parse(remote.trim_start_matches('v')) else {
        return remote != current;
    };
    let Ok(c) = semver::Version::parse(current.trim_start_matches('v')) else {
        return true;
    };
    r > c
}

fn download(url: &str, dest: &Path, on_status: &impl Fn(&str, u8)) -> Result<(), String> {
    let mut resp = http()
        .get(url)
        .send()
        .and_then(|r| r.error_for_status())
        .map_err(|e| e.to_string())?;
    let total = resp.content_length().unwrap_or(0);
    let mut file = File::create(dest).map_err(|e| e.to_string())?;
    if total == 0 {
        copy(&mut resp, &mut file).map_err(|e| e.to_string())?;
        return Ok(());
    }
    let mut buf = [0u8; 64 * 1024];
    let mut read = 0u64;
    loop {
        use std::io::Read;
        let n = resp.read(&mut buf).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        read += n as u64;
        let pct = 22 + ((read.saturating_mul(60)) / total.max(1)) as u8;
        on_status("Downloading update…", pct.min(82));
    }
    Ok(())
}

fn prepare_setup(archive: &Path, temp: &Path) -> Result<PathBuf, String> {
    let name = archive
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if name.ends_with(".exe") {
        return Ok(archive.to_path_buf());
    }
    if name.ends_with(".zip") {
        let file = File::open(archive).map_err(|e| e.to_string())?;
        let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        let mut setup = None;
        for i in 0..zip.len() {
            let mut item = zip.by_index(i).map_err(|e| e.to_string())?;
            if item.is_dir() {
                continue;
            }
            let out_name = PathBuf::from(item.name()).file_name().map(PathBuf::from);
            let Some(out_name) = out_name else { continue };
            let out = temp.join(&out_name);
            let mut dest = File::create(&out).map_err(|e| e.to_string())?;
            copy(&mut item, &mut dest).map_err(|e| e.to_string())?;
            if out_name
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| e.eq_ignore_ascii_case("exe"))
            {
                setup = Some(out);
            }
        }
        return setup.ok_or_else(|| "zip did not contain an installer".into());
    }
    Err("unknown update package".into())
}

fn start_installer(setup: &Path) -> Result<(), String> {
    let store = store_exe().ok_or_else(|| "Muck Store.exe was not found".to_string())?;
    let dir = setup.parent().unwrap_or(Path::new("."));
    let script = dir.join("apply-update.ps1");
    let nsis_args = nsis_silent_args(&store);
    let elevate = needs_admin_install(&store);
    let body = format!(
        "$ErrorActionPreference = 'SilentlyContinue'\r\n\
Wait-Process -Id {pid} -Timeout 90 -ErrorAction SilentlyContinue\r\n\
Start-Sleep -Milliseconds 600\r\n\
taskkill /F /IM 'Muck Store.exe' /T | Out-Null\r\n\
taskkill /F /IM muck-store.exe /T | Out-Null\r\n\
Start-Sleep -Milliseconds 400\r\n\
$setup = {setup}\r\n\
$store = {store}\r\n\
$arg = {args}\r\n\
if ({elevate}) {{\r\n\
  $p = Start-Process -FilePath $setup -ArgumentList $arg -Verb RunAs -Wait -PassThru\r\n\
}} else {{\r\n\
  $p = Start-Process -FilePath $setup -ArgumentList $arg -Wait -PassThru\r\n\
}}\r\n\
Start-Sleep -Milliseconds 400\r\n\
if (Test-Path -LiteralPath $store) {{\r\n\
  Start-Process -FilePath $store -ArgumentList '--from-updater'\r\n\
}}\r\n",
        pid = std::process::id(),
        setup = ps_lit(&setup.to_string_lossy()),
        store = ps_lit(&store.to_string_lossy()),
        args = ps_lit(nsis_args),
        elevate = if elevate { "$true" } else { "$false" },
    );
    fs::write(&script, body).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-WindowStyle",
        "Hidden",
        "-File",
    ])
    .arg(&script)
    .stdin(Stdio::null())
    .stdout(Stdio::null())
    .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB
        // Do not combine CREATE_NO_WINDOW with DETACHED_PROCESS — Windows ignores
        // NO_WINDOW and ping/cmd then flash a console.
        cmd.creation_flags(0x0800_0000 | 0x0000_0200 | 0x0100_0000);
    }
    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn nsis_silent_args(store: &Path) -> &'static str {
    if needs_admin_install(store) {
        "/S /allusers"
    } else {
        "/S /currentuser"
    }
}

fn needs_admin_install(store: &Path) -> bool {
    let p = store.to_string_lossy().to_ascii_lowercase();
    p.contains("\\program files\\") || p.contains("\\program files (x86)\\")
}

fn ps_lit(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn store_exe() -> Option<PathBuf> {
    let me = std::env::current_exe().ok()?;
    let dir = me.parent()?.to_path_buf();
    for name in ["Muck Store.exe", "muck-store.exe"] {
        let p = dir.join(name);
        if p.exists() {
            return Some(p);
        }
    }
    None
}
