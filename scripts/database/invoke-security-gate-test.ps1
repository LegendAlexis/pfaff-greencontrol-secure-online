[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$TargetHost,

  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$ProductionHost,

  [Parameter(Mandatory = $true)]
  [string]$ProductionProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUser,

  [string]$DatabaseName = "postgres",

  [ValidateRange(1, 65535)]
  [int]$Port = 5432,

  [switch]$ExecuteOnDisposableTest
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Assert-SafeIdentifier {
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

Assert-SafeIdentifier "TargetHost" $TargetHost "^[A-Za-z0-9.-]+$"
Assert-SafeIdentifier "TargetProjectRef" $TargetProjectRef "^[A-Za-z0-9-]+$"
Assert-SafeIdentifier "ProductionHost" $ProductionHost "^[A-Za-z0-9.-]+$"
Assert-SafeIdentifier `
  "ProductionProjectRef" `
  $ProductionProjectRef `
  "^[A-Za-z0-9-]+$"
Assert-SafeIdentifier "DatabaseUser" $DatabaseUser "^[A-Za-z0-9_.-]+$"
Assert-SafeIdentifier "DatabaseName" $DatabaseName "^[A-Za-z0-9_.-]+$"

if (
  (Test-Equal $TargetHost $ProductionHost) -or
  (Test-Equal $TargetProjectRef $ProductionProjectRef)
) {
  throw "Refusing execution: target matches a production identity."
}

if (-not $ExecuteOnDisposableTest) {
  throw "Execution requires -ExecuteOnDisposableTest."
}

$psql = Get-Command "psql" -ErrorAction Stop
$version = & $psql.Source "--version"

if ($LASTEXITCODE -ne 0 -or $version -notmatch "PostgreSQL\) 17\.") {
  throw "PostgreSQL 17.x psql is required."
}

$repositoryRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\..")
)

$steps = @(
  [ordered]@{
    name = "preflight"
    expected = "Known vulnerable test baseline is present"
    file = Join-Path $PSScriptRoot "security-gate-preflight.sql"
    rollback = "No change; preflight is read-only"
  },
  [ordered]@{
    name = "apply-minimal-hardening"
    expected = "Only profile grants and manual_commands access are hardened"
    file = Join-Path `
      $repositoryRoot `
      "supabase\migration-drafts\20260730_security_gate_hardening_DRAFT.sql"
    rollback = "Discard and rebuild the disposable test instance"
  },
  [ordered]@{
    name = "postflight"
    expected = "Negative privilege tests pass and existing objects remain"
    file = Join-Path $PSScriptRoot "security-gate-postflight.sql"
    rollback = "No change; postflight is read-only"
  }
)

$commonArguments = @(
  "--host", $TargetHost,
  "--port", [string]$Port,
  "--username", $DatabaseUser,
  "--dbname", $DatabaseName,
  "--password",
  "--set", "ON_ERROR_STOP=1",
  "--no-psqlrc"
)

foreach ($step in $steps) {
  $resolvedFile = [System.IO.Path]::GetFullPath($step.file)

  if (
    -not $resolvedFile.StartsWith(
      $repositoryRoot + [System.IO.Path]::DirectorySeparatorChar,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "Refusing SQL outside the GreenControl repository."
  }

  if (-not (Test-Path -LiteralPath $resolvedFile -PathType Leaf)) {
    throw "Required SQL file is missing."
  }

  Write-Output (
    [ordered]@{
      step = $step.name
      expectedBehavior = $step.expected
      rollback = $step.rollback
      status = "started"
    } | ConvertTo-Json -Compress
  )

  & $psql.Source @commonArguments "--file" $resolvedFile

  if ($LASTEXITCODE -ne 0) {
    throw "Security Gate step failed: $($step.name)"
  }

  Write-Output (
    [ordered]@{
      step = $step.name
      actualBehavior = "psql completed with exit code 0"
      status = "passed"
    } | ConvertTo-Json -Compress
  )
}

Write-Output (
  [ordered]@{
    phase = "2A.2-security-gate"
    targetKind = "disposable-test-only"
    toolVersion = $version
    productionContacted = $false
    result = "passed"
  } | ConvertTo-Json -Compress
)
