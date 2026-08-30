#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if let Some(i) = args.iter().position(|a| a == "--helper-job") {
        let job = args.get(i + 1).expect("missing --helper-job path");
        if let Err(e) = muck_store_lib::helper::run_job(std::path::Path::new(job)) {
            eprintln!("{e}");
            std::process::exit(1);
        }
        return;
    }

    #[cfg(all(windows, not(debug_assertions)))]
    {
        if !args.iter().any(|a| a == "--from-updater") {
            if let Some(dir) = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            {
                let updater = dir.join("muck-updater.exe");
                if updater.exists() {
                    let _ = std::process::Command::new(updater).spawn();
                    return;
                }
            }
        }
    }

    muck_store_lib::run();
}
