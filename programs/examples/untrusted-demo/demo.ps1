Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(
  "This is the untrusted demo. It is a normal script with no Muck SDK.",
  "Untrusted Demo",
  [System.Windows.Forms.MessageBoxButtons]::OK,
  [System.Windows.Forms.MessageBoxIcon]::Warning
) | Out-Null
