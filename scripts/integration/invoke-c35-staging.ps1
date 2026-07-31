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
$expectedDatabaseHost = "aws-0-eu-west-3.pooler.supabase.com"
$expectedDatabaseUser = "postgres.$expectedProjectRef"
$expectedApiHost = "$expectedProjectRef.supabase.co"

function Test-Equal {
  param([string]$Left, [string]$Right)
  return [string]::Equals(
    $Left,
    $Right,
    [System.StringComparison]::OrdinalIgnoreCase
  )
}

if (
  -not (Test-Equal $DatabaseHost $expectedDatabaseHost) -or
  -not (Test-Equal $DatabaseUser $expectedDatabaseUser) -or
  $DatabaseName -ne "postgres"
) {
  throw "C3.5 database identity gate failed."
}

if ($DryRun -and $Execute) {
  throw "Choose either DryRun or Execute."
}
if (-not $DryRun -and -not $Execute) {
  throw "C3.5 requires DryRun or Execute."
}

$databaseScript = Join-Path $PSScriptRoot "..\database\c35-apply-c2-staging.sql"
$integrationScript = Join-Path $PSScriptRoot "c35-command-poll-staging.ts"

if (
  -not (Test-Path -LiteralPath $databaseScript -PathType Leaf) -or
  -not (Test-Path -LiteralPath $integrationScript -PathType Leaf)
) {
  throw "C3.5 scripts are incomplete."
}

if ($DryRun) {
  [ordered]@{
    operation = "c3.5-staging-integration"
    mode = "dry-run"
    expectedProjectRef = $expectedProjectRef
    databaseHost = $DatabaseHost
    databaseUser = $DatabaseUser
    databaseName = $DatabaseName
    expectedApiHost = $expectedApiHost
    databaseScript = [System.IO.Path]::GetFullPath($databaseScript)
    integrationScript = [System.IO.Path]::GetFullPath($integrationScript)
    connectionAttempted = $false
    secretsRead = $false
    executable = $false
  } | ConvertTo-Json -Depth 3
  exit 0
}

if (
  [string]::IsNullOrWhiteSpace($env:NEXT_PUBLIC_SUPABASE_URL) -or
  [string]::IsNullOrWhiteSpace($env:SUPABASE_SERVICE_ROLE_KEY)
) {
  throw "C3.5 requires Staging variables in the current process."
}

$apiUri = [System.Uri]$env:NEXT_PUBLIC_SUPABASE_URL
if (-not (Test-Equal $apiUri.Host $expectedApiHost)) {
  throw "C3.5 API identity gate failed."
}

$psql = Get-Command "psql" -ErrorAction Stop
$node = Get-Command "node" -ErrorAction Stop
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
  "--file" $databaseScript

if ($LASTEXITCODE -ne 0) {
  throw "C3.5 C2 migration failed. API integration was not started."
}

& $node.Source `
  "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON" `
  $integrationScript

if ($LASTEXITCODE -ne 0) {
  throw "C3.5 API integration failed. Do not continue with C4."
}

[ordered]@{
  operation = "c3.5-staging-integration"
  mode = "staging"
  projectRef = $expectedProjectRef
  databaseHost = $DatabaseHost
  databaseName = $DatabaseName
  apiHost = $expectedApiHost
  result = "passed-fixtures-removed-c2-retained"
} | ConvertTo-Json -Depth 3
