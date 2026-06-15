#!/bin/bash
# ============================================================
#  Ada Analysis Tool — Backend Server (Linux/Mac)
#  Author: Rakshitha
#
#  Uses libadalang built via Alire (NOT GNAT Studio).
#
#  Prerequisites (one-time setup):
#    1. Install Alire: https://alire.ada.dev/
#    2. Build libadalang:
#         alr get libadalang
#         cd libadalang_26.0.0_*/
#         LIBRARY_TYPE=relocatable alr build
#    3. Create venv and install deps:
#         cd /path/to/project/backend/
#         python3.10 -m venv venv
#         source venv/bin/activate
#         pip install -r requirements.txt
#
#  Every new terminal session:
#    1. cd into libadalang build dir and load env:
#         cd ~/Desktop/Libadalang/unit_test/libadalang_26.0.0_*/
#         eval "$(alr printenv)"
#    2. cd to project backend and activate venv:
#         cd /path/to/project/backend/
#         source venv/bin/activate
#    3. Run this script:
#         bash start_server_linux.sh
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  Ada Analysis Tool API  v2.0.0"
echo "  Python  : $(python3 --version 2>&1)"
echo "  Port    : 8001"
echo "  Frontend: http://localhost:5173"
echo "============================================================"
echo ""

# Check libadalang is importable (don't use set -e here so we can show error)
if ! python3 -c "import libadalang" 2>/dev/null; then
    echo "ERROR: libadalang not found in current Python environment."
    echo ""
    echo "Fix: Run these commands in order, then re-run this script:"
    echo ""
    echo "  # 1. Go to your libadalang build directory and load env:"
    echo "  cd ~/Desktop/Libadalang/unit_test/libadalang_26.0.0_*/"
    echo "  eval \"\$(alr printenv)\""
    echo ""
    echo "  # 2. Activate your Python venv:"
    echo "  cd $SCRIPT_DIR"
    echo "  source venv/bin/activate"
    echo ""
    echo "  # If venv doesn't exist yet:"
    echo "  python3.10 -m venv venv"
    echo "  source venv/bin/activate"
    echo "  pip install -r requirements.txt"
    echo ""
    exit 1
fi

echo "[INFO] libadalang found ✓"
echo ""

# Check fastapi is installed, install if missing
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo "[INFO] Installing FastAPI dependencies..."
    pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
    echo ""
fi

# Check uvicorn is installed
if ! python3 -c "import uvicorn" 2>/dev/null; then
    echo "[INFO] Installing uvicorn..."
    pip install "uvicorn[standard]==0.29.0"
    echo ""
fi

echo "[INFO] Starting server on http://localhost:8001 ..."
echo "[INFO] Press Ctrl+C to stop."
echo ""

# Use --reload=false for stability; add --log-level info for debugging
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001 --log-level info
