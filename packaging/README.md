# Signing and MSIX (optional)

Muck Store’s trust model is GitHub provenance + SHA-256 + the in-app approval ledger. A paid Authenticode certificate is **not required**.

These files are only if you later want Microsoft Store / SmartScreen publisher reputation.

## Authenticode

```powershell
# packaging/sign.ps1
```

Needs `signtool` (Windows SDK) and a `.pfx` you provide. Skip this for normal GitHub releases.

## MSIX

`AppxManifest.xml` is a draft for a future pack. Not used by `npm run tauri dev`.
