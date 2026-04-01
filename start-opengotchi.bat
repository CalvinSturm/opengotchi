@echo off
setlocal

cd /d "%~dp0"

if not exist package.json (
  echo package.json not found. Run this from the OpenGotchi repo folder.
  pause
  exit /b 1
)

call npm run tauri -- dev

if errorlevel 1 (
  echo.
  echo OpenGotchi failed to start.
  echo If this is your first run, try: npm install
  pause
  exit /b 1
)
