use crate::models::InstalledProgram;
use std::path::{Path, PathBuf};
use sysinfo::{Pid, ProcessesToUpdate, System};

fn norm_path(path: &Path) -> String {
    let resolved = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    resolved
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_ascii_lowercase()
}

fn is_store_binary(path: &Path) -> bool {
    matches!(
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "muck-store.exe" | "muck-updater.exe"
    )
}

pub fn pids_for_program(program: &InstalledProgram) -> Vec<u32> {
    let install = PathBuf::from(&program.install_path);
    let entry = install.join(&program.manifest.entry);
    let install_n = norm_path(&install);
    let entry_n = norm_path(&entry);
    let self_pid = std::process::id();
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    let mut pids = Vec::new();
    for (pid, proc) in sys.processes() {
        let pid_u = pid.as_u32();
        if pid_u == self_pid {
            continue;
        }
        let Some(exe) = proc.exe() else {
            continue;
        };
        if is_store_binary(exe) {
            continue;
        }
        let exe_n = norm_path(exe);
        let under_install = !install_n.is_empty()
            && (exe_n == install_n || exe_n.starts_with(&format!("{install_n}\\")));
        let cmd = proc
            .cmd()
            .iter()
            .map(|s| s.to_string_lossy().replace('/', "\\").to_ascii_lowercase())
            .collect::<Vec<_>>()
            .join(" ");
        let mentions_entry = !entry_n.is_empty() && cmd.contains(&entry_n);
        if under_install || mentions_entry {
            pids.push(pid_u);
        }
    }
    pids.sort_unstable();
    pids.dedup();
    pids
}

pub fn kill_pids(pids: &[u32]) {
    if pids.is_empty() {
        return;
    }
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    for pid in pids {
        if let Some(proc) = sys.process(Pid::from_u32(*pid)) {
            let _ = proc.kill();
        }
    }
}
