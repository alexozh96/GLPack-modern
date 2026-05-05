@echo off
title GLPack Modern

set ROOT=%~dp0
set BACKEND=%~dp0backend
set FRONTEND=%~dp0frontend
set VENV=%~dp0backend\.venv\Scripts\activate.bat

echo Starting GLPack Modern...
echo.

REM ── Backend ──────────────────────────────────────────────────────────────────
start "GLPack — Backend" cmd /k "call "%VENV%" && cd /d "%BACKEND%" && uvicorn app.main:app --reload"

REM ── Frontend ─────────────────────────────────────────────────────────────────
start "GLPack — Frontend" cmd /k "cd /d "%FRONTEND%" && npm run dev"

REM ── Open browser once frontend has had time to start ─────────────────────────
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
