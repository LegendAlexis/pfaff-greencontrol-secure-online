[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseHost,

  [Parameter(Mandatory = $true)]
  [string]$DatabaseUser,

  [string]$DatabaseName = "postgres",

  [ValidateRange(1, 65535)]
  [int]$Port = 5432,

  [switch]$DryRun,

  [switch]$Execute
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$expectedProjectRef = "iacplyydjtiirghwixys"
$expectedHost = "aws-0-eu-west-3.pooler.supabase.com"
$expectedUser = "postgres.$expectedProjectRef"

function Test-Equal {
  param([string]$Left, [string]$Right)

  return [string]::Equals(
    $Left,
    $Right,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

if (
  -not (Test-Equal $DatabaseHost $expectedHost) -or
  -not (Test-Equal $DatabaseUser $expectedUser) -or
  $DatabaseName -ne "postgres"
) {
  throw "C2 identity gate failed: target is not the expected Staging project."
}

if ($DryRun -and $Execute) {
  throw "Choose either DryRun or Execute."
}

if (-not $DryRun -and -not $Execute) {
  throw "C2 Staging validation requires DryRun or Execute."
}

$validationFile = Join-Path $PSScriptRoot "c2-staging-validation.sql"
if (-not (Test-Path -LiteralPath $validationFile -PathType Leaf)) {
  throw "C2 Staging validation SQL is missing."
}

if ($DryRun) {
  [ordered]@{
    operation = "c2-staging-validation"
    mode = "dry-run"
    expectedProjectRef = $expectedProjectRef
    databaseHost = $DatabaseHost
    databaseUser = $DatabaseUser
    databaseName = $DatabaseName
    port = $Port
    file = [System.IO.Path]::GetFullPath($validationFile)
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

& $psql.Source `
  "--host" $DatabaseHost `
  "--port" ([string]$Port) `
  "--username" $DatabaseUser `
  "--dbname" $DatabaseName `
  "--password" `
  "--set" "ON_ERROR_STOP=1" `
  "--no-psqlrc" `
  "--file" $validationFile

if ($LASTEXITCODE -ne 0) {
  throw "C2 Staging validation failed. Do not continue with C3."
}

[ordered]@{
  operation = "c2-staging-validation"
  mode = "staging"
  projectRef = $expectedProjectRef
  databaseHost = $DatabaseHost
  databaseUser = $DatabaseUser
  databaseName = $DatabaseName
  toolVersion = $version
  result = "passed-and-rolled-back"
} | ConvertTo-Json -Depth 3
