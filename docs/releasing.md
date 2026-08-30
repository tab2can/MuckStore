# Release (Muck Store itself)

Every push to `main` builds Windows installers on GitHub Actions and uploads them as workflow artifacts. A version tag (`v*`) also publishes a GitHub Release, attests the files, and updates `latest.json` for **muck-updater.exe**.

```bash
# bump version in package.json, src-tauri/tauri.conf.json, and src-tauri/Cargo.toml
git add -A
git commit -m "Release v0.2.0"
git tag v0.2.0
git push origin HEAD
git push origin v0.2.0
```

## Installers

| File | Who |
| --- | --- |
| `Muck Store_x.y.z_x64-setup.exe` | 64-bit Windows 10/11 |
| `Muck Store_x.y.z_x86-setup.exe` | 32-bit Windows 10 |

Windows 11 is 64-bit only. WebView2 is installed by the bootstrapper if missing (Windows 10).

The Start Menu / Desktop shortcut targets `muck-updater.exe` (store icon). The store exe still bounces to the updater if you launch it directly.

## Where files go

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\Muck Store\` (NSIS per-user) or `Program Files\Muck Store\` | Store app + `muck-updater.exe` |
| `%LOCALAPPDATA%\MuckStore\programs\` | Installed catalog programs |
| `%LOCALAPPDATA%\MuckStore\cache\` | GitHub and download cache |
| `%LOCALAPPDATA%\MuckStore\logs\` | Program logs |
| `%LOCALAPPDATA%\MuckStore\runtimes\` | Python/Node bootstrap |
| `%APPDATA%\MuckStore\` | `store-settings.json`, `installed.json`, `trust.json` |
| `%APPDATA%\MuckStore\config\` | Per-program settings |
| `%APPDATA%\MuckStore\themes\` | Imported themes |

## Secrets

Repo secrets (Settings → Secrets and variables → Actions):

- `TAURI_SIGNING_PRIVATE_KEY` — contents of `src-tauri/updater.key` (never commit this file)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — key password (empty if none)

The matching public key is in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`. It signs `latest.json` artifacts. The splash updater is a separate binary, not the in-app plugin.
