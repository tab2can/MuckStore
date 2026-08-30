# Security model

Muck Store does **not** depend on paid Authenticode certificates or SmartScreen reputation, and it has **no server**. The client talks to GitHub. Trust is a Muck verification report plus your explicit approval.

## How a program is allowed in

1. **Verify** — public GitHub (or official catalog copy), valid `muck.json`, SPDX/LICENSE, SHA-256 pins for remote assets, permission list, commit pin, release assets when required. **Release binaries must have GitHub Artifact Attestations** from a GitHub Actions workflow in that same repository (`build.workflow`). Private repos fail. Failed checks **block** install.
2. **Approve** — official catalog programs are Muck-approved after a passing report. Community programs need your confirmation; the result is stored in `%APPDATA%\MuckStore\trust.json`. A new version or commit asks again.
3. **Install** — HTTPS download, hash check, **attestation re-check on the bytes on disk**, then Mark-of-the-Web is stripped **only after** that approval so Windows does not use the “downloaded from the internet / SmartScreen” prompt as the store UI.

Defender still scans files. Muck Store never disables SmartScreen or Defender globally and never adds an exclusion without a separate, explicit UAC step.

Attestation responses are not long-cached: a stale “this digest was attested” answer must not outlive a yanked or replaced provenance.

## Official vs community

- **Official** — listed in `catalog/official.json` shipped with the app. The catalog is the signature; the payload is copied from this checkout.
- **Community** — public GitHub only. Muck checks that Release bytes were produced by **this repo’s Actions**, not whether the code is safe. You approve the repo.

A maintainer with push access can still ship malicious source and a matching workflow. Attestations stop **detached** binaries (a zip that never went through that repo’s CI).

## What the store will not do

- Silently add a Windows Defender exclusion
- Pack or obfuscate its own binary
- Evaluate theme JavaScript
- Run a post-install script that is not hash-pinned
- Inject into Explorer
- Accept a GitHub Release asset with no Artifact Attestation
- Proxy verification through a Muck backend

## Elevation

`muck-store.exe --helper-job` under UAC for declared privileged actions only.

## Optional Authenticode

[`packaging/sign.ps1`](../packaging/sign.ps1) exists if you later obtain a certificate. It is **not** part of the product trust model. GitHub Actions + attestations are.

## Telemetry

Off.
