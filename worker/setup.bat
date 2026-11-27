@echo off
REM Double-click to set up the invitation video worker on this PC.
cd /d "%~dp0"
echo.
echo  Invitation video worker setup
echo  -----------------------------
echo  This installs Python and FFmpeg if needed, sets up the worker and renders a test video.
echo.
set AUTO=
set /p AUTO="Also start the worker automatically at every boot and stop the PC from sleeping? (y/n): "
if /i "%AUTO%"=="y" (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1" -AutoStart -NoSleep
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
)
