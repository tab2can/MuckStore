#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod splash;
mod update;

fn main() {
    let splash = splash::Splash::show();
    let outcome = update::run(|status, progress| {
        splash.set(status, progress);
    });
    splash.close();
    match outcome {
        update::Outcome::Launch => update::launch_store(),
        update::Outcome::InstallerStarted => {}
        update::Outcome::Failed(msg) => {
            splash::alert(&msg);
            update::launch_store();
        }
    }
}
