#!/usr/bin/env bash
# Invitation video worker - macOS / Linux setup
#   bash setup.sh            install + test render
#   bash setup.sh --skip-test
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(pwd)"
say() { printf '\n==> %s\n' "$1"; }

say "Checking FFmpeg"
if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then brew install ffmpeg
  elif command -v apt-get >/dev/null 2>&1; then sudo apt-get update && sudo apt-get install -y ffmpeg
  elif command -v dnf >/dev/null 2>&1; then sudo dnf install -y ffmpeg
  else echo "Please install FFmpeg, then run this again."; exit 1; fi
fi
echo "    $(command -v ffmpeg)"

say "Checking Python 3.10+"
PY=""
for c in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)'; then PY="$(command -v "$c")"; break; fi
done
if [ -z "$PY" ]; then
  if command -v brew >/dev/null 2>&1; then brew install python@3.12; PY="$(command -v python3.12)"
  elif command -v apt-get >/dev/null 2>&1; then sudo apt-get install -y python3 python3-venv; PY="$(command -v python3)"
  else echo "Please install Python 3.10 or newer, then run this again."; exit 1; fi
fi
echo "    $PY"

say "Installing the worker's Python packages"
[ -x .venv/bin/python ] || "$PY" -m venv .venv
.venv/bin/python -m pip install --upgrade pip --quiet --disable-pip-version-check
.venv/bin/python -m pip install -r requirements.txt --quiet --disable-pip-version-check

say "Preparing .env"
[ -f .env ] || { cp .env.example .env; echo "    created .env"; }
mkdir -p logs jobs/inbox

if [ "${1:-}" != "--skip-test" ]; then
  say "Test render of jobs/sample_job.json (1-3 minutes)"
  .venv/bin/python worker.py run jobs/sample_job.json
fi

cat <<EOF

Setup finished.
  1. Edit .env and fill in CLOUDINARY_URL (and ANTHROPIC_API_KEY for card photos).
  2. Run:  .venv/bin/python worker.py watch-cloudinary
  To keep it running after logout:  nohup .venv/bin/python -u worker.py watch-cloudinary >> logs/worker.log 2>&1 &
EOF
