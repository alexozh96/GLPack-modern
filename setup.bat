@echo off
title GLPack Modern — Setup
setlocal

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend
set VENV=%BACKEND%\.venv
set ENV_FILE=%BACKEND%\.env
set ENV_EXAMPLE=%BACKEND%\.env.example
set REQUIREMENTS=%BACKEND%\requirements.txt

echo ============================================================
echo  GLPack Modern — First-Time Setup
echo ============================================================
echo.

REM ── Check Python ─────────────────────────────────────────────
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Install Python 3.x from https://python.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('python --version 2^>^&1') do echo [OK] %%v

REM ── Check Node.js ────────────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install Node.js from https://nodejs.org
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version 2^>^&1') do echo [OK] Node.js %%v

echo.

REM ── Backend: create venv if missing ──────────────────────────
if exist "%VENV%\Scripts\activate.bat" (
    echo [SKIP] Virtual environment already exists.
) else (
    echo [....] Creating virtual environment...
    python -m venv "%VENV%"
    if errorlevel 1 ( echo [ERROR] Failed to create venv. & pause & exit /b 1 )
    echo [OK]   Virtual environment created.
)

REM ── Backend: install packages ─────────────────────────────────
echo [....] Installing Python packages...
call "%VENV%\Scripts\activate.bat"
pip install -r "%REQUIREMENTS%" --quiet
if errorlevel 1 ( echo [ERROR] pip install failed. & pause & exit /b 1 )
echo [OK]   Python packages installed.

REM ── Backend: create .env if missing ──────────────────────────
if exist "%ENV_FILE%" (
    echo [SKIP] .env already exists.
) else (
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    echo [OK]   Created backend\.env from .env.example.
    echo.
    echo   ** Open backend\.env and set GLPACK_DATA_DIR if you are
    echo      importing legacy data. Otherwise leave it as-is.
)

echo.

REM ── Frontend: install node modules ───────────────────────────
echo [....] Installing frontend packages (npm install)...
cd /d "%FRONTEND%"
call npm install --silent
if errorlevel 1 ( echo [ERROR] npm install failed. & pause & exit /b 1 )
echo [OK]   Frontend packages installed.

echo.
echo ============================================================
echo  Setup complete!
echo ============================================================
echo.
echo  To run the app:   double-click start.bat
echo.
echo  To import legacy data (optional, one-time only):
echo    1. Set GLPACK_DATA_DIR in backend\.env to your DBF folder
echo    2. Open a terminal in backend\
echo    3. Run: .venv\Scripts\activate
echo    4. Run: python seed/run_all.py
echo.
pause
