[CmdletBinding()]
param(
  [switch]$RequireAvailable
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$result = [ordered]@{
  phase = "2A.2a"
  executionPerformed = $false
  tools = [ordered]@{}
}

foreach ($toolName in @("pg_dump", "psql")) {
  $command = Get-Command $toolName -ErrorAction SilentlyContinue

  $result.tools[$toolName] = [ordered]@{
    available = $null -ne $command
    path = if ($command) { $command.Source } else { $null }
    versionChecked = $false
    version = $null
  }
}

$missingTools = @(
  $result.tools.GetEnumerator() |
    Where-Object { -not $_.Value.available } |
    ForEach-Object { $_.Key }
)

if ($RequireAvailable -and $missingTools.Count -gt 0) {
  throw "Required PostgreSQL client tools are missing: $($missingTools -join ', ')."
}

$result | ConvertTo-Json -Depth 5
