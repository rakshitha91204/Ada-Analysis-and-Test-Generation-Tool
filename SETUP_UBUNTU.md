# Ubuntu Setup Guide — Ada Analysis & Test Generation Tool

**Author: Rakshitha**

This guide covers running the project on Ubuntu after `git clone`, using Alire to build libadalang.

---

## Prerequisites

Install these before starting:

```bash
# Python 3.10 + pip
sudo apt update
sudo apt install python3.10 python3.10-venv python3.10-dev pip -y

# Node.js 18+ (for frontend)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Alire (Ada package manager)
# Download from: https://alire.ada.dev/
# Or:
wget https://github.com/alire-project/alire/releases/latest/download/alr-linux.zip
unzip alr-linux.zip
sudo mv alr /usr/local/bin/
alr --version
```

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool.git
cd Ada-Analysis-and-Test-Generation-Tool
```

---

## Step 2 — Build libadalang (one-time, takes ~5 min)

```bash
# Get and build libadalang
alr get libadalang
cd libadalang_26.0.0_*/      # or whatever version alr downloaded

# Build as relocatable library (REQUIRED)
LIBRARY_TYPE=relocatable alr build

# Note the directory path — you'll need it every session
pwd
# e.g. /home/username/libadalang_26.0.0_abc123def
```

---

## Step 3 — Set up Python venv (one-time)

```bash
cd /path/to/Ada-Analysis-and-Test-Generation-Tool/backend

# Create venv with Python 3.10
python3.10 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify (should print 'Success!')
# First load libadalang environment (see Step 4), THEN test
```

---

## Step 4 — Start the backend (every session)

**Every new terminal**, run these in order:

```bash
# 1. Load libadalang environment (MUST do this every new terminal)
cd /path/to/libadalang_26.0.0_*/
eval "$(alr printenv)"

# 2. Go back to project backend
cd /path/to/Ada-Analysis-and-Test-Generation-Tool/backend

# 3. Activate venv
source venv/bin/activate

# 4. Test libadalang works
python3 -c 'import libadalang as lal; ctx = lal.AnalysisContext(); print("libadalang OK")'

# 5. Start the server
bash start_server_linux.sh
# OR directly:
python3 -m uvicorn server:app --host 0.0.0.0 --port 8001
```

Backend runs at: **http://localhost:8001**

---

## Step 5 — Start the frontend

Open a **second terminal**:

```bash
cd /path/to/Ada-Analysis-and-Test-Generation-Tool

# Install Node dependencies (first time only)
npm install

# Start dev server
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Step 6 — Verify everything works

```bash
# Check backend health
curl http://localhost:8001/health
# Expected: {"status":"ok","libadalang_available":true,"version":"2.0.0"}
```

Open **http://localhost:5173** in your browser.
The amber status bar at the bottom shows `libadalang` when connected.

---

## Troubleshooting

### "libadalang not found" error

You forgot to run `eval "$(alr printenv)"` in the current terminal.
Run it from the libadalang build directory, then restart the server.

### "No module named fastapi"

Your venv isn't activated. Run `source venv/bin/activate` first.

### Frontend shows "demo data" badge (not "libadalang ✓")

The backend isn't running or the proxy can't reach port 8001.
- Check the backend terminal for errors
- Make sure `curl http://localhost:8001/health` works

### "uvicorn not found"

```bash
source venv/bin/activate
pip install "uvicorn[standard]==0.29.0"
```

### Autofill not working

Autofill works **without** the backend session when you upload and parse a file first.
The frontend sends `param_types` with every autofill request, so the backend generates
correct type-constrained values even if the session is empty.

### Port 8001 already in use

```bash
# Kill whatever is using port 8001
sudo fuser -k 8001/tcp
# Then restart the server
```

---

## Quick Reference — Every Session

```bash
# Terminal 1: Backend
cd ~/libadalang_26.0.0_*/
eval "$(alr printenv)"
cd ~/Ada-Analysis-and-Test-Generation-Tool/backend
source venv/bin/activate
bash start_server_linux.sh

# Terminal 2: Frontend
cd ~/Ada-Analysis-and-Test-Generation-Tool
npm run dev
```

Then open: http://localhost:5173
