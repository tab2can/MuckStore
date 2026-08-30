# Muck Store

Open-source program store and distribution layer for Windows. Developers write normal programs in any language. Muck Store discovers them on GitHub, installs only what the manifest declares, and lets the user start, stop, update, and configure them.

Official programs ship in this repository. Third-party programs must be public GitHub repositories with a `muck.json` file. Release binaries must be built and attested by **GitHub Actions in that same repo** — a zip dropped onto Releases is not enough. Muck Store verifies provenance on the client (no Muck server), then you approve the install.

## Install (Windows 10 and 11)

Download an installer from [Releases](https://github.com/tab2can/MuckStore/releases). Every push to `main` also builds installers as [Actions artifacts](https://github.com/tab2can/MuckStore/actions).

- **x64 `.exe`** — 64-bit Windows 10 and 11
- **x86 `.exe`** — 32-bit Windows 10 (Windows 11 is 64-bit only)

The Start Menu opens **muck-updater.exe** (small splash). It checks GitHub for a newer store build, installs it when **Update the store automatically** is on, then launches the store. Catalog program updates stay in **Updates** inside the app.

On Windows 10, the installer bootstraps WebView2 if it is missing.

### Data folders

| Location | Role |
| --- | --- |
| `%LOCALAPPDATA%\Muck Store\` or `Program Files\Muck Store\` | The store application |
| `%LOCALAPPDATA%\MuckStore\` | Programs, cache, logs, runtimes |
| `%APPDATA%\MuckStore\` | Settings, approval ledger, themes |

Shipping a catalog program: [docs/reproducible-builds.md](docs/reproducible-builds.md). Shipping Muck Store itself: [docs/releasing.md](docs/releasing.md).

## Develop

Requires Windows 10/11, [Node.js](https://nodejs.org/) 20+, [Rust](https://rustup.rs/) 1.77+.

```bash
npm install
npm run tauri dev
```

UI-only (browser mock, no installer):

```bash
npm run dev
```

Validate sample manifests:

```bash
npm run validate
```

How to ship a GitHub Release that the store will accept: [docs/reproducible-builds.md](docs/reproducible-builds.md).

## Layout

- `src/` — React shell
- `src-tauri/` — Rust engine (catalog, install, process, helper/UAC)
- `src-tauri/updater/` — standalone splash updater (`muck-updater.exe`)
- `src-tauri/windows/` — NSIS header/sidebar bitmaps and installer hooks
- `schema/` — `muck.json` and theme JSON Schema
- `catalog/` — official and community indexes
- `programs/` — first-party samples and an untrusted demo
- `cli/muck-validate.mjs` — publisher checks
- `docs/` — developer, security, release, and theme guides
- `packaging/` — Authenticode / MSIX drafts (certificate not included)

## License

MIT. Programs keep their own licenses.
