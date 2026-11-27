@echo off
REM Restarts the background worker (needs Administrator).
powershell -NoProfile -Command "Start-Process powershell -Verb RunAs -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','%~dp0restart_worker.ps1'"
