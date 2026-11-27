@echo off
REM Double-click to build an installable Android APK (no account needed).
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build_apk.ps1" %*
