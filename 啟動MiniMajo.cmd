@echo off
cd /d "%~dp0"
node editor-server.cjs --open
if errorlevel 1 pause
