use crate::models::{InstalledProgram, ProcessStatus};
use crate::paths;
use std::collections::{HashMap, HashSet};
use std::fs::OpenOptions;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
#[cfg(windows)]
const DETACHED_PROCESS: u32 = 0x0000_0008;

const SUCCESSOR_GRACE: Duration = Duration::from_secs(4);

pub struct Running {
    pub child: Option<Child>,
    pub spawn_pid: u32,
    pub ancestors: HashSet<u32>,
    pub seen_live: bool,
    pub waiting_since: Option<Instant>,
    pub restarts: u32,
}

#[derive(Default)]
pub struct ProcessManager {
    pub children: HashMap<String, Running>,
}

pub fn elevated_task_name(id: &str) -> String {
    format!("MuckStore_elev_{id}")
}

pub fn launch_cmd_path(id: &str) -> PathBuf {
    paths::cache_dir().join("launch").join(format!("{id}.cmd"))
}

impl ProcessManager {
    pub fn running_pid(&mut self, program: &InstalledProgram) -> Option<u32> {
        self.refresh_live(&program.id, Some(program)).into_iter().next()
    }

    fn reap_child(running: &mut Running) {
        let Some(child) = running.child.as_mut() else {
            return;
        };
        match child.try_wait() {
            Ok(None) => {}
            Ok(Some(_)) | Err(_) => {
                running.child = None;
            }
        }
    }

    fn refresh_live(&mut self, id: &str, program: Option<&InstalledProgram>) -> Vec<u32> {
        let Some(running) = self.children.get_mut(id) else {
            return program
                .map(crate::procsnap::pids_for_program)
                .unwrap_or_default();
        };
        Self::reap_child(running);
        let mut live = if let Some(program) = program {
            let ancestors: Vec<u32> = running.ancestors.iter().copied().collect();
            crate::procsnap::pids_for_program_from(program, &ancestors)
        } else {
            Vec::new()
        };
        if let Some(child) = running.child.as_ref() {
            let pid = child.id();
            if !live.contains(&pid) {
                live.push(pid);
            }
        }
        running.ancestors.extend(live.iter().copied());
        let has_successor = live.iter().any(|pid| *pid != running.spawn_pid);
        if live.is_empty() {
            if running.child.is_none() && running.waiting_since.is_none() {
                running.waiting_since = Some(Instant::now());
            }
        } else {
            if has_successor {
                running.seen_live = true;
            }
            running.waiting_since = None;
        }
        live
    }

    fn session_finished(&self, id: &str, live: &[u32]) -> bool {
        if !live.is_empty() {
            return false;
        }
        let Some(running) = self.children.get(id) else {
            return true;
        };
        if running.child.is_some() {
            return false;
        }
        if running.seen_live {
            return true;
        }
        running
            .waiting_since
            .map(|at| at.elapsed() >= SUCCESSOR_GRACE)
            .unwrap_or(true)
    }

    pub fn adopt(&mut self, id: String, child: Option<Child>, pid: u32, isolation: bool) {
        let mut ancestors = HashSet::new();
        if pid != 0 {
            ancestors.insert(pid);
        }
        if let Some(ref child) = child {
            ancestors.insert(child.id());
            if isolation {
                attach_job(child.id());
            }
        } else if isolation && pid != 0 {
            attach_job(pid);
        }
        if child.is_none() && pid == 0 {
            return;
        }
        let spawn_pid = if pid != 0 {
            pid
        } else {
            child.as_ref().map(|c| c.id()).unwrap_or(0)
        };
        self.children.insert(
            id,
            Running {
                child,
                spawn_pid,
                ancestors,
                seen_live: false,
                waiting_since: None,
                restarts: 0,
            },
        );
    }

    pub fn stop(&mut self, id: &str) -> anyhow::Result<()> {
        let inst = crate::settings::load_registry().programs.get(id).cloned();
        let mut pids = self.refresh_live(id, inst.as_ref());
        if let Some(mut running) = self.children.remove(id) {
            if let Some(mut child) = running.child.take() {
                pids.push(child.id());
                let _ = child.kill();
                let _ = child.wait();
            }
            pids.extend(running.ancestors.iter().copied());
        }
        if let Some(inst) = inst.as_ref() {
            pids.extend(crate::procsnap::pids_for_program_from(inst, &pids));
        }
        pids.sort_unstable();
        pids.dedup();
        crate::procsnap::kill_pids(&pids);
        Ok(())
    }

