# Restarts the background worker so it picks up new code or templates.
# `schtasks /End` only stops the task's cmd.exe; the Python worker it started keeps running, so stop that too.
$ErrorActionPreference = "Continue"
$TaskName = "InvitationVideoWorker"
schtasks /End /TN $TaskName | Out-Null
Get-CimInstance Win32_Process -Filter "name='python.exe'" |
    Where-Object { $_.CommandLine -like '*worker.py*watch-cloudinary*' } |
    ForEach-Object { Write-Host "Stopping old worker (PID $($_.ProcessId))"; Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 3
schtasks /Run /TN $TaskName | Out-Null
Write-Host "Worker restarted. In about 30 seconds logs\worker.log should show 'published ... template(s)'." -ForegroundColor Green
Read-Host "Press Enter to close"
