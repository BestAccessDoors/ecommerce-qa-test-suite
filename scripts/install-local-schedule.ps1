<#
  Registers (or removes) the Windows Task Scheduler task that runs the whole store suite on this
  machine at 10:00 and 15:00 on weekdays and publishes a summary for the morning dashboard review.

  Install:    right-click this file -> Run with PowerShell
              (or: powershell -ExecutionPolicy Bypass -File scripts\install-local-schedule.ps1)
  Remove:     powershell -ExecutionPolicy Bypass -File scripts\install-local-schedule.ps1 -Uninstall
  Run now:    Start-ScheduledTask -TaskName "BEST QA local run"

  The task runs as you, only while you are signed in, so it finds your credentials.json and
  GitHub token under %LOCALAPPDATA%\BestAccessDoorsTests and Chrome has a desktop to run in.
  It wakes the laptop if it is asleep, runs as soon as possible after a missed start (laptop
  off or asleep at 10:00), and never runs twice at once.
#>
param(
  [switch]$Uninstall,
  [string[]]$Times = @('10:00', '15:00')
)

$ErrorActionPreference = 'Stop'
$TaskName = 'BEST QA local run'

if ($Uninstall) {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed the task `"$TaskName`"."
  } else {
    Write-Host "There is no task named `"$TaskName`"."
  }
  exit 0
}

$repo = Split-Path -Parent $PSScriptRoot
$bat = Join-Path $repo 'Scheduled Local Run.bat'
if (-not (Test-Path $bat)) { throw "Cannot find `"$bat`"." }

$tokenFile = Join-Path $env:LOCALAPPDATA 'BestAccessDoorsTests\github-token.txt'
if (-not (Test-Path $tokenFile) -and -not $env:GITHUB_LOCAL_RUNS_TOKEN) {
  Write-Warning "No GitHub token found at $tokenFile."
  Write-Warning 'Runs will still happen, but nothing reaches the dashboard until you add it (see MAINTENANCE.md).'
}

$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"`"$bat`"`"" -WorkingDirectory $repo
$weekdays = 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
$triggers = foreach ($t in $Times) {
  New-ScheduledTaskTrigger -Weekly -DaysOfWeek $weekdays -At $t
}
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -WakeToRun `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Settings $settings `
  -Principal $principal -Description 'Runs the Best Access Doors store tests and publishes a summary for the QA dashboard.' `
  -Force | Out-Null

Write-Host ''
Write-Host "Installed `"$TaskName`": weekdays at $($Times -join ' and ')."
Write-Host 'Output of each run goes to results\scheduled-local.log.'
Write-Host 'To try it now:  Start-ScheduledTask -TaskName "BEST QA local run"'
Write-Host ''
Read-Host 'Press Enter to close'
