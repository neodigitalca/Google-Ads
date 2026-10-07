@echo off
setlocal
cd /d "%~dp0"
node scripts/backup-refactor-audit.mjs %*
exit /b %ERRORLEVEL%
