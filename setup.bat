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

REM ── Backend: install Python packages ─────────────────────────
echo [....] Installing Python packages...
call "%VENV%\Scripts\activate.bat"
pip install -r "%REQUIREMENTS%" --quiet
if errorlevel 1 ( echo [ERROR] pip install failed. & pause & exit /b 1 )
echo [OK]   Python packages installed.

echo.

REM ── Backend: create .env if missing ──────────────────────────
if exist "%ENV_FILE%" (
    echo [SKIP] backend\.env already exists.
) else (
    copy "%ENV_EXAMPLE%" "%ENV_FILE%" >nul
    echo [OK]   Created backend\.env from .env.example.
    echo.
    echo   ** For local development the defaults work as-is (SQLite).
    echo   ** For production: set DATABASE_URL, SECRET_KEY, and
    echo      ALLOWED_ORIGINS in backend\.env before deploying.
)

echo.

REM ── Backend: run database migrations ─────────────────────────
echo [....] Running database migrations...
cd /d "%BACKEND%"
alembic upgrade head
if errorlevel 1 (
    echo [ERROR] Migration failed. Check the output above.
    pause & exit /b 1
)
echo [OK]   Database schema is up to date.

echo.

REM ── Backend: seed admin account ──────────────────────────────
echo  Create the default admin account?
echo  (username: admin  /  password: admin123)
echo  Answer N if you have already set up accounts before.
echo.
set /p SEED_CONFIRM=  Create admin account? (y/N):
if /i "%SEED_CONFIRM%"=="y" (
    echo [....] Creating admin account...
    python -c "import sys; sys.path.insert(0,'.'); from app.database import SessionLocal; from seed.seed_users import seed_users; s=SessionLocal(); n=seed_users(s); s.commit(); s.close(); print('[OK]   Admin account created.' if n else '[SKIP] Admin account already exists.')"
    if errorlevel 1 ( echo [WARN] Seed step failed — account may already exist. )
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
echo  Next steps:
echo    1. Double-click start.bat to launch the app
echo    2. Log in at http://localhost:5173  (admin / admin123)
echo    3. Go to Admin to create companies and assign users
echo.
echo  To import legacy DBF data (optional, one-time):
echo    1. Set GLPACK_DATA_DIR in backend\.env to your DBF folder
echo    2. Open a terminal in backend\
echo    3. Run: .venv\Scripts\activate
echo    4. Run: python seed\run_all.py
echo.
pause
