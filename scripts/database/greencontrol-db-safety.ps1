[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet(
    "schema-dump",
    "schema-restore",
    "apply-forward",
    "apply-rollback"
  )]
  [string]$Operation,

  [Parameter(Mandatory = $true)]
  [ValidateSet("production-read", "test-write")]
  [string]$TargetKind,

  [Parameter(Mandatory = $true)]
  [string]$TargetHost,

  [Parameter(Mandatory = $true)]
  [string]$TargetProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$ProductionHost,

  [Parameter(Mandatory = $true)]
  [string]$ProductionProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$TestHost,

  [Parameter(Mandatory = $true)]
  [string]$TestProjectRef,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUser,

  [string]$DatabaseName = "postgres",

  [ValidateRange(1, 65535)]
  [int]$Port = 5432,

  [string]$InputFile,

  [string]$OutputFile,

  [switch]$DryRun
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

if (-not $DryRun) {
  throw "Phase 2A.2a permits DryRun only. Database execution is not implemented."
}

Assert-SafeIdentifier "TargetHost" $TargetHost "^[A-Za-z0-9.-]+$"
Assert-SafeIdentifier "TargetProjectRef" $TargetProjectRef "^[A-Za-z0-9-]+$"
Assert-SafeIdentifier "ProductionHost" $ProductionHost "^[A-Za-z0-9.-]+$"
Assert-SafeIdentifier `
  "ProductionProjectRef" `
  $ProductionProjectRef `
  "^[A-Za-z0-9-]+$"
Assert-SafeIdentifier "TestHost" $TestHost "^[A-Za-z0-9.-]+$"
Assert-SafeIdentifier "TestProjectRef" $TestProjectRef "^[A-Za-z0-9-]+$"
Assert-SafeIdentifier "DatabaseUser" $DatabaseUser "^[A-Za-z0-9_.-]+$"
Assert-SafeIdentifier "DatabaseName" $DatabaseName "^[A-Za-z0-9_.-]+$"

if (
  (Test-Equal $ProductionHost $TestHost) -or
  (Test-Equal $ProductionProjectRef $TestProjectRef)
) {
  throw "Production and test identities must be different."
}

$isProductionTarget =
  (Test-Equal $TargetHost $ProductionHost) -and
  (Test-Equal $TargetProjectRef $ProductionProjectRef)
$isTestTarget =
  (Test-Equal $TargetHost $TestHost) -and
  (Test-Equal $TargetProjectRef $TestProjectRef)

if (-not $isProductionTarget -and -not $isTestTarget) {
  throw "Target is neither the exact production identity nor the exact test identity."
}

$productionReadOperations = @("schema-dump")
$testWriteOperations = @(
  "schema-restore",
  "apply-forward",
  "apply-rollback"
)

if ($TargetKind -eq "production-read") {
  if (-not $isProductionTarget) {
    throw "production-read requires the exact production identity."
  }

  if ($Operation -notin $productionReadOperations) {
    throw "Only schema-dump is permitted for production-read."
  }
}

if ($TargetKind -eq "test-write") {
  if (-not $isTestTarget) {
    throw "test-write requires the exact test identity."
  }

  if ($Operation -notin $testWriteOperations) {
    throw "Operation is not permitted for test-write."
  }
}

$commonArguments = @(
  "--host", $TargetHost,
  "--port", [string]$Port,
  "--username", $DatabaseUser,
  "--dbname", $DatabaseName,
  "--password"
)

$tool = ""
$arguments = @()

if ($Operation -eq "schema-dump") {
  if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    throw "schema-dump requires OutputFile."
  }

  $resolvedOutput = [System.IO.Path]::GetFullPath($OutputFile)
  $expectedTempRoot = [System.IO.Path]::GetFullPath(
    [System.IO.Path]::GetTempPath()
  ).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  ) + [System.IO.Path]::DirectorySeparatorChar

  if (
    -not $resolvedOutput.StartsWith(
      $expectedTempRoot,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "Schema dump output must stay inside the operating-system temp directory."
  }

  $tool = "pg_dump"
  $arguments = $commonArguments + @(
    "--schema-only",
    "--schema", "public",
    "--no-owner",
    "--no-privileges",
    "--file", $resolvedOutput
  )
} else {
  if ([string]::IsNullOrWhiteSpace($InputFile)) {
    throw "$Operation requires InputFile."
  }

  $resolvedInput = [System.IO.Path]::GetFullPath($InputFile)
  $repositoryRoot = [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\..")
  ).TrimEnd(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  ) + [System.IO.Path]::DirectorySeparatorChar

  if (
    -not $resolvedInput.StartsWith(
      $repositoryRoot,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  ) {
    throw "SQL input must be located inside the GreenControl repository."
  }

  if (-not (Test-Path -LiteralPath $resolvedInput -PathType Leaf)) {
    throw "SQL input file does not exist."
  }

  if ([System.IO.Path]::GetExtension($resolvedInput) -ne ".sql") {
    throw "SQL input must have the .sql extension."
  }

  $tool = "psql"
  $arguments = $commonArguments + @(
    "--set", "ON_ERROR_STOP=1",
    "--single-transaction",
    "--file", $resolvedInput
  )
}

$plan = [ordered]@{
  phase = "2A.2a"
  dryRun = $true
  executionAllowed = $false
  operation = $Operation
  targetKind = $TargetKind
  targetHost = $TargetHost
  targetProjectRef = $TargetProjectRef
  tool = $tool
  arguments = $arguments
  passwordSource = "interactive-prompt"
}

$plan | ConvertTo-Json -Depth 4
