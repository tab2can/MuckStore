import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const triple =
  process.env.TAURI_ENV_TARGET_TRIPLE ||
  execSync("rustc -vV", { encoding: "utf8" }).match(/host: (\S+)/)?.[1];

if (!triple) {
  console.error("could not detect Rust target triple");
  process.exit(1);
}

const cargoArgs = [
  "build",
  "--release",
  "-p",
  "muck-updater",
  "--manifest-path",
  "src-tauri/Cargo.toml",
];
if (process.env.TAURI_ENV_TARGET_TRIPLE) {
  cargoArgs.push("--target", triple);
}

execSync(`cargo ${cargoArgs.join(" ")}`, { stdio: "inherit", cwd: root });

const targetDir = process.env.CARGO_TARGET_DIR;
const candidates = [
  targetDir && join(targetDir, triple, "release", "muck-updater.exe"),
  targetDir && join(targetDir, "release", "muck-updater.exe"),
  join(root, "src-tauri", "target", triple, "release", "muck-updater.exe"),
  join(root, "src-tauri", "target", "release", "muck-updater.exe"),
  join(root, "src-tauri", "updater", "target", triple, "release", "muck-updater.exe"),
  join(root, "src-tauri", "updater", "target", "release", "muck-updater.exe"),
].filter(Boolean);
const built = candidates.find((p) => existsSync(p));
if (!built) {
  console.error("muck-updater.exe not found after build. looked in:\n", candidates.join("\n"));
  process.exit(1);
}

const destDir = join(root, "src-tauri", "binaries");
mkdirSync(destDir, { recursive: true });
const dest = join(destDir, `muck-updater-${triple}.exe`);
copyFileSync(built, dest);
console.log("sidecar", dest);
