fn main() {
    ensure_updater_sidecar();
    tauri_build::build();
}

fn ensure_updater_sidecar() {
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let triple = std::env::var("TAURI_ENV_TARGET_TRIPLE").unwrap_or_else(|_| {
        if cfg!(target_arch = "x86") {
            "i686-pc-windows-msvc".into()
        } else {
            "x86_64-pc-windows-msvc".into()
        }
    });
    let dest = manifest
        .join("binaries")
        .join(format!("muck-updater-{triple}.exe"));
    if dest.exists() {
        return;
    }
    let _ = std::fs::create_dir_all(dest.parent().unwrap());
    let _ = std::fs::write(&dest, []);
}
