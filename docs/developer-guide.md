# Developer guide — shipping a program on Muck Store

This is the playbook. Follow it in order the first time. Later sections are reference.

Muck Store has **no SDK and no backend**. You write a normal Windows program in any language. The store finds it on public GitHub, verifies `muck.json`, installs only what you declared, and lets the user start, stop, update, and configure it.

Related docs:

- Field-by-field manifest: [manifest-spec.md](manifest-spec.md)
- Release binaries and attestations: [reproducible-builds.md](reproducible-builds.md)
- Trust model: [security.md](security.md)
- Themes (not programs): [themes.md](themes.md)
- Canonical schema: [`schema/muck.schema.json`](../schema/muck.schema.json)

---

## 1. What you are shipping

A **Muck program** is:

1. Source in a **public** GitHub repository (`owner/repo`).
2. A **`muck.json`** at the repo root (or `.muck/muck.json`).
3. A **`LICENSE` / `COPYING`** file.
4. An **entry** the store can launch (`exe`, `.ps1`, `.py`, `.js`, `.cmd`, …).
5. For anything downloaded from **GitHub Releases**: a GitHub Actions workflow in **this same repo** that **builds, attests, and uploads** the file. A zip you built on a laptop and attached by hand is **rejected**.

The user never talks to a Muck server. The client talks to GitHub.

There are three ways a program appears in the store:

| Path | Who | How the payload arrives |
| --- | --- | --- |
| **Community (normal)** | You, on your own repo | Discover search (`topic:muck-store`) or paste `owner/repo`. Install downloads the attested Release asset (or copies a portable tree if you only ship source — see install kinds). |
| **Official catalog** | Muck maintainers | Listed in [`catalog/official.json`](../catalog/official.json) and copied from this checkout (`localResource`). No Release download. |
| **Sideload** | You, on your PC | Settings → Developer mode → sideload a local folder. For development only. Does not replace attestation for GitHub installs. |

If you are publishing a real app for other people, you want **community + GitHub Releases + Actions attestation**.

---

## 2. First-time checklist

Do these in this order. Skip nothing on the first release.

