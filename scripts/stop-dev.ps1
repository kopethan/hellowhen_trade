[CmdletBinding()]
param(
  [int[]]$Ports = @(3000, 3001, 4000, 8081, 19000, 19001, 19002),
  [int[]]$ProcessIds = @(),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$targets = @{}

function Add-Target {
  param(
    [Parameter(Mandatory = $true)][int]$ProcessId,
    [Parameter(Mandatory = $true)][string]$Reason
  )

  if ($ProcessId -eq $PID) {
    return
  }

  try {
    $process = Get-Process -Id $ProcessId -ErrorAction Stop
  } catch {
    return
  }

  if (-not $targets.ContainsKey($ProcessId)) {
    $targets[$ProcessId] = [ordered]@{
      Process = $process
      Reasons = New-Object System.Collections.Generic.List[string]
    }
  }

  $targets[$ProcessId].Reasons.Add($Reason)
}

foreach ($processId in $ProcessIds) {
  Add-Target -ProcessId $processId -Reason 'explicit PID'
}

foreach ($port in $Ports) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  } catch {
    Write-Warning "Could not inspect port $port. Try running PowerShell as Administrator if this keeps happening."
    continue
  }

  foreach ($connection in $connections) {
    Add-Target -ProcessId $connection.OwningProcess -Reason "listening on port $port"
  }
}

if ($targets.Count -eq 0) {
  Write-Host "No matching dev processes are running."
  exit 0
}

foreach ($entry in $targets.GetEnumerator() | Sort-Object Name) {
  $process = $entry.Value.Process
  $reasons = ($entry.Value.Reasons | Select-Object -Unique) -join ', '
  $label = "$($process.ProcessName) PID $($process.Id) ($reasons)"

  if ($DryRun) {
    Write-Host "Would stop $label"
    continue
  }

  try {
    Stop-Process -Id $process.Id -Force -ErrorAction Stop
    Write-Host "Stopped $label"
  } catch {
    Write-Warning "Failed to stop ${label}: $($_.Exception.Message)"
  }
}
