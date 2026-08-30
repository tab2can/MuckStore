fn main() {
    let conf = std::fs::read_to_string("../tauri.conf.json").unwrap_or_default();
    let version = conf
        .lines()
        .find_map(|line| {
            let line = line.trim();
            if line.starts_with("\"version\"") {
                line.split('"').nth(3).map(str::to_string)
            } else {
                None
            }
        })
        .unwrap_or_else(|| "0.1.0".into());
    println!("cargo:rustc-env=MUCK_STORE_VERSION={version}");
    println!("cargo:rerun-if-changed=../tauri.conf.json");
}