    pub fn status(&mut self, id: &str) -> ProcessStatus {
        let inst = crate::settings::load_registry().programs.get(id).cloned();
        let live = self.refresh_live(id, inst.as_ref());
        if let Some(pid) = live.first().copied() {
            return ProcessStatus {
                id: id.into(),
                running: true,
                pid: Some(pid),
            };
        }
        let waiting_for_successor = self.children.get(id).is_some_and(|r| {
            r.child.is_none()
                && !r.seen_live
                && r.waiting_since
                    .is_some_and(|at| at.elapsed() < SUCCESSOR_GRACE)
        });
        if waiting_for_successor {
            return ProcessStatus {
                id: id.into(),
                running: true,
                pid: None,
            };
        }
        if self.children.contains_key(id) && self.session_finished(id, &live) {
            self.children.remove(id);
        }
        ProcessStatus {
            id: id.into(),
            running: false,
            pid: None,
        }
    }

    pub fn poll_exits(&mut self) -> Vec<String> {
        let ids: Vec<String> = self.children.keys().cloned().collect();
        let registry = crate::settings::load_registry();
        let mut exited = Vec::new();
        for id in ids {
            let inst = registry.programs.get(&id).cloned();
            let live = self.refresh_live(&id, inst.as_ref());
            if self.session_finished(&id, &live) {
                self.children.remove(&id);
                exited.push(id);
            }
        }
        exited
    }
}

pub fn spawn_program(program: &InstalledProgram, isolation: bool) -> anyhow::Result<(Option<Child>, u32)> {
    if let Some(pid) = crate::procsnap::pids_for_program(program).into_iter().next() {
        return Ok((None, pid));
    }
    let dir = PathBuf::from(&program.install_path);
    let entry = dir.join(&program.manifest.entry);
    if !entry.exists() {
        anyhow::bail!("entry not found: {}", entry.display());
    }
    write_launch_cmd(program)?;
    let needs_admin = program.manifest.needs_admin();
    if program.remember_elevation && elevated_task_registered(&program.id) {
        start_elevated_task(&program.id)?;
        let pid = wait_for_pid(program).unwrap_or(0);
        return Ok((None, pid));
    }
    if !needs_admin {
        match spawn_unelevated(program, isolation) {
            Ok(child) => {
                let pid = child.id();
                return Ok((Some(child), pid));
            }
            Err(err) if is_elevation_required(&err) => {}
            Err(err) => return Err(err.into()),
        }
    }
    if program.remember_elevation {
        register_elevated_task(program)?;
        start_elevated_task(&program.id)?;
        let pid = wait_for_pid(program).unwrap_or(0);
        return Ok((None, pid));
    }
    let pid = start_with_uac(program)?;
    Ok((None, pid))
}

fn spawn_unelevated(program: &InstalledProgram, isolation: bool) -> std::io::Result<Child> {
    let dir = PathBuf::from(&program.install_path);
    let entry = dir.join(&program.manifest.entry);
    let log_path = paths::logs_dir().join(format!("{}.log", program.id));
    std::fs::create_dir_all(paths::logs_dir())?;
    let log = OpenOptions::new().create(true).append(true).open(&log_path)?;
    let err = log.try_clone()?;
    let mut cmd = command_for_entry(&entry, &dir).map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?;
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
    if isolation {
        attach_job(child.id());
    }
    Ok(child)
}

fn is_elevation_required(err: &std::io::Error) -> bool {
    err.raw_os_error() == Some(740)
}