1. Create a **public** GitHub repo. Private repos fail verification.
2. Put the program files in the repo. The store will launch `entry` **relative to the install folder**.
3. Add `muck.json` (copy the template in [§4](#4-minimum-muckjson) and fill every required field).
4. Add `LICENSE` (or `LICENSE.md` / `LICENSE.txt` / `COPYING`). Put an SPDX id in `license` (for example `MIT`).
5. Declare **every** capability in `permissions`. The user sees them before install.
6. If you ship a zip/msi/nsis/inno:
   - Copy [`docs/examples/release.yml`](examples/release.yml) to `.github/workflows/release.yml`.
   - Replace the **Build** step with your real build.
   - Set `install.kind`, `install.assets[]` (`file`, `platform`, `sha256`), and `build.workflow`.
   - Pin Actions to commit SHAs before you tag.
7. Add GitHub topic **`muck-store`** (repo → About → Topics) so Discover can find you.
8. Add a `README.md`. The program page renders it. Screenshots in the readme (`![alt](path.png)`) show in the gallery.
9. Run locally:

   ```bash
   node cli/muck-validate.mjs .
   ```

   (from this Muck Store checkout, pointing at your program folder; or copy `schema/muck.schema.json` and run the same CLI.)
10. Tag `v1.0.0` (semver). The workflow must attest the **same bytes** it uploads.
11. Copy the SHA-256 from the Actions log into `install.assets[].sha256`, commit, and tag again if the first tag was a dry run. Keep tag, asset name, and hash in lockstep.
12. In Muck Store: Discover → paste `owner/repo` → Install → approve the trust dialog.

Sideload path for step 12 while iterating: Settings → Developer → sideload the folder. Sideload skips GitHub attestation.

---

## 3. Repository layout

The store looks on the **default branch** for:

| File | Required |
| --- | --- |
| `muck.json` or `.muck/muck.json` | Yes |
| `LICENSE`, `LICENSE.md`, `LICENSE.txt`, or `COPYING` | Yes (`muck validate`) |
| `README.md` | Strongly recommended (program page) |
| `.github/workflows/release.yml` | Yes if you have Release assets |
| Screenshot files referenced from `ui.screenshots` or the readme | Optional |

Suggested tree for a zip-based app:

```
my-app/
  muck.json
  LICENSE
  README.md
  src/                  # your source
  .github/workflows/release.yml
```

Suggested tree for a portable official-style sample (folder copy, no Release):

```
my-app/
  muck.json
  LICENSE
  app.exe               # or notes.ps1
  README.md
```

`entry` is a path **inside the installed payload**, not a URL. After install the working directory is the install folder:

`%LOCALAPPDATA%\MuckStore\programs\{id}\{version}\`

---

## 4. Minimum `muck.json`

Required: `id`, `name`, `version`, `license`, `summary`, `source.github`, `entry`, `install.kind`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "id": "com.example.my-app",
  "name": "My App",
  "version": "1.0.0",
  "license": "MIT",
  "summary": "One sentence, 8–280 characters, shown on cards.",
  "source": { "github": "example/my-app" },
  "entry": "my-app.exe",
  "install": { "kind": "portable" },
  "permissions": []
}
```

That minimum is enough for **sideload** and for **official catalog copies**. It is **not** enough for a community GitHub Release zip.

### Community Release binary (what most developers need)

```json
{
  "id": "com.example.my-app",
  "name": "My App",
  "version": "1.0.0",
  "license": "MIT",
  "summary": "One sentence, 8–280 characters, shown on cards.",
  "source": { "github": "example/my-app" },
  "entry": "my-app.exe",
  "install": {
    "kind": "archive",
    "assets": [
      {
        "file": "my-app.zip",
        "platform": "windows-x64",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    ],
    "shortcuts": { "startMenu": true, "desktop": false }
  },
  "build": {
    "workflow": ".github/workflows/release.yml",
    "reproducible": true,
    "attestations": "required"
  },
  "permissions": ["filesystem"],
  "update": { "channel": "github-releases" }
}
```

Rules you will hit if you skip them:

- `id` is reverse-DNS, lowercase: `com.author.program` (must contain a `.`).
- `version` is semver: `1.2.0`, optional pre-release `1.2.0-beta.1`.
- `source.github` is `owner/repo` only (no `https://github.com/`).
- `summary` is at least 8 characters.
- `install.assets[].sha256` is 64 hex characters of the **attested file**.
- `file` must match the GitHub Release asset name exactly.
- `build.workflow` must contain `.github/workflows/`.
- `build.reproducible` cannot be `false`. `build.attestations` must be `required` if present.

Full field list: [manifest-spec.md](manifest-spec.md).

---

## 5. How the store launches your program

The store does **not** inject a runtime into your process beyond environment variables and optional argv.

### Entry file

`entry` is resolved as `{installDir}/{entry}`.

| Extension | How it is started |
| --- | --- |
| `.exe` / anything else | Direct `CreateProcess` on that file |
| `.ps1` | `powershell -STA -NoProfile -ExecutionPolicy Bypass -File {entry}` |
| `.py` | `python` from `runtimes` or PATH |
| `.js` / `.mjs` / `.cjs` | `node` from `runtimes` or PATH |
| `.cmd` / `.bat` | `cmd /C {entry}` |

Working directory is the install folder. Stdin is closed. Stdout/stderr append to:

`%LOCALAPPDATA%\MuckStore\logs\{id}.log`

GUI `.ps1` / `.pyw` / `.hta` are started detached so the store window does not wait on them.

If the user disabled the program in Program Settings, it will not start. If they set **launch arguments**, those tokens are appended to the command (quotes are supported).

### Environment

Always set:

| Variable | Example | Meaning |
| --- | --- | --- |
| `MUCK_PROGRAM_DIR` | `%LOCALAPPDATA%\MuckStore\programs\com.example.my-app\1.0.0` | Install directory |
| `MUCK_PROGRAM_ID` | `com.example.my-app` | Reverse-DNS id |
| `MUCK_SETTINGS_PATH` | `%APPDATA%\MuckStore\config\com.example.my-app.json` | Your settings JSON |

Read `MUCK_SETTINGS_PATH` in any language. If the file is missing, use your own defaults.

PowerShell (from the official sample):

```powershell
$settingsPath = $env:MUCK_SETTINGS_PATH
if ($settingsPath -and (Test-Path $settingsPath)) {
  $s = Get-Content -Path $settingsPath -Raw | ConvertFrom-Json
}
```

### Your JSON settings vs the store Program Settings panel

These are **two different things**. Do not confuse them.

**Store Program Settings** (Library ⋯ → Settings, or the program page → Settings) is Muck’s own sheet:

- Version lock (`pinnedVersion`) — skipped by update checks
- Version picker (GitHub Releases) — installs that tag
- Launch arguments — passed on start (`-test`, `"path with spaces"`)
- Channel — stable vs preview (prerelease tags)
- Enabled / Start with Windows
- Open install folder

The store **does not** render `settings.schema` as a form anymore. Schema is still useful:

- On **first install**, if `settings.schema` exists and `{id}.json` does not, the store writes defaults from each property’s `default`.
- Your program reads that JSON via `MUCK_SETTINGS_PATH`.
- If you want a GUI for those keys, **build it in your program**. Users can also edit the JSON by hand.

---

## 6. Permissions

Declare every capability you actually use. The trust dialog lists them. Missing a declaration does not sandbox you (Windows does not enforce this list); it **does** fail honesty checks and can warn on dangerous ones.

| Permission | Declare when |
| --- | --- |
| `network` | You talk to the internet |
| `filesystem` | You read/write files outside the install folder (typical for notes, configs) |
| `autostart` | You want “Start with Windows” in Program Settings. Without this, the switch is disabled |
| `clipboard` | Clipboard access |
| `notifications` | Toast / tray notifications |
| `screenshot` | Capture the screen |
| `input-hook` | Global hotkeys / low-level input |
| `shell-integration` | Taskbar, Explorer, file associations |
| `other-process` | You start/stop other processes |
| `windows-settings` | You change OS settings |
| `admin` | You need elevation. Triggers UAC via the store helper (`--helper-job`) |

Dangerous permissions (`admin`, `input-hook`, `shell-integration`, `other-process`, `windows-settings`) produce a **warning** on the verify report. They do not auto-block, but the user must still approve.

`filesystemPaths` is optional documentation (path patterns). It is not a Windows ACL.

**Autostart:** the store only creates a logon entry if `autostart` is declared **and** the user turns the switch on. Do not also ship your own Run-key installer unless you declared `windows-settings` / `admin` and explained it.

---

## 7. Install kinds — pick one

| `install.kind` | Payload | Attestation |
| --- | --- | --- |
| `portable` | Folder copy (official / sideload). If you **also** list hashed `assets`, those assets need Actions + attestation | Only if `assets` is non-empty |
| `archive` | Zip from GitHub Releases, extracted into the version folder | **Required** |
| `msi` / `nsis` / `inno` | Installer run silently into the version folder | **Required** |
| `runtime` | Payload plus Python/Node bootstrap | Required when `assets` present |
| `script` | Only a hash-pinned `postinstall` | Hash required on the script |

### `archive` (recommended for most apps)

1. CI builds a zip whose **root contents** are what should appear in the install folder (`my-app.exe` at the zip root, or a single top folder you are happy to extract).
2. Asset `file` is `my-app.zip`.
3. `entry` is `my-app.exe` (or `bin/my-app.exe` if that is how the zip is laid out).
4. Platform: `windows-x64` (current client) or `any`.

Do **not** zip the file again after attesting. Attest the exact file you upload.

### `msi` / `nsis` / `inno`

The helper runs the installer elevated if `admin` is declared. Pass silent flags in `install.silentArgs` (or `installdirProperty` as a fallback). The target directory is the Muck version folder. Your installer must accept that directory.

### `postinstall`

Optional script after extract/install. **Must** have `postinstallSha256`. The helper refuses an unhashed script. Path is relative to the install folder.

### Shortcuts

```json
"shortcuts": { "startMenu": true, "desktop": false }
```

Defaults: Start Menu on, desktop off.

---

## 8. GitHub Releases, Actions, and attestations

Full recipe: [reproducible-builds.md](reproducible-builds.md). The store **does not** trust a Release just because the file is attached.

Minimum:

1. Workflow lives in **this** repository under `.github/workflows/`.
2. Job permissions: `id-token: write`, `attestations: write`, `contents: write`.
3. Build the asset.
4. `actions/attest` (or `actions/attest-build-provenance`) with `subject-path` = that file.
5. `gh release create` uploads **the same file**.
6. Put the SHA-256 into `muck.json`.
7. Tag `vMAJOR.MINOR.PATCH`. The store compares versions with semver (`v` prefix ignored).

Local check (optional):

```bash
gh attestation verify my-app.zip --repo owner/repo
```

The client also calls `GET /repos/{owner}/{repo}/attestations/sha256:{digest}` and checks:

- Subject digest = file on disk = `install.assets[].sha256`
- Provenance `workflow.repository` = `source.github`
- Provenance `workflow.path` = `build.workflow`

Self-hosted runners are accepted with a **warning**. Prefer `runs-on: windows-latest`.

Pin `uses:` lines to **commit SHAs** before a public tag. Moving tags (`@v4`) are fine while you iterate; they are not fine for a store-ready release.

---

## 9. Updates

The store checks **GitHub Releases** for installed programs (unless version-locked).

| You do | Store does |
| --- | --- |
| Tag `v1.2.0` and attach the attested asset named in `muck.json` | Compare tag to installed version with semver |
| Bump `version` in `muck.json` on the default branch | Catalog / Discover show the new version string from the manifest |
| Set `update.includePrerelease` or the user picks **Preview** | Prerelease tags are considered |
| User locks a version in Program Settings | `check_program_updates` skips apply; the row shows as locked |

`update.channel` today is only `github-releases`.

Store-app updates (Muck itself) are a separate updater exe. Your program is unrelated to `storeUpdatePolicy`.

If the user has **program update policy** Automatic, unlocked program updates install in the background. Startup-only and Manual wait for the user. You do not implement this; just ship tagged Releases.

Keep `install.assets[].file` stable across versions when you can (`my-app.zip`). If you rename the asset, update `muck.json` on the default branch **before** users check for updates, or verify will fail “declared assets are not attached”.

---

## 10. Discoverability

Discover search is GitHub:

```
topic:muck-store <user query>
```

Empty query lists `topic:muck-store`.

You **must** add the topic `muck-store` on the GitHub repo, or users will only find you by pasting `owner/repo` (Discover has a dedicated GitHub field).

The default branch must serve a valid `muck.json`. If the topic matches but the manifest is missing, Discover shows a stub tagged `incomplete` that cannot install cleanly.

README.md on the default branch is fetched for the program page. Relative image paths resolve to:

`https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{path}`

Same for `ui.icon` and `ui.screenshots` when they are not already `https://` or `data:`.

---

## 11. Local testing (sideload)

1. Install Muck Store (or `npm run tauri dev` from this repo).
2. Settings → Developer → enable developer mode.
3. Sideload the folder that contains `muck.json`.
4. Library → Start. Check `%LOCALAPPDATA%\MuckStore\logs\{id}.log` if it does not appear.
5. Program Settings → launch arguments, then Start again.

Sideload requires developer mode. It copies the folder into `programs\{id}\{version}`. It does **not** prove GitHub Actions provenance. Ship a real Release before asking other people to install from GitHub.

Validate without the store:

```bash
node cli/muck-validate.mjs path/to/your-program
```

From the Muck Store repo, `npm run validate` checks bundled samples.

---

## 12. Runtimes

If `entry` is `.py` / `.js` and you do not want to require a system install:

```json
"runtimes": [
  { "id": "python", "version": "3.12.7", "strategy": "download" }
]
```

| `id` | Role |
| --- | --- |
| `python` | Used for `.py` |
| `node` | Used for `.js` / `.mjs` / `.cjs` |
| `dotnet` | PATH helper for .NET hosts |

`strategy`: `system` (default, fail if missing), `download` (embed zip under `%LOCALAPPDATA%\MuckStore\runtimes\`), `bundle` (you included the runtime in the payload).

Prefer shipping a self-contained `exe` if you can. Downloaded runtimes add size and a second moving part.

---

## 13. Watchdog, i18n, UI chrome

### Crash policy

```json
"watchdog": { "onCrash": "notify", "maxRestarts": 3 }
```

| `onCrash` | Behavior |
| --- | --- |
| `notify` (default) | Store emits a crash event (quiet hours respected) |
| `restart` | Store restarts up to `maxRestarts` (0–20, default 3) |
| `off` | Nothing |

This only applies to processes **the store started**. If the user closed the program, that is not a crash restart loop you should rely on for normal quit.

### Translations

```json
"i18n": {
  "tr": {
    "name": "Uygulamam",
    "summary": "Kartlarda görünen kısa cümle."
  }
}
```

Keys are locale codes (`tr`, `en`). Used for name/summary/description in the store UI.

### Icon and screenshots

```json
"ui": {
  "icon": "docs/icon.png",
  "screenshots": ["docs/shot1.png", "docs/shot2.png"],
  "accent": "#d4a056"
}
```

Relative paths are loaded from `HEAD` on GitHub. Absolute `https://` URLs are used as-is.

---

## 14. What the user sees (so you can debug support tickets)

1. **Discover / Home** — your card (name, summary, stars, official/community badge).
2. **Program page** — README, permissions chips, Install.
3. **Verify** — public repo, license, hashes, attestation, permissions. Any `fail` **blocks**. Official catalog copies skip Release attestation and copy from the store checkout.
4. **Trust dialog** (community) — user must approve. Recorded in `%APPDATA%\MuckStore\trust.json` for this **id + version + commit**. A new version asks again.
5. **Install** — download, hash, attest again on disk, strip Mark-of-the-Web, write `installed.json`.
6. **Library** — Start / Stop / Settings / Uninstall.
7. **Updates** — Settings → Updates. Locked versions cannot be batch-updated.

Mark-of-the-Web is cleared **after** approval so SmartScreen is not the install UI. Defender still scans. The store never silently adds a Defender exclusion.

---

## 15. Common failures

| Symptom | Likely cause |
| --- | --- |
| Discover cannot find you | Missing GitHub topic `muck-store` |
| Paste `owner/repo` fails | Private repo, or no `muck.json` on the default branch |
| Install blocked: attestation | Hand-uploaded Release, wrong `build.workflow`, or hash ≠ attested file |
| Install blocked: assets | `install.assets[].file` not attached to the latest Release |
| Hash mismatch | You rebuilt after writing `sha256`, or zipped twice |
| Program does not start | Wrong `entry` path inside the zip; check the log file |
| Autostart switch disabled | You did not declare `permissions: ["autostart"]` |
| Updates skipped | User locked the version, or tag is not newer semver |
| Sideload refused | Developer mode off |
| Schema form missing in the store | Expected — the store does not render `settings.schema`. Read `MUCK_SETTINGS_PATH` yourself |

---

## 16. Official catalog (maintainers only)

To ship **inside** Muck Store:

1. Add the portable tree under `programs/official/{folder}/` with `muck.json`.
2. List it in `catalog/official.json` with `official: true` and `localResource: "programs/official/{folder}"`.
3. Run `npm run validate`.
4. Users get a copy from the checkout, not GitHub Releases.

Community samples that ship in this repo for the trust-dialog demo live under `programs/examples/` and `catalog/community.json`. They are still third-party from a trust point of view.

---

## 17. Theme packs

If you are shipping a **theme**, not a program: GitHub topic `muck-theme`, file `theme.json`, schema [`schema/theme.schema.json`](../schema/theme.schema.json). See [themes.md](themes.md). Do not put executable code in a theme.

---

## 18. Support surface (paths on the user’s PC)

| Path | What |
| --- | --- |
| `%LOCALAPPDATA%\MuckStore\programs\{id}\{version}\` | Your files |
| `%LOCALAPPDATA%\MuckStore\logs\{id}.log` | stdout/stderr |
| `%APPDATA%\MuckStore\config\{id}.json` | `MUCK_SETTINGS_PATH` |
| `%APPDATA%\MuckStore\installed.json` | Registry (version, pin, args, channel) |
| `%APPDATA%\MuckStore\trust.json` | Approval ledger |

When a user reports a bad start, ask for the log file and `muck.json` `entry` path relative to the zip root.
