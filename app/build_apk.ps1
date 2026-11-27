<#
  Builds an installable Android APK on this Windows PC. No Expo/Google account needed.

  Double-click build_apk.bat, or:
      powershell -ExecutionPolicy Bypass -File build_apk.ps1 [-Clean]

  First run downloads Java 17 and the Android SDK (~3-4 GB in total, into C:\android-build)
  and takes 20-45 minutes. Later builds take a few minutes.
  Result: InvitationVideos.apk in this folder. Copy it to the phone and tap it to install.
#>
param([switch]$Clean)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$ToolsDir  = "C:\android-build"
$JdkDir    = Join-Path $ToolsDir "jdk17"
$SdkDir    = Join-Path $ToolsDir "sdk"
$JdkUrl    = "https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip"
$CmdToolsUrl = "https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip"

function Step($m) { Write-Host ""; Write-Host "==> $m" -ForegroundColor Cyan }
function Ok($m)   { Write-Host "    $m" -ForegroundColor Green }
function Warn($m) { Write-Host "    $m" -ForegroundColor Yellow }
function Fail($m) { Write-Host ""; Write-Host "BUILD STOPPED: $m" -ForegroundColor Red; Read-Host "Press Enter to close"; exit 1 }

function Download($url, $out) {
    Write-Host "    downloading $(Split-Path -Leaf $out)..."
    Invoke-WebRequest $url -OutFile $out -UseBasicParsing
}

Set-Location $Root
Write-Host "Invitation Videos - Android APK build" -ForegroundColor White
Write-Host "Project: $Root"
if (-not (Test-Path (Join-Path $Root "package.json"))) { Fail "package.json not found. Put this script in the app folder (the one with App.tsx)." }
if ($Root.Length -gt 40) {
    Warn "This folder path is long. Android builds on Windows can fail on long paths."
    Warn "If the build fails, move the app folder to something short like C:\ia and run again."
}

# ------------------------------------------------------------ Node
Step "Checking Node.js"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail "Node.js is not installed. Install the LTS version from nodejs.org, then run again." }
Ok "Node $(node --version)"

# ------------------------------------------------------------ Java 17
Step "Checking Java 17"
New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
$java = Get-ChildItem $JdkDir -Recurse -Filter java.exe -ErrorAction SilentlyContinue | Where-Object { $_.FullName -like "*\bin\java.exe" } | Select-Object -First 1
if (-not $java) {
    $zip = Join-Path $env:TEMP "jdk17.zip"
    Download $JdkUrl $zip
    Expand-Archive $zip -DestinationPath $JdkDir -Force
    Remove-Item $zip -ErrorAction SilentlyContinue
    $java = Get-ChildItem $JdkDir -Recurse -Filter java.exe | Where-Object { $_.FullName -like "*\bin\java.exe" } | Select-Object -First 1
    if (-not $java) { Fail "Java download did not unpack as expected." }
}
$env:JAVA_HOME = Split-Path -Parent (Split-Path -Parent $java.FullName)
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Ok "JAVA_HOME = $env:JAVA_HOME"

# ------------------------------------------------------------ Android SDK
Step "Checking the Android SDK"
$sdkmanager = Join-Path $SdkDir "cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkmanager)) {
    $zip = Join-Path $env:TEMP "cmdline-tools.zip"
    Download $CmdToolsUrl $zip
    $tmp = Join-Path $ToolsDir "_cmdtools"
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive $zip -DestinationPath $tmp -Force
    Remove-Item $zip -ErrorAction SilentlyContinue
    $latest = Join-Path $SdkDir "cmdline-tools\latest"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $latest) | Out-Null
    if (Test-Path $latest) { Remove-Item $latest -Recurse -Force }
    Move-Item (Join-Path $tmp "cmdline-tools") $latest
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    if (-not (Test-Path $sdkmanager)) { Fail "Android command-line tools did not unpack as expected." }
}
$env:ANDROID_HOME = $SdkDir
$env:ANDROID_SDK_ROOT = $SdkDir
$env:Path = "$SdkDir\platform-tools;$SdkDir\cmdline-tools\latest\bin;$env:Path"

Write-Host "    accepting Android SDK licenses..."
$yes = (1..40 | ForEach-Object { "y" }) -join "`n"
$yes | & $sdkmanager --sdk_root="$SdkDir" --licenses *> $null
if (-not (Test-Path (Join-Path $SdkDir "platform-tools"))) {
    Write-Host "    installing platform-tools..."
    $yes | & $sdkmanager --sdk_root="$SdkDir" "platform-tools" | Out-Null
}
Ok "ANDROID_HOME = $SdkDir  (Gradle downloads the remaining SDK parts it needs)"

# ------------------------------------------------------------ JS dependencies
Step "Installing app dependencies"
if (-not (Test-Path (Join-Path $Root "node_modules"))) {
    npm install
    if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
}
Ok "node_modules ready"

# ------------------------------------------------------------ native project
Step "Generating the Android project"
$android = Join-Path $Root "android"
if ($Clean -and (Test-Path $android)) { Remove-Item $android -Recurse -Force }
if (-not (Test-Path $android)) {
    $env:CI = "1"
    npx expo prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { Fail "expo prebuild failed." }
}
# tell Gradle where the SDK is
Set-Content -Path (Join-Path $android "local.properties") -Value ("sdk.dir=" + ($SdkDir -replace '\\', '\\')) -Encoding ASCII
Ok "android\ folder ready"

# ------------------------------------------------------------ build
Step "Building the APK (first time: 20-45 minutes, lots of downloads)"
Push-Location $android
try {
    & .\gradlew.bat assembleRelease --no-daemon
    $code = $LASTEXITCODE
} finally { Pop-Location }
if ($code -ne 0) { Fail "Gradle build failed. Copy the last 40 lines above and send them to Claude." }

$apk = Get-ChildItem (Join-Path $android "app\build\outputs\apk\release") -Filter *.apk -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $apk) { Fail "Build finished but no APK was found." }
$out = Join-Path $Root "InvitationVideos.apk"
Copy-Item $apk.FullName $out -Force

Write-Host ""
Write-Host "APK ready: $out" -ForegroundColor Green
Write-Host ("Size: {0:N1} MB" -f ((Get-Item $out).Length / 1MB))
Write-Host ""
Write-Host "Install it on Android:"
Write-Host "  1. Copy InvitationVideos.apk to the phone (USB cable, Google Drive, or WhatsApp it to yourself as a document)."
Write-Host "  2. Tap it on the phone and allow 'Install unknown apps' when asked."
Write-Host ""
Write-Host "After changing the app code, run build_apk.bat again (much faster). After adding a package, use -Clean."
Read-Host "Press Enter to close"
