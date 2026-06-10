#!/bin/bash
# ============================================================
#  Ada Analysis Tool — Backend Server (Linux/Mac)
#  Author: Rakshitha
#
#  Uses libadalang built via Alire (NOT GNAT Studio).
#
#  Prerequisites:
#    1. Python 3.10 + pip installed
#    2. Alire installed: https://alire.ada.dev/
#    3. libadalang built:
#         alr get libadalang
#         cd libadalang_*/
#         LIBRARY_TYPE=relocatable alr build
#
#  First-time setup (run once):
#    cd backend/
#    python3.10 -m venv venv
#    source venv/bin/activate
#    pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
#
#  Usage (every time you start):
#    cd ~/Desktop/Libadalang/unit_test/libadalang_26.0.0_*/
#    LIBRARY_TYPE=relocatable alr build          # only needed after clean
#    eval "$(alr printenv)"                      # MUST do this every terminal
#    cd /path/to/this/project/backend/
#    source venv/bin/activate
#    bash start_server_linux.sh
# ============================================================

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "============================================================"
echo "  Ada Analysis Tool API  v2.0.0"
echo "  Python  : $(python3 --version 2>&1)"
echo "  Port    : 8001"
echo "  Frontend: http://localhost:5173"
echo "============================================================"
echo ""

# Check libadalang is importable
python3 -c "import libadalang" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "ERROR: libadalang not found in current Python."
    echo ""
    echo "You must run these commands BEFORE this script:"
    echo ""
    echo "  1. Go to your libadalang build directory:"
    echo "     cd ~/Desktop/Libadalang/unit_test/libadalang_26.0.0_*/"
    echo ""
    echo "  2. Load the Alire environment (REQUIRED every new terminal):"
    echo "     eval \"\$(alr printenv)\""
    echo ""
    echo "  3. Activate your Python venv:"
    echo "     source /path/to/backend/venv/bin/activate"
    echo ""
    echo "  4. Then re-run this script."
    echo ""
    exit 1
fi

echo "[INFO] libadalang found ✓"
echo ""

# Check fastapi is installed
python3 -c "import fastapi" 2>/dev/null || {
    echo "[INFO] Installing FastAPI dependencies..."
    pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
    echo ""
}

echo "[INFO] Starting server on http://localhost:8001 ..."
echo "[INFO] Press Ctrl+C to stop."
echo ""

python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
