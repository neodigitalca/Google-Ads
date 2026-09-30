@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File "%~dp0scripts\start-local.ps1" -OpenBrowser
if errorlevel 1 (
  echo.
  echo Startup failed. See messages above.
  pause
)
