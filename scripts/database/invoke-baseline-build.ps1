[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetHost,

  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUser,

  [Parameter(Mandatory = $true)]
  [string]$ProductionHost,

  [Parameter(Mandatory = $true)]
  [string]$ProductionProjectRef,

  [string]$DatabaseName = "postgres",

  [ValidateRange(1, 65535)]
  [int]$Port = 5432,

  [switch]$DryRun,

  [switch]$ExecuteOnIsolatedTarget
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-Identifier {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,

    [Parameter(Mandatory = $true)]
    [string]$Value,

    [Parameter(Mandatory = $true)]
    [string]$Pattern
  )

  if ([string]::IsNullOrWhiteSpace($Value) -or $Value -notmatch $Pattern) {
    throw "Unsafe or empty $Name."
  }
}

function Test-Equal {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Left,

    [Parameter(Mandatory = $true)]
    [string]$Right
  )

  return [string]::Equals(
    $Left,
    $Right,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

Assert-Identifier "TargetHost" $TargetHost "^[A-Za-z0-9.-]+$"
Assert-Identifier "TargetProjectRef" $TargetProjectRef "^[A-Za-z0-9-]+$"
Assert-Identifier "DatabaseUser" $DatabaseUser "^[A-Za-z0-9_.-]+$"
Assert-Identifier "ProductionHost" $ProductionHost "^[A-Za-z0-9.-]+$"
Assert-Identifier `
  "ProductionProjectRef" `
  $ProductionProjectRef `
  "^[A-Za-z0-9-]+$"
Assert-Identifier "DatabaseName" $DatabaseName "^[A-Za-z0-9_.-]+$"

$expectedDatabaseUser = "postgres.$TargetProjectRef"

if (-not (Test-Equal $DatabaseUser $expectedDatabaseUser)) {
  throw "Refusing execution: database user does not match target project ref."
}

if (
  (Test-Equal $TargetHost $ProductionHost) -or
  (Test-Equal $TargetProjectRef $ProductionProjectRef) -or
  (Test-Equal $DatabaseUser "postgres.$ProductionProjectRef")
) {
  throw "Refusing execution: target matches a production identity."
}

if ($DryRun -and $ExecuteOnIsolatedTarget) {
  throw "Choose either DryRun or ExecuteOnIsolatedTarget."
}

if (-not $DryRun -and -not $ExecuteOnIsolatedTarget) {
  throw "Baseline build requires DryRun or ExecuteOnIsolatedTarget."
}

$repositoryRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\..")
)

$files = @(
  [System.IO.Path]::GetFullPath(
    (Join-Path $repositoryRoot "supabase\baseline\001_public_schema.sql")
  ),
  [System.IO.Path]::GetFullPath(
    (Join-Path $repositoryRoot "supabase\baseline\002_p0_security_target.sql")
  )
)

foreach ($file in $files) {
  if (
    -not $file.StartsWith(
      $repositoryRoot + [System.IO.Path]::DirectorySeparatorChar,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "Refusing SQL outside the GreenControl repository."
  }

  if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
    throw "Required baseline file is missing."
  }
}

$arguments = @(
  "--host", $TargetHost,
  "--port", [string]$Port,
  "--username", $DatabaseUser,
  "--dbname", $DatabaseName,
  "--password",
  "--set", "ON_ERROR_STOP=1",
  "--no-psqlrc"
)

if ($DryRun) {
  [ordered]@{
    operation = "baseline-build"
    mode = "dry-run"
    targetHost = $TargetHost
    targetProjectRef = $TargetProjectRef
    databaseUser = $DatabaseUser
    databaseName = $DatabaseName
    port = $Port
    files = $files
    productionContacted = $false
    executable = $false
  } | ConvertTo-Json -Depth 4

  exit 0
}

$psql = Get-Command "psql" -ErrorAction Stop
$version = & $psql.Source "--version"

if ($LASTEXITCODE -ne 0 -or $version -notmatch "PostgreSQL\) 17\.") {
  throw "PostgreSQL 17.x psql is required."
}

foreach ($file in $files) {
  & $psql.Source @arguments "--file" $file

  if ($LASTEXITCODE -ne 0) {
    throw "Baseline build failed."
  }
}

[ordered]@{
  operation = "baseline-build"
  mode = "isolated-target"
  targetHost = $TargetHost
  targetProjectRef = $TargetProjectRef
  databaseUser = $DatabaseUser
  databaseName = $DatabaseName
  toolVersion = $version
  files = $files
  productionContacted = $false
  result = "passed"
} | ConvertTo-Json -Depth 4
