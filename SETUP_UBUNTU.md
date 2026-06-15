# Ubuntu Setup Guide — Ada Analysis & Test Generation Tool

**Author:** Rakshitha  
**GitHub:** https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool

Complete guide for running this project on Ubuntu/Linux after `git clone`, using Alire to build libadalang.

---

## Prerequisites

```bash
# Update package list
sudo apt update

# Python 3.10 + venv
sudo apt install python3.10 python3.10-venv python3.10-dev python3-pip -y

# Node.js 18+ (for frontend)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs -y

# Verify versions
python3.10 --version   # Python 3.10.x
node --version         # v18.x.x
npm --version          # 9.x.x or higher

# Alire (Ada package manager)
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

## Step 2 — Build libadalang (one-time, ~5 minutes)

```bash
# Navigate somewhere outside the project (e.g. your home dir)
cd ~

# Download and build libadalang
alr get libadalang
cd libadalang_*/

# Build as relocatable (REQUIRED — static won't work with Python bindings)
LIBRARY_TYPE=relocatable alr build

# Note this full path — you need it every session
echo "libadalang path: $(pwd)"
```

> **Tip:** Add this path to a variable in your `.bashrc` to avoid typing it every time:
> ```bash
> echo 'export LIDAL_PATH="$HOME/libadalang_26.0.0_abc123"' >> ~/.bashrc
> source ~/.bashrc
> ```

---

## Step 3 — Set up Python venv (one-time)

```bash
cd ~/Ada-Analysis-and-Test-Generation-Tool/backend

# Create virtual environment with Python 3.10
python3.10 -m venv venv

# Activate it
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Verify FastAPI is installed
python3 -c "import fastapi; print('FastAPI OK')"
```

---

## Step 4 — Install frontend dependencies (one-time)

```bash
cd ~/Ada-Analysis-and-Test-Generation-Tool

npm install
```

---

## Step 5 — Start the backend (every session)

> Every new terminal session needs `eval "$(alr printenv)"` before the server starts. Without it, libadalang won't be found.

```bash
# 1. Load libadalang environment FIRST (replace path with yours)
cd ~/libadalang_*/
eval "$(alr printenv)"

# 2. Go to the backend
cd ~/Ada-Analysis-and-Test-Generation-Tool/backend

# 3. Activate venv
source venv/bin/activate

# 4. Quick test that libadalang is available
python3 -c 'import libadalang as lal; print("libadalang OK")'

# 5. Start the server
bash start_server_linux.sh
```

Backend runs at: **http://localhost:8001**

You should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8001
```

---

## Step 6 — Start the frontend (every session)

Open a **second terminal**:

```bash
cd ~/Ada-Analysis-and-Test-Generation-Tool
npm run dev
```

Frontend runs at: **http://localhost:5173**

---

## Step 7 — Verify

```bash
# Check backend health
curl http://localhost:8001/health
# Expected: {"status":"ok","libadalang_available":true,"version":"2.0.0"}
```

Open **http://localhost:5173** in your browser.  
The amber status bar at the bottom shows `libadalang ✓` when connected.

---

## Quick Reference — Every Session

```bash
# ── Terminal 1: Backend ──────────────────────────
cd ~/libadalang_*/
eval "$(alr printenv)"
cd ~/Ada-Analysis-and-Test-Generation-Tool/backend
source venv/bin/activate
bash start_server_linux.sh

# ── Terminal 2: Frontend ─────────────────────────
cd ~/Ada-Analysis-and-Test-Generation-Tool
npm run dev
```

Then open: **http://localhost:5173**

---

## Using the Tool

1. **Create a project** — enter a name in the project field and click `+`
2. **Upload files** — drag and drop `.adb` / `.ads` Ada source files
3. **Click Open Editor**
4. **Analyse a file** — click the ⬛ blue button to the left of any `.adb` file in the file panel
5. **View analysis** — the Analysis tab opens with subprogram summary, cyclomatic complexity, dead code, variables, etc.
6. **Generate tests** — go to Test Cases tab, select a subprogram, click ✨ auto-fill, then ▶ run test
7. **History** — test runs are saved for 6 days and survive page refresh

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'libadalang'"

You forgot `eval "$(alr printenv)"` — run it from the libadalang build directory, then restart the server.

```bash
cd ~/libadalang_*/
eval "$(alr printenv)"
```

### "ModuleNotFoundError: No module named 'fastapi'"

Your venv is not activated:
```bash
source ~/Ada-Analysis-and-Test-Generation-Tool/backend/venv/bin/activate
```

### Frontend shows "demo data" badge (not "libadalang ✓")

The backend is not running or not reachable on port 8001.
- Check the backend terminal for errors
- Confirm: `curl http://localhost:8001/health` returns `{"status":"ok",...}`

### "Address already in use" — port 8001

```bash
sudo fuser -k 8001/tcp
# Then restart the backend
```

### "uvicorn: command not found"

```bash
source venv/bin/activate
pip install "uvicorn[standard]==0.29.0"
```

### Clicking .ads file shows "only .adb can be analysed"

This is expected — `.ads` specification files cannot be parsed directly.  
Click the ⬛ button on the matching `.adb` body file instead.

### Autofill shows placeholder values for complex types (Buffer, Point, etc.)

This is also expected for complex Ada types. The frontend fills in placeholder defaults like `Buffer`, `(X => 0, Y => 0)`, `Default_Font` for types that can't be represented as simple integers. Edit the values manually if needed, or leave complex `out` parameter fields blank to skip assertion.

### GNAT/Alire version issues

If `alr get libadalang` downloads a different version, adjust the directory name:
```bash
ls ~/libadalang_*   # find the actual directory name
```

---

## Environment Variable Shortcut (optional)

To avoid repeating the `eval` command, add this to your `~/.bashrc`:

```bash
# Ada/libadalang environment loader
function load_ada() {
  cd ~/libadalang_*/
  eval "$(alr printenv)"
  cd -
  echo "libadalang environment loaded"
}
```

Then each session just run:
```bash
load_ada
cd ~/Ada-Analysis-and-Test-Generation-Tool/backend
source venv/bin/activate
bash start_server_linux.sh
```
