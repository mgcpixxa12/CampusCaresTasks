#!/bin/bash
# ==========================================================
# 4-Week Planner - Local Server Launcher (macOS)
# ==========================================================

cd "$(dirname "$0")" || exit 1

PORT=8000
URL="http://localhost:${PORT}/index.html"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "Python not found. Install Python 3 and try again."
  read -p "Press Enter to exit..."
  exit 1
fi

echo "Starting local server on $URL"
$PY -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!

sleep 1

open -a "Google Chrome" --args --incognito "$URL" >/dev/null 2>&1 || open "$URL"

echo ""
echo "Server is running (PID $SERVER_PID)."
echo "Press Ctrl+C to stop."
wait $SERVER_PID
