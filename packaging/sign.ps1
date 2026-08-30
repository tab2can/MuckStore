param(
  [Parameter(Mandatory = $true)][string] $File,
  [Parameter(Mandatory = $true)][string] $Pfx,
  [Parameter(Mandatory = $true)][string] $Password,
  [string] $Timestamp = "http://timestamp.digicert.com"
)

if (-not (Get-Command signtool -ErrorAction SilentlyContinue)) {
  throw "signtool.exe is not on PATH. Install the Windows SDK."
}

& signtool sign /fd SHA256 /td SHA256 /tr $Timestamp /f $Pfx /p $Password $File
if ($LASTEXITCODE -ne 0) { throw "signtool sign failed" }
& signtool verify /pa $File
if ($LASTEXITCODE -ne 0) { throw "signtool verify failed" }
Write-Host "signed $File"