fn write_launch_cmd(program: &InstalledProgram) -> anyhow::Result<PathBuf> {
    let dir = PathBuf::from(&program.install_path);
    let entry = dir.join(&program.manifest.entry);
    let log = paths::logs_dir().join(format!("{}.log", program.id));
    std::fs::create_dir_all(paths::logs_dir())?;
    let path = launch_cmd_path(&program.id);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let extra = split_launch_args(&program.launch_args)
        .into_iter()
        .map(|a| format!("\"{}\"", a.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" ");
    let run = launch_line(&entry, &dir, &extra)?;
    let settings = paths::program_settings_path(&program.id);
    let body = format!(
        "@echo off\r\nset \"MUCK_PROGRAM_DIR={dir}\"\r\nset \"MUCK_PROGRAM_ID={id}\"\r\nset \"MUCK_SETTINGS_PATH={settings}\"\r\ncd /d \"{dir}\"\r\n{run} >> \"{log}\" 2>&1\r\n",
        dir = dir.display(),
        id = program.id,
        settings = settings.display(),
        run = run,
        log = log.display(),
    );
    std::fs::write(&path, body)?;
    Ok(path)
}

fn launch_line(entry: &std::path::Path, install_dir: &PathBuf, extra: &str) -> anyhow::Result<String> {
    let (exe, args) = invocation(entry, install_dir)?;
    let mut parts = vec![format!("\"{}\"", exe.display())];
    for arg in args {
        parts.push(format!("\"{}\"", arg.replace('"', "\"\"")));
    }
    if !extra.is_empty() {
        parts.push(extra.to_string());
    }
    Ok(parts.join(" "))
}

fn start_with_uac(program: &InstalledProgram) -> anyhow::Result<u32> {
    let cmd = write_launch_cmd(program)?;
    let script = format!(
        "$ErrorActionPreference = 'Stop'; $p = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/C', {}) -WorkingDirectory {} -Verb RunAs -PassThru; if (-not $p) {{ exit 1 }}; Write-Output $p.Id",
        crate::helper::ps_quote(&cmd.to_string_lossy()),
        crate::helper::ps_quote(&program.install_path),
    );
    let mut command = Command::new("powershell");
    command.args(["-NoProfile", "-STA", "-Command", &script]);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let output = command.output()?;
    if !output.status.success() {
        anyhow::bail!("administrator approval was cancelled or the program failed to start");
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    if let Some(pid) = stdout.lines().rev().find_map(|l| l.trim().parse::<u32>().ok()) {
        return Ok(pid);
    }
    Ok(wait_for_pid(program).unwrap_or(0))
}

fn register_elevated_task(program: &InstalledProgram) -> anyhow::Result<()> {
    let cmd = write_launch_cmd(program)?;
    crate::helper::run_or_elevate(
        crate::helper::HelperJob {
            action: "registerElevatedLaunch".into(),
            path: Some(cmd.to_string_lossy().into()),
            target: None,
            args: None,
            name: Some(elevated_task_name(&program.id)),
            working_dir: Some(program.install_path.clone()),
            expected_sha256: None,
        },
        true,
    )
}

fn start_elevated_task(id: &str) -> anyhow::Result<()> {
    let mut command = Command::new("schtasks");
    command.args(["/Run", "/TN", &elevated_task_name(id)]);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    let status = command.status()?;
    if !status.success() {
        anyhow::bail!("could not start the saved administrator task");
    }
    Ok(())
}

pub fn elevated_task_registered(id: &str) -> bool {
    let mut command = Command::new("schtasks");
    command.args(["/Query", "/TN", &elevated_task_name(id)]);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    command.status().map(|s| s.success()).unwrap_or(false)
}

pub fn remove_elevated_task(id: &str) {
    if !elevated_task_registered(id) {
        return;
    }
    let job = crate::helper::HelperJob {
        action: "removeElevatedLaunch".into(),
        path: None,
        target: None,
        args: None,
        name: Some(elevated_task_name(id)),
        working_dir: None,
        expected_sha256: None,
    };
    if crate::helper::run_or_elevate(job.clone(), false).is_err() {
        let _ = crate::helper::run_or_elevate(job, true);
    }
}

fn wait_for_pid(program: &InstalledProgram) -> Option<u32> {
    for _ in 0..20 {
        if let Some(pid) = crate::procsnap::pids_for_program(program).into_iter().next() {
            return Some(pid);
        }
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    None
}

fn invocation(entry: &std::path::Path, install_dir: &PathBuf) -> anyhow::Result<(PathBuf, Vec<String>)> {
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
    Ok(match ext.as_str() {
        "ps1" => (
            PathBuf::from("powershell"),
            vec![
                "-STA".into(),
                "-NoProfile".into(),
                "-ExecutionPolicy".into(),
                "Bypass".into(),
                "-File".into(),
                entry.to_string_lossy().into_owned(),
            ],
        ),
        "py" => (python, vec![entry.to_string_lossy().into_owned()]),
        "js" | "mjs" | "cjs" => (node, vec![entry.to_string_lossy().into_owned()]),
        "cmd" | "bat" => (
            PathBuf::from("cmd"),
            vec!["/C".into(), entry.to_string_lossy().into_owned()],
        ),
        _ => (entry.to_path_buf(), Vec::new()),
    })
}

fn command_for_entry(entry: &std::path::Path, install_dir: &PathBuf) -> anyhow::Result<Command> {
    let runtimes = crate::runtime::load_resolved(install_dir);
    let (exe, args) = invocation(entry, install_dir)?;
    let mut cmd = Command::new(exe);
    cmd.args(args);
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
