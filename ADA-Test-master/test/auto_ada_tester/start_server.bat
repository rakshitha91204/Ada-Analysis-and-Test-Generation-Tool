@echo off
REM ============================================================
REM  Ada Analysis Tool — Backend Server Startup
REM  Uses the GNAT Studio Python which has libadalang bundled.
REM ============================================================

cd /d "%~dp0"

set PYTHON=C:\GNATSTUDIO\share\gnatstudio\python\python.exe

echo ============================================================
echo  Ada Analysis Tool API
echo  Python : %PYTHON%
echo  Server : http://localhost:8000
echo ============================================================
echo.

REM Install FastAPI deps if missing
%PYTHON% -c "import fastapi" 2>nul || (
    echo [INFO] Installing FastAPI dependencies...
    %PYTHON% -m pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
    echo.
)

echo [INFO] Starting server on http://localhost:8001 ... Press Ctrl+C to stop.
echo.

%PYTHON% server.py
pause
