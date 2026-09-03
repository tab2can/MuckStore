# Reproducible builds and GitHub Actions

Start here if you already have `muck.json` and need a store-ready Release. Full publisher playbook: [developer-guide.md](developer-guide.md).

Muck Store has **no server**. The client talks to GitHub (and GitHub’s public Artifact Attestations / Sigstore path). A Release zip can be uploaded by anyone with write access, so the store **does not trust the file just because it sits on Releases**.

For any `install.assets` payload (`archive`, `msi`, `nsis`, `inno`, `runtime`, or `portable` with hashed assets) the client requires:

1. **GitHub Actions in this repository** — `build.workflow` must be a file under `.github/workflows/`.
2. **GitHub Artifact Attestations** — a SLSA provenance statement whose subject SHA-256 is the asset, bound to `source.github`.
3. **A reproducible recipe** — pinned actions, locked dependencies, `SOURCE_DATE_EPOCH` where the toolchain honors it.

A hand-uploaded binary with no attestation is **blocked**. Official programs that ship inside this checkout (`localResource`) are copied from the catalog tree and do not use Releases.

## What this proves (and what it does not)

| Proved | Not proved |
| --- | --- |
| GitHub Actions in `owner/repo` produced bytes with this SHA-256 at that workflow | The source is free of malware |
| The digest matches the file you download | Bit-for-bit rebuild in *your* language without running the same workflow |
| The workflow path matches `muck.json` | A malicious maintainer with push access cannot ship bad source + a bad workflow |

Independent rebuild of every language is out of scope for a client-only store. The attestation is the proof that **these bytes came from this repo’s Actions**, not from an unrelated zip dropped onto Releases.

Self-hosted runners are accepted with a **warning**. Prefer `runs-on: windows-latest` (GitHub-hosted).

## `muck.json`

```json
"build": {
  "workflow": ".github/workflows/release.yml",
  "reproducible": true,
  "attestations": "required"
}
```

`attestations` may be omitted; it is still treated as required. Setting it to anything else, or setting `reproducible` to `false`, fails `muck validate` and install.

## How to produce a store-ready build

Copy [`docs/examples/release.yml`](examples/release.yml) to `.github/workflows/release.yml` and replace the **Build** step with your language’s commands.

Checklist:

1. Workflow lives in **this** repo (not a reusable workflow in another org unless the attestation still names this repository).
2. Job permissions include `id-token: write`, `attestations: write`, and `contents: write` (to attach the Release).
3. After the artifact exists, run `actions/attest` (or `actions/attest-build-provenance`) with `subject-path` pointing at the exact file named in `install.assets[].file`.
4. Upload **that same file** to the GitHub Release. Do not zip it again afterwards.
5. Hash the file (`Get-FileHash` / `sha256sum`) and put the hex digest in `install.assets[].sha256`.
6. Pin Actions to a **commit SHA**, not a moving tag, before you tag a release.
7. Run `node cli/muck-validate.mjs .` then tag `vX.Y.Z`.

### Reproducibility knobs (Windows runner)

```powershell
$env:SOURCE_DATE_EPOCH = git log -1 --format=%ct
$env:CARGO_INCREMENTAL = "0"
```

- **Rust:** lockfile committed; `cargo build --release`; avoid embedding timestamps.
- **Node:** commit `package-lock.json` / `pnpm-lock.yaml`; `npm ci`; no postinstall that fetches unpinned binaries.
- **.NET:** `dotnet publish -c Release --no-self-contained` (or a locked SDK version in `global.json`).
- **Python:** lock with `uv.lock` or `poetry.lock`; freeze the interpreter version.

If two CI runs of the same commit do not yield the same SHA-256, fix the recipe before publishing. Muck Store will still accept a single attested digest; reproducibility is how *you* keep that digest honest.

## What the client does

On verify and again after download (no long-lived attestation cache):

1. `GET https://api.github.com/repos/{owner}/{repo}/attestations/sha256:{digest}`
2. Decode the in-toto / DSSE payload.
3. Subject digest must equal the asset SHA-256 and the file on disk.
4. Provenance `workflow.repository` must be this GitHub repo; `workflow.path` must match `build.workflow`.

Optional GitHub token in store settings only raises API rate limits. Verification does not go through a Muck backend.

## Local check with GitHub CLI

```bash
gh attestation verify program.zip --repo owner/repo
```

That uses Sigstore verification. The store performs the same binding (repo + digest + workflow) against GitHub’s attestations API so users do not need `gh` installed.
