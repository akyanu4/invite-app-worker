<#
  Invitation video worker - Windows setup

  Double-click setup.bat (it runs this script as Administrator), or from PowerShell:
      powershell -ExecutionPolicy Bypass -File setup.ps1 [-AutoStart] [-NoSleep] [-SkipTest]

  What it does
    1. Installs Python 3.12 and FFmpeg with winget (skips anything already installed)
    2. Creates a private Python environment (.venv) and installs the worker's packages
    3. Creates .env from .env.example and records where FFmpeg is
    4. Renders jobs\sample_job.json as a test
    5. Optional: -AutoStart  starts the worker (watch-cloudinary) at every boot via Task Scheduler
                 -NoSleep    stops the PC from sleeping when plugged in
#>
param(
    [switch]$AutoStart,
    [switch]$NoSleep,
    [switch]$SkipTest
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $Root
$TaskName = "InvitationVideoWorker"

function Step($msg) { Write-Host ""; Write-Host "==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host ""; Write-Host "SETUP STOPPED: $msg" -ForegroundColor Red; Read-Host "Press Enter to close"; exit 1 }

function Refresh-Path {
    $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [Environment]::GetEnvironmentVariable("Path", "User") + ";" +
                (Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Links")
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Re-launch as Administrator when Task Scheduler / power settings are needed
if (($AutoStart -or $NoSleep) -and -not (Test-Admin)) {
    Write-Host "Asking for Administrator rights (needed for -AutoStart / -NoSleep)..."
    $argList = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$($MyInvocation.MyCommand.Path)`"")
    if ($AutoStart) { $argList += "-AutoStart" }
    if ($NoSleep)   { $argList += "-NoSleep" }
    if ($SkipTest)  { $argList += "-SkipTest" }
    Start-Process powershell -Verb RunAs -ArgumentList $argList
    exit 0
}

function Find-Python {
    # Returns the full path of a real Python 3.10+ (ignores the Microsoft Store stub)
    $candidates = @()
    if (Get-Command py -ErrorAction SilentlyContinue) {
        try { $candidates += (& py -3 -c "import sys; print(sys.executable)" 2>$null) } catch {}
    }
    foreach ($name in @("python", "python3")) {
        $c = Get-Command $name -ErrorAction SilentlyContinue
        if ($c -and $c.Source -notlike "*WindowsApps*") { $candidates += $c.Source }
    }
    $candidates += Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe", "$env:ProgramFiles\Python3*\python.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName
    foreach ($p in $candidates) {
        if (-not $p -or -not (Test-Path $p)) { continue }
        try {
            $ok = & $p -c "import sys; print(int(sys.version_info >= (3, 10)))" 2>$null
            if ($ok -eq "1") { return $p }
        } catch {}
    }
    return $null
}

function Find-FFmpegDir {
    # 1. our own copy (downloaded by this script)
    $own = Get-ChildItem (Join-Path $Root "tools\ffmpeg") -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($own) { return $own.DirectoryName }
    # 2. anything on PATH (resolve winget's link to the real file)
    $c = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if ($c) {
        try {
            $item = Get-Item $c.Source
            if ($item.LinkType -and $item.Target) {
                $target = @($item.Target)[0]
                if (-not [IO.Path]::IsPathRooted($target)) { $target = Join-Path $item.DirectoryName $target }
                if (Test-Path $target) { return Split-Path -Parent $target }
            }
        } catch {}
        return Split-Path -Parent $c.Source
    }
    # 3. every place winget (user or machine scope) and manual installs usually put it
    $roots = @(
        "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
        "$env:ProgramFiles\WinGet\Packages",
        "$env:LOCALAPPDATA\Microsoft\WinGet\Links",
        "$env:ProgramFiles\WinGet\Links",
        "C:\ffmpeg", "$env:ProgramFiles\ffmpeg", "C:\ProgramData\chocolatey\bin"
    )
    foreach ($r in $roots) {
        if (-not (Test-Path $r)) { continue }
        $f = Get-ChildItem $r -Recurse -Filter ffmpeg.exe -ErrorAction SilentlyContinue |
             Where-Object { $_.Length -gt 1MB } | Select-Object -First 1
        if ($f) { return $f.DirectoryName }
    }
    return $null
}

function Download-FFmpeg {
    # Portable FFmpeg straight into the worker folder - no PATH changes needed
    $dest = Join-Path $Root "tools\ffmpeg"
    $zip  = Join-Path $env:TEMP "ffmpeg-release-essentials.zip"
    Write-Host "    Downloading FFmpeg (about 100 MB) from gyan.dev..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = "SilentlyContinue"
    Invoke-WebRequest "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -OutFile $zip -UseBasicParsing
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Expand-Archive $zip -DestinationPath $dest -Force
    Remove-Item $zip -ErrorAction SilentlyContinue
}

function Have-Winget { [bool](Get-Command winget -ErrorAction SilentlyContinue) }

Write-Host "Invitation video worker setup" -ForegroundColor White
Write-Host "Folder: $Root"
if ($Root -match " ") { Warn "This folder path has spaces. It should still work, but C:\invite_worker is safest." }

# ---------------------------------------------------------------- 1. Python
Step "Checking Python"
$Python = Find-Python
if (-not $Python) {
    if (-not (Have-Winget)) { Fail "Python not found and winget is unavailable. Install Python 3.12 from python.org (tick 'Add python.exe to PATH'), then run setup again." }
    Write-Host "    Installing Python 3.12 (a few minutes)..."
    winget install -e --id Python.Python.3.12 --accept-source-agreements --accept-package-agreements --silent
    Refresh-Path
    $Python = Find-Python
    if (-not $Python) { Fail "Python was installed but can't be found yet. Close this window, open a new one and run setup again." }
}
Ok "Python: $Python"

# ---------------------------------------------------------------- 2. FFmpeg
Step "Checking FFmpeg"
Refresh-Path
$FFDir = Find-FFmpegDir
if (-not $FFDir -and (Have-Winget)) {
    Write-Host "    Installing FFmpeg with winget..."
    winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements --silent
    Refresh-Path
    $FFDir = Find-FFmpegDir
}
if (-not $FFDir) {
    try { Download-FFmpeg } catch { Warn "Download failed: $($_.Exception.Message)" }
    $FFDir = Find-FFmpegDir
}
if (-not $FFDir) { Fail "Could not find or download FFmpeg. Download https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip, unzip it into $Root\tools\ffmpeg, then run setup again." }
$env:Path = "$FFDir;$env:Path"
Ok "FFmpeg: $FFDir"

# ---------------------------------------------------------------- 3. venv + packages
Step "Installing the worker's Python packages"
$VenvPy = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $VenvPy)) {
    & $Python -m venv (Join-Path $Root ".venv")
    if ($LASTEXITCODE -ne 0) { Fail "Could not create the Python environment (.venv)." }
}
& $VenvPy -m pip install --upgrade pip --quiet --disable-pip-version-check
& $VenvPy -m pip install -r (Join-Path $Root "requirements.txt") --quiet --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { Fail "Installing packages failed. Check the internet connection and run setup again." }
Ok "Packages installed in .venv"

# ---------------------------------------------------------------- 4. .env
Step "Preparing .env"
$EnvFile = Join-Path $Root ".env"
if (-not (Test-Path $EnvFile)) {
    Copy-Item (Join-Path $Root ".env.example") $EnvFile
    Ok "Created .env from .env.example"
} else {
    Ok ".env already exists (kept as is)"
}
$envText = Get-Content $EnvFile -Raw
if ($envText -match "(?m)^FFMPEG_DIR=") {
    $envText = $envText -replace "(?m)^FFMPEG_DIR=.*$", "FFMPEG_DIR=$FFDir"
} else {
    $envText = $envText.TrimEnd() + "`r`n`r`n# Written by setup.ps1`r`nFFMPEG_DIR=$FFDir`r`n"
}
Set-Content -Path $EnvFile -Value $envText -Encoding UTF8
New-Item -ItemType Directory -Force -Path (Join-Path $Root "logs"), (Join-Path $Root "jobs\inbox") | Out-Null
Ok "FFmpeg location saved to .env"

# ---------------------------------------------------------------- 5. test render
if (-not $SkipTest) {
    Step "Test render of jobs\sample_job.json (1-3 minutes)"
    & $VenvPy (Join-Path $Root "worker.py") run (Join-Path $Root "jobs\sample_job.json")
    $out = Join-Path $Root "output\sample-valima.mp4"
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out)) { Fail "The test render failed. Copy the error above and send it to Claude." }
    Ok "Test video: $out"
}

# ---------------------------------------------------------------- 6. power
if ($NoSleep) {
    Step "Stopping sleep when plugged in"
    powercfg /change standby-timeout-ac 0
    powercfg /change hibernate-timeout-ac 0
    Ok "Sleep and hibernate disabled on AC power"
    Warn "Also turn on 'Restore on AC power loss' in the BIOS so the PC restarts after a power cut."
}

# ---------------------------------------------------------------- 7. auto start
if ($AutoStart) {
    Step "Registering the worker to start at boot"
    $envNow = Get-Content $EnvFile -Raw
    if ($envNow -match "API_KEY:API_SECRET@CLOUD_NAME" -or $envNow -notmatch "(?m)^CLOUDINARY_URL=cloudinary://") {
        Warn "CLOUDINARY_URL in .env still looks like the example. Edit .env before the next restart."
    }
    $log = Join-Path $Root "logs\worker.log"
    $cmd = "`"$VenvPy`" -u `"$(Join-Path $Root 'worker.py')`" watch-cloudinary >> `"$log`" 2>&1"
    # Outer quotes are required: cmd /c strips the first and last quote of the line
    $action    = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$cmd`"" -WorkingDirectory $Root
    $trigger   = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = "PT1M"   # give the network a minute after boot
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
                   -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
                   -ExecutionTimeLimit ([TimeSpan]::Zero)
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
    Ok "Task '$TaskName' runs at every boot (no login needed). Log: $log"
    $start = Read-Host "    Start it now? (y/n)"
    if ($start -match "^[yY]") { Start-ScheduledTask -TaskName $TaskName; Ok "Started. Watch logs\worker.log" }
}

# ---------------------------------------------------------------- done
Write-Host ""
Write-Host "Setup finished." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  1. Open .env in Notepad and fill in CLOUDINARY_URL (and ANTHROPIC_API_KEY for card photos)."
Write-Host "  2. Try:  .venv\Scripts\python worker.py watch-cloudinary"
if (-not $AutoStart) { Write-Host "  3. To start it at every boot, run setup again with -AutoStart (or use setup.bat and answer y)." }
Write-Host ""
Write-Host "Useful: Stop the background worker   ->  schtasks /End /TN $TaskName"
Write-Host "        Remove auto start            ->  schtasks /Delete /TN $TaskName /F"
Read-Host "Press Enter to close"
