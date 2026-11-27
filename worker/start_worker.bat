@echo off
REM Change this to the folder where you unzipped invite_worker
cd /d C:\invite_worker
call .venv\Scripts\activate
python worker.py watch-cloudinary
pause
