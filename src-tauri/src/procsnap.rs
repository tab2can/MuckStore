use crate::models::InstalledProgram;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

fn norm_path(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    resolved
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn is_store_name(name: &str) -> bool {
    matches!(name, "muck-store.exe" | "muck-updater.exe" | "muck-store" | "muck-updater")
}

fn is_host_runtime(name: &str) -> bool {
    matches!(
        name,
        "powershell.exe"
            | "pwsh.exe"
            | "cmd.exe"
            | "conhost.exe"
            | "python.exe"
            | "pythonw.exe"
            | "node.exe"
            | "powershell"
            | "pwsh"
            | "cmd"
            | "python"
            | "pythonw"
            | "node"
    )
}

fn process_name(proc: &sysinfo::Process) -> String {
    proc.name().to_string_lossy().to_ascii_lowercase()
}

fn process_cmd(proc: &sysinfo::Process) -> String {
    proc.cmd()
        .iter()
        .map(|s| s.to_string_lossy().replace('/', "\\").to_ascii_lowercase())
        .collect::<Vec<_>>()
        .join(" ")
}

fn belongs_to_install(proc: &sysinfo::Process, install_n: &str, entry_n: &str, entry_name: &str) -> bool {
    if !install_n.is_empty() {
        if let Some(exe) = proc.exe() {
            let exe_n = norm_path(exe);
            if exe_n == *install_n || exe_n.starts_with(&format!("{install_n}\\")) {
                return true;
            }
        }
        if let Some(cwd) = proc.cwd() {
            let cwd_n = norm_path(cwd);
            if cwd_n == *install_n || cwd_n.starts_with(&format!("{install_n}\\")) {
                return true;
            }
        }
    }
    let cmd = process_cmd(proc);
    if !entry_n.is_empty() && cmd.contains(entry_n) {
        return true;
    }
    if !install_n.is_empty() && cmd.contains(install_n) {
        return true;
    }
    let name = process_name(proc);
    if !entry_name.is_empty() && !is_host_runtime(&name) && name == entry_name {
        return true;
    }
    false
}

fn snapshot() -> System {
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing()
            .with_exe(UpdateKind::OnlyIfNotSet)
            .with_cmd(UpdateKind::OnlyIfNotSet)
            .with_cwd(UpdateKind::OnlyIfNotSet),
    );
    sys
}

fn expand_tree(sys: &System, seeds: &HashSet<u32>, self_pid: u32) -> HashSet<u32> {
    let mut live: HashSet<u32> = seeds
        .iter()
        .copied()
        .filter(|pid| *pid != 0 && *pid != self_pid && sys.process(Pid::from_u32(*pid)).is_some())
        .collect();
    let mut changed = true;
    while changed {
        changed = false;
        for (pid, proc) in sys.processes() {
            let pid_u = pid.as_u32();
            if pid_u == self_pid || live.contains(&pid_u) {
                continue;
            }
            let name = process_name(proc);
            if is_store_name(&name) {
                continue;
            }
            if let Some(exe) = proc.exe() {
                if is_store_name(&exe.file_name().and_then(|n| n.to_str()).unwrap_or("").to_ascii_lowercase()) {
                    continue;
                }
            }
            let Some(parent) = proc.parent() else {
                continue;
            };
            let parent_u = parent.as_u32();
            if seeds.contains(&parent_u) || live.contains(&parent_u) {
                live.insert(pid_u);
                changed = true;
            }
        }
    }
    live
}

pub fn pids_for_program(program: &InstalledProgram) -> Vec<u32> {
    pids_for_program_from(program, &[])
}

pub fn pids_for_program_from(program: &InstalledProgram, ancestors: &[u32]) -> Vec<u32> {
    let install = PathBuf::from(&program.install_path);
    let entry = install.join(&program.manifest.entry);
    let install_n = norm_path(&install);
    let entry_n = norm_path(&entry);
    let entry_name = Path::new(&program.manifest.entry)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let self_pid = std::process::id();
    let sys = snapshot();
    let mut seeds: HashSet<u32> = ancestors.iter().copied().filter(|p| *p != 0 && *p != self_pid).collect();
    for (pid, proc) in sys.processes() {
        let pid_u = pid.as_u32();
        if pid_u == self_pid {
            continue;
        }
        let name = process_name(proc);
        if is_store_name(&name) {
            continue;
        }
        if let Some(exe) = proc.exe() {
            if is_store_name(
                &exe.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_ascii_lowercase(),
            ) {
                continue;
            }
        }
        if belongs_to_install(proc, &install_n, &entry_n, &entry_name) {
            seeds.insert(pid_u);
        }
    }
    let mut pids: Vec<u32> = expand_tree(&sys, &seeds, self_pid).into_iter().collect();
    pids.sort_unstable();
    pids
}

pub fn kill_pids(pids: &[u32]) {
    if pids.is_empty() {
        return;
    }
    let mut sys = snapshot();
    for pid in pids.iter().rev() {
        if let Some(proc) = sys.process(Pid::from_u32(*pid)) {
            let _ = proc.kill();
        }
    }
    std::thread::sleep(std::time::Duration::from_millis(80));
    sys.refresh_processes_specifics(
        ProcessesToUpdate::All,
        true,
        ProcessRefreshKind::nothing()
            .with_exe(UpdateKind::OnlyIfNotSet)
            .with_cmd(UpdateKind::OnlyIfNotSet)
            .with_cwd(UpdateKind::OnlyIfNotSet),
    );
    for pid in pids {
        if let Some(proc) = sys.process(Pid::from_u32(*pid)) {
            let _ = proc.kill();
        }
    }
}
