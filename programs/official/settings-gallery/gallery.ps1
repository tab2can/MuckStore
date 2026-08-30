Add-Type -AssemblyName System.Windows.Forms

$settingsPath = $env:MUCK_SETTINGS_PATH
$body = "No settings file yet.`nMUCK_SETTINGS_PATH=$settingsPath"
if ($settingsPath -and (Test-Path $settingsPath)) {
  $body = Get-Content -Path $settingsPath -Raw
}

[System.Windows.Forms.MessageBox]::Show(
  $body,
  "Settings Gallery",
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Information
) | Out-Null
