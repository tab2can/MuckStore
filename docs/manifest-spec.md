# Manifest specification

Canonical schema: [`schema/muck.schema.json`](../schema/muck.schema.json)

Required fields: `id`, `name`, `version`, `license`, `summary`, `source.github`, `entry`, `install.kind`.

`id` is reverse-DNS (`com.author.program`). `source.github` is `owner/repo` and must be public.

## Settings widgets (`x-muck-widget`)

`toggle`, `slider`, `select`, `text`, `password`, `hotkey`, `path`, `color`, `number`, `list`

Example:

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

## Assets

Remote kinds require `install.assets[]` with `file`, `platform` (`windows-x64` or `any`), and `sha256`. Optional `url` overrides the GitHub Release lookup.

Those assets must be produced by GitHub Actions in the same repository. Set `build.workflow` to the Actions file (for example `.github/workflows/release.yml`). GitHub Artifact Attestations are mandatory; a hand-uploaded Release is rejected. See [Reproducible builds](reproducible-builds.md).

Post-install scripts require `postinstallSha256`. The helper refuses to run a script without a matching hash.
