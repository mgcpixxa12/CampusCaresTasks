#!/bin/bash
# ==========================================================
# 4-Week Planner - Local Server Launcher (Linux)
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
  exit 1
fi

echo "Starting local server on $URL"
$PY -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!

sleep 1

if command -v google-chrome >/dev/null 2>&1; then
  google-chrome --incognito "$URL" >/dev/null 2>&1 &
elif command -v chromium >/dev/null 2>&1; then
  chromium --incognito "$URL" >/dev/null 2>&1 &
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$URL" >/dev/null 2>&1 &
fi

echo "Server is running (PID $SERVER_PID). Ctrl+C to stop."
wait $SERVER_PID
