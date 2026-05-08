[CmdletBinding()]
param(
  [int[]]$Ports = @(3000, 3001, 4000, 8081, 19000, 19001, 19002),
  [int[]]$ProcessIds = @(),
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$repoRootForward = $repoRoot -replace '\\', '/'
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

function Get-DevProcesses {
  try {
    Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
      $commandLine = $_.CommandLine
      if ([string]::IsNullOrWhiteSpace($commandLine)) {
        return $false
      }

      $commandLine.Contains($repoRoot) -or
        $commandLine.Contains($repoRootForward) -or
        $commandLine -match 'run\s+dev:(api|web|mobile)' -or
        $commandLine -match 'run\s+dev\s+-w\s+@hellowhen/(api|web|mobile)' -or
        $commandLine -match '@hellowhen/(api|web|mobile)'
    }
  } catch {
    Write-Warning "Could not inspect dev process command lines: $($_.Exception.Message)"
    @()
  }
}

function Add-ProcessFamily {
  param(
    [Parameter(Mandatory = $true)][int]$RootProcessId,
    [Parameter(Mandatory = $true)][string]$Reason
  )

  $processes = @(Get-DevProcesses)
  $byParent = @{}

  foreach ($process in $processes) {
    $parentId = [int]$process.ParentProcessId
    if (-not $byParent.ContainsKey($parentId)) {
      $byParent[$parentId] = New-Object System.Collections.Generic.List[object]
    }
    $byParent[$parentId].Add($process)
  }

  $queue = New-Object System.Collections.Generic.Queue[int]
  $queue.Enqueue($RootProcessId)

  while ($queue.Count -gt 0) {
    $currentId = $queue.Dequeue()
    Add-Target -ProcessId $currentId -Reason $Reason

    if ($byParent.ContainsKey($currentId)) {
      foreach ($child in $byParent[$currentId]) {
        $queue.Enqueue([int]$child.ProcessId)
      }
    }
  }

  $current = $processes | Where-Object { [int]$_.ProcessId -eq $RootProcessId } | Select-Object -First 1
  while ($current) {
    $parent = $processes | Where-Object { [int]$_.ProcessId -eq [int]$current.ParentProcessId } | Select-Object -First 1
    if (-not $parent) {
      break
    }

    Add-Target -ProcessId ([int]$parent.ProcessId) -Reason "parent of $RootProcessId"
    $current = $parent
  }
}

foreach ($processId in $ProcessIds) {
  Add-ProcessFamily -RootProcessId $processId -Reason 'explicit PID'
}

foreach ($port in $Ports) {
  try {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  } catch {
    Write-Warning "Could not inspect port $port. Try running PowerShell as Administrator if this keeps happening."
    continue
  }

  foreach ($connection in $connections) {
    Add-ProcessFamily -RootProcessId $connection.OwningProcess -Reason "listening on port $port"
  }
}

foreach ($process in Get-DevProcesses) {
  Add-ProcessFamily -RootProcessId ([int]$process.ProcessId) -Reason 'repo dev process'
}

if ($targets.Count -eq 0) {
  Write-Host 'No matching dev processes are running.'
  exit 0
}

foreach ($entry in $targets.GetEnumerator() | Sort-Object Name -Descending) {
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
