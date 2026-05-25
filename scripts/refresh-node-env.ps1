function Get-PersistedEnvironmentValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $userValue = [Environment]::GetEnvironmentVariable($Name, 'User')
  if ($userValue) {
    return $userValue
  }

  return [Environment]::GetEnvironmentVariable($Name, 'Machine')
}

$env:NVM_HOME = Get-PersistedEnvironmentValue -Name 'NVM_HOME'
$env:NVM_SYMLINK = Get-PersistedEnvironmentValue -Name 'NVM_SYMLINK'

$persistedMachinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$persistedUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$expandedPath = [Environment]::ExpandEnvironmentVariables(($persistedMachinePath, $persistedUserPath -join ';'))

$dedupedEntries = New-Object 'System.Collections.Generic.List[string]'
$seen = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

foreach ($entry in (($expandedPath -split ';') + @($env:NVM_HOME, $env:NVM_SYMLINK))) {
  $trimmedEntry = $entry.Trim()
  if (-not $trimmedEntry) {
    continue
  }

  if ($seen.Add($trimmedEntry)) {
    $dedupedEntries.Add($trimmedEntry)
  }
}

$env:Path = $dedupedEntries -join ';'

$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$npmCommand = Get-Command npm -ErrorAction SilentlyContinue

if (-not $nodeCommand -or -not $npmCommand) {
  Write-Error 'Node.js is still not available in this terminal. Reopen VS Code after confirming your NVM/Node installation.'
  exit 1
}

Write-Output ('node: ' + (& node -v))
Write-Output ('npm:  ' + (& npm -v))
Write-Output ('PATH entry: ' + $npmCommand.Source)