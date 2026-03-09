@echo off
REM ==========================================================
REM 4-Week Planner - Local Server Launcher (Windows)
REM ==========================================================

cd /d "%~dp0"

set PORT=8000
set URL=http://localhost:%PORT%/index.html

REM Find Python
where python >nul 2>nul
if %errorlevel%==0 (
  set PYTHON=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PYTHON=py -3
  ) else (
    echo Python not found. Install from https://www.python.org/
    pause
    exit /b 1
  )
)

echo Starting local server on %URL%
start "" %PYTHON% -m http.server %PORT%

timeout /t 1 >nul

REM Try Chrome locations explicitly (no delayed expansion)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --incognito "%URL%"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" --incognito "%URL%"
) else (
  echo Chrome not found. Opening default browser...
  start "" "%URL%"
)

echo.
echo Server running. Press Ctrl+C to stop.
pause >nul
