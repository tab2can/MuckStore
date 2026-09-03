use crate::models::{InstalledProgram, ProcessStatus};
use crate::paths;
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
#[cfg(windows)]
const DETACHED_PROCESS: u32 = 0x0000_0008;

pub struct Running {
    pub child: Child,
    pub restarts: u32,
}

#[derive(Default)]
pub struct ProcessManager {
    pub children: HashMap<String, Running>,
}

impl ProcessManager {
    pub fn start(&mut self, program: &InstalledProgram, isolation: bool) -> anyhow::Result<u32> {
        if let Some(running) = self.children.get_mut(&program.id) {
            if running.child.try_wait()?.is_none() {
                return Ok(running.child.id());
            }
        }
        let dir = PathBuf::from(&program.install_path);
        let entry = dir.join(&program.manifest.entry);
        if !entry.exists() {
            anyhow::bail!("entry not found: {}", entry.display());
        }
        let log_path = paths::logs_dir().join(format!("{}.log", program.id));
        std::fs::create_dir_all(paths::logs_dir())?;
        let log = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)?;
        let err = log.try_clone()?;
        let mut cmd = command_for_entry(&entry, &dir)?;
        for arg in split_launch_args(&program.launch_args) {
            cmd.arg(arg);
        }
        cmd.current_dir(&dir)
            .env("MUCK_PROGRAM_DIR", &program.install_path)
            .env("MUCK_PROGRAM_ID", &program.id)
            .env(
                "MUCK_SETTINGS_PATH",
                paths::program_settings_path(&program.id),
            )
            .stdin(Stdio::null())
            .stdout(Stdio::from(log))
            .stderr(Stdio::from(err));
        #[cfg(windows)]
        {
            let flags = if is_gui_script(&entry) {
                CREATE_NEW_PROCESS_GROUP | DETACHED_PROCESS
            } else {
                CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
            };
            cmd.creation_flags(flags);
        }
        let child = cmd.spawn()?;
        let pid = child.id();
        if isolation {
            attach_job(pid);
        }
        self.children.insert(
            program.id.clone(),
            Running {
                child,
                restarts: 0,
            },
        );
        Ok(pid)
    }

    pub fn stop(&mut self, id: &str) -> anyhow::Result<()> {
        if let Some(mut running) = self.children.remove(id) {
            let _ = running.child.kill();
            let _ = running.child.wait();
        }
        Ok(())
    }

    pub fn status(&mut self, id: &str) -> ProcessStatus {
        let running = match self.children.get_mut(id) {
            Some(r) => r,
            None => {
                return ProcessStatus {
                    id: id.into(),
                    running: false,
                    pid: None,
                }
            }
        };
        match running.child.try_wait() {
            Ok(Some(_)) => ProcessStatus {
                id: id.into(),
                running: false,
                pid: None,
            },
            Ok(None) => ProcessStatus {
                id: id.into(),
                running: true,
                pid: Some(running.child.id()),
            },
            Err(_) => ProcessStatus {
                id: id.into(),
                running: false,
                pid: None,
            },
        }
    }

    pub fn poll_exits(&mut self) -> Vec<String> {
        let mut exited = Vec::new();
        let ids: Vec<String> = self.children.keys().cloned().collect();
        for id in ids {
            if let Some(r) = self.children.get_mut(&id) {
                if let Ok(Some(_)) = r.child.try_wait() {
                    exited.push(id);
                }
            }
        }
        for id in &exited {
            self.children.remove(id);
        }
        exited
    }
}

fn command_for_entry(entry: &std::path::Path, install_dir: &PathBuf) -> anyhow::Result<Command> {
    let ext = entry
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let runtimes = crate::runtime::load_resolved(install_dir);
    let python = runtimes
        .iter()
        .find(|r| r.id == "python")
        .map(|r| r.bin.clone())
        .unwrap_or_else(|| PathBuf::from("python"));
    let node = runtimes
        .iter()
        .find(|r| r.id == "node")
        .map(|r| r.bin.clone())
        .unwrap_or_else(|| PathBuf::from("node"));
    let mut cmd = match ext.as_str() {
        "ps1" => {
            let mut c = Command::new("powershell");
            c.args([
                "-STA",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ]);
            c.arg(entry);
            c
        }
        "py" => {
            let mut c = Command::new(python);
            c.arg(entry);
            c
        }
        "js" | "mjs" | "cjs" => {
            let mut c = Command::new(node);
            c.arg(entry);
            c
        }
        "cmd" | "bat" => {
            let mut c = Command::new("cmd");
            c.args(["/C"]);
            c.arg(entry);
            c
        }
        _ => Command::new(entry),
    };
    if let Some(extra) = runtimes.iter().find_map(|r| r.extra_path.as_ref()) {
        if let Some(path) = std::env::var_os("PATH") {
            let mut paths = vec![extra.clone()];
            paths.extend(std::env::split_paths(&path));
            cmd.env("PATH", std::env::join_paths(paths).unwrap_or(path));
        }
    }
    Ok(cmd)
}

fn split_launch_args(raw: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut cur = String::new();
    let mut quote: Option<char> = None;
    for c in raw.chars() {
        match quote {
            Some(q) if c == q => quote = None,
            Some(_) => cur.push(c),
            None if c == '"' || c == '\'' => quote = Some(c),
            None if c.is_whitespace() => {
                if !cur.is_empty() {
                    out.push(std::mem::take(&mut cur));
                }
            }
            None => cur.push(c),
        }
    }
    if !cur.is_empty() {
        out.push(cur);
    }
    out
}

fn is_gui_script(entry: &std::path::Path) -> bool {
    matches!(
        entry
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "ps1" | "pyw" | "hta"
    )
}

pub fn read_logs(id: &str, tail: usize) -> String {
    let path = paths::logs_dir().join(format!("{id}.log"));
    match std::fs::read_to_string(path) {
        Ok(raw) => {
            let lines: Vec<&str> = raw.lines().collect();
            let start = lines.len().saturating_sub(tail);
            lines[start..].join("\n")
        }
        Err(_) => String::new(),
    }
}

fn attach_job(pid: u32) {
    let _ = pid;
    // Optional Job Object isolation is stored as a setting. The Win32
    // CreateJobObjectW export is feature-gated across windows-sys versions,
    // so v1 records the flag and still starts the process in the user session.
}
