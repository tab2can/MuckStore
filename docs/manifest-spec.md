# Manifest specification (`muck.json`)

Canonical schema: [`schema/muck.schema.json`](../schema/muck.schema.json)

How to ship a program: [developer-guide.md](developer-guide.md).  
Release binaries: [reproducible-builds.md](reproducible-builds.md).

The store reads `muck.json` from the repository **default branch**, at the root or at `.muck/muck.json`. Extra JSON keys are rejected (`additionalProperties: false`).

JSON object keys in the file are **camelCase** (`source.github`, `postinstallSha256`, `includePrerelease`).

---

## Required

| Field | Type | Rules |
| --- | --- | --- |
| `id` | string | Reverse-DNS, lowercase, at least one dot. Pattern: `^[a-z0-9]+(\.[a-z0-9-]+){1,}$`. Example: `com.example.my-app`. |
| `name` | string | 1–80 characters. Display name. |
| `version` | string | Semver (`1.2.0`, optional `-beta.1` / `+meta`). Must match the GitHub tag you want users to install (tag may have a leading `v`). |
| `license` | string | SPDX id (`MIT`, `Apache-2.0`, …). Empty / `NOASSERTION` fails verify. |
| `summary` | string | 8–280 characters. Card subtitle. |
| `source.github` | string | Public repo as `owner/repo` only. |
| `entry` | string | Relative path of the executable/script **inside the installed tree**. |
| `install.kind` | enum | `portable` \| `archive` \| `msi` \| `nsis` \| `inno` \| `script` \| `runtime` |

`$schema` is optional (documentation / editor).

---

## Identity and listing

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `description` | string | — | Longer text. Discover may fall back to the GitHub repo description. |
| `categories` | string[] | `[]` | Free-form, unique. Used in Home filters. |
| `tags` | string[] | `[]` | Free-form. |
| `i18n` | object | — | Map of locale → `{ name?, summary?, description? }`. Example key: `"tr"`. |
| `ui.icon` | string | — | URL or repo-relative path (resolved against `HEAD` on GitHub). |
| `ui.screenshots` | string[] | `[]` | Same resolution as icon. README images are also scraped. |
| `ui.accent` | string | — | Accent hint for store chrome around this program. |

---

## `install`

| Field | Type | Meaning |
| --- | --- | --- |
| `kind` | enum | How the payload is obtained. See [developer-guide.md](developer-guide.md#7-install-kinds--pick-one). |
| `assets` | array | Required for `archive` / `msi` / `nsis` / `inno`. Each item: `file`, `platform`, `sha256`, optional `url`. |
| `assets[].file` | string | GitHub Release asset **name**. Must match the upload. |
| `assets[].platform` | enum | `windows-x64` (current client), `windows-arm64`, or `any`. The client picks `windows-x64` or `any`. |
| `assets[].sha256` | string | 64 hex chars of the attested file. |
| `assets[].url` | uri | Optional override if the file is not looked up by name on the Release. Still hashed and attested. |
| `silentArgs` | string | Silent flags for msi/nsis/inno. |
| `installdirProperty` | string | Fallback passed to the helper if `silentArgs` is omitted. |
| `postinstall` | string | Relative script after install. |
| `postinstallSha256` | string | **Required** if `postinstall` is set. |
| `shortcuts.startMenu` | bool | Default `true`. |
| `shortcuts.desktop` | bool | Default `false`. |

`archive`, `msi`, `nsis`, and `inno` also **require** `build` (schema `allOf`). Portable/runtime with a non-empty `assets` array need `build` too (`muck validate` + client).

---

## `build` (Release assets)

| Field | Type | Meaning |
| --- | --- | --- |
| `workflow` | string | Path in **this** repo, must include `.github/workflows/`. Example: `.github/workflows/release.yml`. |
| `reproducible` | bool | Default true. Cannot be `false` for store distribution. |
| `attestations` | `"required"` | If present, must be `required`. Omitted is still treated as required for hashed assets. |

---

## `permissions` and `filesystemPaths`

Allowed permission strings (unique):

`network`, `filesystem`, `autostart`, `input-hook`, `clipboard`, `notifications`, `screenshot`, `shell-integration`, `other-process`, `windows-settings`, `admin`

Unknown values fail validate. `autostart` is required for the store’s “Start with Windows” switch. `admin` uses UAC via the helper.

`filesystemPaths`: optional string patterns; not enforced as ACLs.

---

## `runtimes`

Array of `{ id, version?, strategy? }`.

- `id`: `python` \| `node` \| `dotnet`
- `strategy`: `system` (default) \| `download` \| `bundle`
- `version`: used when downloading (Python default `3.12.7` if omitted)

`.py` / `.js` entries use these binaries. Prefer a self-contained `exe` when you can.

---

## `settings` (your JSON, not the store form)

```json
"settings": {
  "schema": {
    "type": "object",
    "properties": {
      "fontSize": {
        "type": "number",
        "title": "Font size",
        "minimum": 10,
        "maximum": 28,
        "default": 14,
        "x-muck-widget": "slider"
      }
    }
  }
}
```

On **first** install, defaults are written to `%APPDATA%\MuckStore\config\{id}.json`. The program reads that file via `MUCK_SETTINGS_PATH`.

The store Program Settings sheet does **not** render this schema. `x-muck-widget` remains in the schema for your own UI or future tools.

Widgets: `toggle`, `slider`, `select`, `text`, `password`, `hotkey`, `path`, `color`, `number`, `list`.

`settings.schemaFile` may point at an external schema file; keep `schema` inline unless you have a reason not to.

---

## `update`

| Field | Type | Meaning |
| --- | --- | --- |
| `channel` | `"github-releases"` | Only supported channel. |
| `includePrerelease` | bool | Default `false`. If true, latest prerelease tags are considered even on the stable store channel. Users can also pick Preview in Program Settings. |

Installed updates compare GitHub Release tags to the installed folder version with semver. A user **version lock** skips apply.

---

## `watchdog`

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `onCrash` | `restart` \| `notify` \| `off` | `notify` | After a store-started process exits. |
| `maxRestarts` | 0–20 | `3` | Cap when `onCrash` is `restart`. |

---

## Complete community example

```json
{
  "id": "com.example.my-app",
  "name": "My App",
  "version": "1.2.0",
  "license": "MIT",
  "summary": "A portable Windows tool distributed through Muck Store.",
  "description": "Longer README-style paragraph is optional; README.md is preferred.",
  "categories": ["productivity"],
  "tags": ["sample"],
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
  "permissions": ["filesystem", "network"],
  "update": { "channel": "github-releases", "includePrerelease": false },
  "watchdog": { "onCrash": "notify", "maxRestarts": 2 },
  "i18n": {
    "tr": { "name": "Uygulamam", "summary": "Muck Store üzerinden dağıtılan taşınabilir bir araç." }
  },
  "ui": {
    "icon": "docs/icon.png",
    "screenshots": ["docs/shot.png"],
    "accent": "#d4a056"
  }
}
```

Validate:

```bash
node cli/muck-validate.mjs path/to/repo
```
