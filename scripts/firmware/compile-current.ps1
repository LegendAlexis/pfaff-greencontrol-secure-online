[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$Fqbn,

  [string]$ArduinoCli = "arduino-cli"
)

$ErrorActionPreference = "Stop"

$repositoryRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$firmwareSource = Join-Path $repositoryRoot "firmware\current"
$entrySketch = "Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off.ino"
$temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) (
  "greencontrol-firmware-compile-" + [guid]::NewGuid().ToString("N")
)
$temporarySketch = Join-Path $temporaryRoot (
  "Pfaff_GreenControl_Firmware_v1_3_1_GPIO21_windows_off"
)
$buildPath = Join-Path $temporaryRoot "build"

try {
  $tool = Get-Command $ArduinoCli -ErrorAction Stop

  New-Item -ItemType Directory -Path $temporarySketch | Out-Null
  New-Item -ItemType Directory -Path $buildPath | Out-Null

  Get-ChildItem -LiteralPath $firmwareSource -File |
    Where-Object {
      $_.Name -ne "GCConfig.h" -and
      $_.Name -ne "GCConfig.example.h" -and
      $_.Name -ne "README.md"
    } |
    Copy-Item -Destination $temporarySketch

  Copy-Item `
    -LiteralPath (Join-Path $firmwareSource "GCConfig.example.h") `
    -Destination (Join-Path $temporarySketch "GCConfig.h")

  $sketchPath = Join-Path $temporarySketch $entrySketch
  if (-not (Test-Path -LiteralPath $sketchPath)) {
    throw "Current firmware entry sketch is missing: $entrySketch"
  }

  & $tool.Source compile `
    --fqbn $Fqbn `
    --build-path $buildPath `
    $temporarySketch

  if ($LASTEXITCODE -ne 0) {
    throw "Firmware compilation failed with exit code $LASTEXITCODE."
  }
}
finally {
  if (Test-Path -LiteralPath $temporaryRoot) {
    Remove-Item -LiteralPath $temporaryRoot -Recurse -Force
  }
}
