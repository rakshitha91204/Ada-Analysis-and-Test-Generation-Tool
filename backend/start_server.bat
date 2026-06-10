@echo off
REM ============================================================
REM  Ada Analysis Tool — Backend Server Startup
REM  Author: Rakshitha
REM
REM  libadalang is bundled with GNAT Studio's Python.
REM  This script uses that Python to run the FastAPI server.
REM
REM  Requirements:
REM    - GNAT Studio installed at C:\GNATSTUDIO
REM      (Free download: https://github.com/AdaCore/gnatstudio/releases)
REM
REM  Usage:
REM    Double-click start_server.bat  OR  run from terminal
REM  Server will be available at: http://localhost:8001
REM ============================================================

cd /d "%~dp0"

REM ── Find GNAT Python ────────────────────────────────────────
set GNAT_PYTHON=C:\GNATSTUDIO\share\gnatstudio\python\python.exe

if not exist "%GNAT_PYTHON%" (
    echo.
    echo  [ERROR] GNAT Studio Python not found at:
    echo    %GNAT_PYTHON%
    echo.
    echo  libadalang requires GNAT Studio to be installed.
    echo  Download free from:
    echo    https://github.com/AdaCore/gnatstudio/releases
    echo.
    echo  After installing, re-run this script.
    echo.
    pause
    exit /b 1
)

echo ============================================================
echo  Ada Analysis Tool API  v2.0.0
echo  Python  : %GNAT_PYTHON%
echo  Server  : http://localhost:8001
echo  Frontend: http://localhost:5173
echo ============================================================
echo.

REM ── Install FastAPI/uvicorn if missing ───────────────────────
%GNAT_PYTHON% -c "import fastapi" 2>nul
if errorlevel 1 (
    echo [INFO] Installing FastAPI dependencies...
    %GNAT_PYTHON% -m pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
    echo.
)

%GNAT_PYTHON% -c "import uvicorn" 2>nul
if errorlevel 1 (
    echo [INFO] Installing uvicorn...
    %GNAT_PYTHON% -m pip install "uvicorn[standard]==0.29.0"
    echo.
)

echo [INFO] Starting server... Press Ctrl+C to stop.
echo.

%GNAT_PYTHON% -m uvicorn server:app --host 0.0.0.0 --port 8001

echo.
echo [INFO] Server stopped.
pause
