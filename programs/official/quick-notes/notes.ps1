Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$programDir = $env:MUCK_PROGRAM_DIR
if (-not $programDir) { $programDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$settingsPath = $env:MUCK_SETTINGS_PATH
$notesPath = Join-Path $programDir "notes.txt"

$fontSize = 14
$theme = "dark"
$autosave = $true
if ($settingsPath -and (Test-Path $settingsPath)) {
  try {
    $s = Get-Content -Path $settingsPath -Raw | ConvertFrom-Json
    if ($s.fontSize) { $fontSize = [int]$s.fontSize }
    if ($s.theme) { $theme = [string]$s.theme }
    if ($null -ne $s.autosave) { $autosave = [bool]$s.autosave }
  } catch {}
}

$form = New-Object System.Windows.Forms.Form
$form.Text = "Quick Notes"
$form.Width = 760
$form.Height = 540
$form.StartPosition = "CenterScreen"

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline = $true
$box.ScrollBars = "Vertical"
$box.Dock = "Fill"
$box.Font = New-Object System.Drawing.Font("Segoe UI", $fontSize)
if (Test-Path $notesPath) { $box.Text = Get-Content -Path $notesPath -Raw }

if ($theme -eq "light") {
  $form.BackColor = [System.Drawing.Color]::FromArgb(245, 240, 232)
  $box.BackColor = [System.Drawing.Color]::FromArgb(255, 252, 246)
  $box.ForeColor = [System.Drawing.Color]::FromArgb(28, 24, 18)
} else {
  $form.BackColor = [System.Drawing.Color]::FromArgb(18, 21, 28)
  $box.BackColor = [System.Drawing.Color]::FromArgb(23, 27, 36)
  $box.ForeColor = [System.Drawing.Color]::FromArgb(236, 232, 225)
}

$save = {
  Set-Content -Path $notesPath -Value $box.Text -Encoding UTF8
}

$form.Add_FormClosing({ & $save })
if ($autosave) {
  $timer = New-Object System.Windows.Forms.Timer
  $timer.Interval = 8000
  $timer.Add_Tick({ & $save })
  $timer.Start()
}

$form.Controls.Add($box)
[void]$form.ShowDialog()
