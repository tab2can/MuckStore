# Developer guide

Muck Store does not require an SDK and has **no backend**. Write the program as you already would. Publish it on a **public GitHub repository** with:

1. `muck.json` (or `.muck/muck.json`)
2. A `LICENSE` / `COPYING` file
3. For official samples only: a portable tree copied from this checkout
4. For anything distributed as a GitHub Release zip/installer: a **GitHub Actions** workflow in *this* repo that builds, **attests**, and uploads the asset (see [Reproducible builds](reproducible-builds.md))
5. Optional settings schema inside the manifest

## Environment provided at runtime

| Variable | Meaning |
| --- | --- |
| `MUCK_PROGRAM_DIR` | Install directory |
| `MUCK_PROGRAM_ID` | Reverse-DNS id |
| `MUCK_SETTINGS_PATH` | JSON file of user settings |

Read that JSON in whatever language you use. If you omit `settings.schema`, the store hides the settings panel.

## Publish a Release binary

Release files are **not** trusted just because they sit next to your source. Someone with write access can upload an unrelated zip. Muck Store therefore requires:

1. Copy [`docs/examples/release.yml`](examples/release.yml) to `.github/workflows/release.yml` and replace the Build step.
2. Declare the workflow in the manifest:

```json
"install": {
  "kind": "archive",
  "assets": [
    {
      "file": "program.zip",
      "platform": "windows-x64",
      "sha256": "64-char hex of the Actions output"
    }
  ]
},
"build": {
  "workflow": ".github/workflows/release.yml",
  "reproducible": true,
  "attestations": "required"
}
```

3. Pin Actions to commit SHAs. Set `SOURCE_DATE_EPOCH` from `git log -1 --format=%ct`. Lock dependencies.
4. Tag `v1.2.0`. The workflow must call `actions/attest` (or `actions/attest-build-provenance`) on the **same bytes** it uploads.
5. Run `node cli/muck-validate.mjs .` before tagging. Add topic `muck-store` so Discover can find the repo.

The client then asks GitHub for `GET /repos/{owner}/{repo}/attestations/sha256:{digest}` and refuses the install if the provenance is missing, bound to another repo, or produced by a different workflow.

Portable official trees (`localResource` in the catalog) skip this path: they are copied from the store checkout, not downloaded from Releases.

## Install kinds

- `portable` — copy a folder (official samples, sideload). If you also declare hashed Release assets, those assets still need Actions + attestation.
- `archive` — zip from GitHub Releases (**Actions + attestation required**)
- `msi` / `nsis` / `inno` — silent installer, hash-pinned, UAC if `admin` is declared (**Actions + attestation required**)
- `runtime` — payload plus Python/Node bootstrap (attestation required when assets are present)
- `script` — only a hash-pinned `postinstall`

## Permissions

Declare every capability the program actually uses. The user sees them before install. `admin` triggers UAC via a helper relaunch of Muck Store (`--helper-job`). The store itself does not inject into Explorer.

## Sideload

Enable Developer mode in Settings, then sideload a local folder that contains `muck.json`. Sideload is for development; it does not replace Release attestation for community installs from GitHub.
