mod archive;
mod attest;
mod catalog;
mod commands;
mod error;
pub mod helper;
mod install;
mod models;
mod paths;
mod process;
mod runtime;
mod security;
mod settings;
mod state;
mod theme;
mod trust;
mod update;
mod verify;

use settings::load_store_settings;
use state::AppState;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

pub fn run() {
    let settings = load_store_settings();
    let _ = paths::ensure_dirs(settings.install_path.as_deref());
    let start_minimized = settings.start_minimized;
    let tray_enabled = settings.tray_enabled;

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState::new(settings))
        .invoke_handler(tauri::generate_handler![
            commands::get_store_settings,
            commands::save_store_settings,
            commands::get_app_paths,
            commands::official_catalog,
            commands::community_catalog,
            commands::search_github,
            commands::fetch_github_program,
            commands::get_program,
            commands::verify_program,
            commands::list_trust,
            commands::revoke_trust,
            commands::install_program,
            commands::uninstall_program,
            commands::rollback_program,
            commands::list_installed,
            commands::start_program,
            commands::stop_program,
            commands::restart_program,
            commands::program_status,
            commands::program_logs,
            commands::get_program_settings,
            commands::save_program_settings,
            commands::check_updates,
            commands::apply_program_update,
            commands::list_program_releases,
            commands::save_program_install_options,
            commands::list_themes,
            commands::import_theme,
            commands::save_theme,
            commands::delete_theme,
            commands::sideload_program,
            commands::open_path,
            commands::clear_cache,
            commands::set_defender_exclusion,
            commands::set_autostart_program,
            commands::set_program_enabled,
            commands::validate_manifest_path,
            commands::search_theme_github,
            commands::launch_store_updater,
        ])
        .setup(move |app| {
            apply_tray(app.handle(), tray_enabled)?;

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_background_color(Some(tauri::window::Color(0, 0, 0, 0)));
                if start_minimized && tray_enabled {
                    let _ = win.hide();
                }
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    let state = handle.state::<AppState>();
                    let exited = state.processes.lock().poll_exits();
                    for id in exited {
                        let registry = settings::load_registry();
                        if let Some(inst) = registry.programs.get(&id) {
                            let policy = inst
                                .manifest
                                .watchdog
                                .as_ref()
                                .and_then(|w| w.on_crash.clone())
                                .unwrap_or_else(|| "notify".into());
                            let max = inst
                                .manifest
                                .watchdog
                                .as_ref()
                                .and_then(|w| w.max_restarts)
                                .unwrap_or(3);
                            if policy == "restart" {
                                let mut mgr = state.processes.lock();
                                if let Some(running) = mgr.children.get(&id) {
                                    if running.restarts >= max {
                                        let _ = handle.emit("program-crashed", &id);
                                        continue;
                                    }
                                }
                                if mgr.start(inst, false).is_ok() {
                                    if let Some(r) = mgr.children.get_mut(&id) {
                                        r.restarts += 1;
                                    }
                                }
                            } else if policy != "off" {
                                let quiet = crate::security::is_quiet_hours(
                                    state.settings.lock().quiet_hours_start.as_deref(),
                                    state.settings.lock().quiet_hours_end.as_deref(),
                                );
                                if !quiet {
                                    let _ = handle.emit("program-crashed", &id);
                                }
                            }
                        }
                    }
                }
            });

            autostart_enabled_programs(app);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let hide = window.state::<AppState>().settings.lock().tray_enabled;
                if hide {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Muck Store");
}

pub(crate) fn apply_tray(app: &tauri::AppHandle, enabled: bool) -> tauri::Result<()> {
    if !enabled {
        let _ = app.remove_tray_by_id("main");
        return Ok(());
    }
    if app.tray_by_id("main").is_some() {
        return Ok(());
    }

    let show = MenuItem::with_id(app, "show", "Show Muck Store", true, None::<&str>)?;
    let updates = MenuItem::with_id(app, "updates", "Check for updates", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &updates, &quit])?;
    TrayIconBuilder::with_id("main")
        .icon(app.default_window_icon().cloned().unwrap())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
            "updates" => {
                let _ = app.emit("tray-check-updates", ());
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.show();
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                if button == tauri::tray::MouseButton::Left {
                    let app = tray.app_handle();
                    if let Some(win) = app.get_webview_window("main") {
                        if win.is_visible().unwrap_or(false) {
                            let _ = win.hide();
                        } else {
                            let _ = win.show();
                            let _ = win.set_focus();
                        }
                    }
                }
            }
        })
        .build(app)?;
    Ok(())
}

fn autostart_enabled_programs(app: &tauri::App) {
    let state = app.state::<AppState>();
    let registry = settings::load_registry();
    let isolation = state.settings.lock().isolation_job_object;
    for inst in registry.programs.values() {
        if inst.autostart && inst.enabled {
            let _ = state.processes.lock().start(inst, isolation);
        }
    }
}
