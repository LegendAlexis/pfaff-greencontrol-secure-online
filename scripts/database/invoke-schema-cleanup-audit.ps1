[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetHost,

  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUser,

  [Parameter(Mandatory = $true)]
  [string]$ExpectedHost,

  [Parameter(Mandatory = $true)]
  [string]$ExpectedProjectRef,

  [string]$DatabaseName = "postgres",

  [ValidateRange(1, 65535)]
  [int]$Port = 5432,

  [switch]$DryRun,

  [switch]$ExecuteReadOnly
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
Assert-Identifier "ExpectedHost" $ExpectedHost "^[A-Za-z0-9.-]+$"
Assert-Identifier "TargetProjectRef" $TargetProjectRef "^[A-Za-z0-9-]+$"
Assert-Identifier "ExpectedProjectRef" $ExpectedProjectRef "^[A-Za-z0-9-]+$"
Assert-Identifier "DatabaseUser" $DatabaseUser "^[A-Za-z0-9_.-]+$"
Assert-Identifier "DatabaseName" $DatabaseName "^[A-Za-z0-9_.-]+$"

if (
  -not (Test-Equal $TargetHost $ExpectedHost) -or
  -not (Test-Equal $TargetProjectRef $ExpectedProjectRef)
) {
  throw "Refusing audit: target identity does not match the expected identity."
}

if (-not (Test-Equal $DatabaseUser "postgres.$TargetProjectRef")) {
  throw "Refusing audit: database user does not match target project ref."
}

if ($DatabaseName -ne "postgres") {
  throw "Refusing audit: database name must be postgres."
}

if ($DryRun -and $ExecuteReadOnly) {
  throw "Choose either DryRun or ExecuteReadOnly."
}

if (-not $DryRun -and -not $ExecuteReadOnly) {
  throw "Schema cleanup audit requires DryRun or ExecuteReadOnly."
}

$repositoryRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\..")
)
$auditFile = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "schema-cleanup-readonly.sql")
)

if (
  -not $auditFile.StartsWith(
    $repositoryRoot + [System.IO.Path]::DirectorySeparatorChar,
    [System.StringComparison]::OrdinalIgnoreCase
  ) -or
  -not (Test-Path -LiteralPath $auditFile -PathType Leaf)
) {
  throw "Refusing audit SQL outside the GreenControl repository."
}

if ($DryRun) {
  [ordered]@{
    operation = "schema-cleanup-audit"
    mode = "dry-run"
    targetHost = $TargetHost
    targetProjectRef = $TargetProjectRef
    databaseUser = $DatabaseUser
    databaseName = $DatabaseName
    port = $Port
    file = $auditFile
    connectionAttempted = $false
    executable = $false
  } | ConvertTo-Json -Depth 3

  exit 0
}

$psql = Get-Command "psql" -ErrorAction Stop
$version = & $psql.Source "--version"

if ($LASTEXITCODE -ne 0 -or $version -notmatch "PostgreSQL\) 17\.") {
  throw "PostgreSQL 17.x psql is required."
}

$arguments = @(
  "--host", $TargetHost,
  "--port", [string]$Port,
  "--username", $DatabaseUser,
  "--dbname", $DatabaseName,
  "--password",
  "--set", "ON_ERROR_STOP=1",
  "--no-psqlrc",
  "--file", $auditFile
)

& $psql.Source @arguments

if ($LASTEXITCODE -ne 0) {
  throw "Read-only schema cleanup audit failed."
}

[ordered]@{
  operation = "schema-cleanup-audit"
  mode = "read-only"
  targetHost = $TargetHost
  targetProjectRef = $TargetProjectRef
  databaseUser = $DatabaseUser
  databaseName = $DatabaseName
  toolVersion = $version
  file = $auditFile
  result = "passed"
} | ConvertTo-Json -Depth 3
