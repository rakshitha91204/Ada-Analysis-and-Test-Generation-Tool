# Ada Analysis & Test Generation Tool

**Author:** Rakshitha  
**GitHub:** https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool  
**License:** MIT © 2025 Rakshitha

A full-stack web IDE for **Ada source code static analysis and automatic test case generation**, powered by AdaCore's **libadalang** semantic AST library.

| Layer | Stack |
|-------|-------|
| Frontend | React 18 · TypeScript · Monaco Editor · Vite 5 · Zustand · Tailwind CSS |
| Backend | Python 3.10 · FastAPI · **libadalang** (AdaCore) |

> **Works without the backend.** Upload any `.adb`/`.ads` file — the frontend automatically falls back to its built-in TypeScript analyzer if the backend is not running.

---

## Features at a Glance

### Project Management
- Create named projects on the Upload page
- Recent projects list — open, rename, delete
- Files, folders, analysis results and test history are auto-saved per project
- Re-opening a project restores everything exactly as you left it

### Static Analysis (libadalang-powered)
| Feature | Details |
|---------|---------|
| **Subprogram Summary** | All functions and procedures with ƒ / ⚡ icons, return types, parameter counts, line numbers |
| **Cyclomatic Complexity** | Per-subprogram score with color-coded bar; hover any row to see the full subprogram name |
| **Dead Code Detection** | Unreferenced subprograms including transitive dead code |
| **Variables Analysis** | Locals, globals, parameters, constants with full type resolution |
| **Call Graph** | Interactive pan/zoom Graphviz visualization of cross-file call relationships |
| **Control Flow** | if/elsif/case branch conditions with resolved variable types |
| **Loop Analysis** | Loop count per subprogram with type (for/while/loop) and nesting depth |
| **Exception Analysis** | Exception handler count per subprogram |
| **Concurrency** | Task bodies and protected objects |
| **Logical Errors** | Constant conditions (always true/false), division by zero |
| **Performance Warnings** | Heavy function calls inside loops |
| **Global Read/Write** | Which subprograms read or write each global variable |

### Test Studio
| Feature | Details |
|---------|---------|
| **Smart Auto-fill** | Generates inputs for every parameter — integers, floats, booleans, characters, strings, and complex Ada types (Point, Bitmap_Color, BMP_Font, Buffer) using type + name heuristics |
| **4 Strategies** | Normal → Edge → Boundary → Random (cycles on each ✨ click) |
| **Type Validation** | Client-side + server-side Ada type checking before running |
| **Run Test** | Executes the subprogram via the backend with your inputs and expected values |
| **Persistent History** | Per-subprogram run history stored in localStorage for **6 days**, survives page refresh |
| **Export** | Download test inputs as JSON |

### IDE Features
| Feature | Details |
|---------|---------|
| **Monaco Editor** | Ada syntax highlighting, code navigation, minimap |
| **Analyse Button** | Click ⬛ left of any `.adb` file to parse → generates JSON report + opens Analysis panel |
| **Spec files (.ads)** | Clicking an .ads file shows an info popup — only .adb body files can be analysed |
| **Per-file JSON** | Each file gets its own Analysis Report — no mixing between files |
| **Per-file Subprograms** | Clicking a file shows only that file's subprograms |
| **Code Navigation** | Click subprogram name in analysis → jumps to that line in editor |
| **Report Tab** | Right panel "⬛ Report" tab shows the full analysis JSON for the active file |
| **Diagnostics Panel** | Errors/warnings/info with click-to-navigate |
| **Command Palette** | `Ctrl+K` for quick actions |
| **6-day Test History** | Run history auto-expires after 6 days, right-panel shows all recent runs |

---

## Quick Start

### Step 1 — Clone & install frontend

```bash
git clone https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool.git
cd Ada-Analysis-and-Test-Generation-Tool
npm install
npm run dev
```

Frontend runs at → **http://localhost:5173**

The app works immediately in demo mode. Upload `.adb` files to see the frontend analyzer.

---

### Step 2 — Start the backend (for libadalang analysis)

#### Windows — GNAT Studio (easiest)

1. Download **GNAT Studio** (free): https://github.com/AdaCore/gnatstudio/releases  
2. Install it — bundles Python + libadalang automatically

```bat
cd backend
start_server.bat
```

Or manually:
```powershell
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001
```

#### Ubuntu/Linux — Alire method

See **[SETUP_UBUNTU.md](./SETUP_UBUNTU.md)** for the full step-by-step guide.

Quick summary:
```bash
# 1. Build libadalang once
alr get libadalang
cd libadalang_*/
LIBRARY_TYPE=relocatable alr build

# 2. Set up Python venv once
cd /path/to/project/backend
python3.10 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# 3. Every new session — load env first, then start
cd /path/to/libadalang_*/
eval "$(alr printenv)"
cd /path/to/project/backend
source venv/bin/activate
bash start_server_linux.sh
```

Backend runs at → **http://localhost:8001**

---

### Step 3 — Verify

```bash
curl http://localhost:8001/health
# {"status":"ok","libadalang_available":true,"version":"2.0.0"}
```

Open **http://localhost:5173** — the amber status bar shows `libadalang ✓` when connected.

---

## How to Use

### 1. Create a Project
- Open the app → enter a project name → click `+`
- Drag & drop `.adb` / `.ads` files onto the dropzone (or a whole folder)
- Click **Open Editor**

### 2. Analyse a File
- In the left file panel, click the **⬛ blue button** to the left of any `.adb` file
- The backend parses it with libadalang — a JSON report is generated
- The Analysis panel opens automatically showing:
  - **Subprogram Summary** — all functions (ƒ) and procedures (⚡) with line numbers
  - **Cyclomatic Complexity** — hover a name to see the full name in a tooltip
  - **Dead Code**, **Variables**, **Control Flow**, **Loops**, **Globals**, etc.

### 3. Generate & Run Tests
- Switch to the **Test Cases** tab
- Select a subprogram from the dropdown
- Inputs are auto-filled based on parameter types from the `.adb` + `.ads`
- Click **✨ auto-fill** to cycle through Normal/Edge/Boundary/Random strategies
- Click **▶ run test** — results are saved in history (persists 6 days)

### 4. View the Report
- Click **⬛ Report** in the right panel to see the full analysis JSON for the active file
- Switch between files — each file has its own separate report

---

## Workflow Summary

```
Upload page
  └─ Create project → drag .adb/.ads files → Open Editor
       │
       ├─ Click file row → opens in Monaco editor (no parsing)
       │
       ├─ Click ⬛ on .adb → parses with libadalang
       │     ├─ Analysis tab opens (Subprogram Summary, Complexity, Dead Code, ...)
       │     └─ ⬛ Report tab shows full JSON
       │
       └─ Test Cases tab
             ├─ Select subprogram → inputs auto-filled from .adb + .ads params
             ├─ ✨ auto-fill → cycles Normal/Edge/Boundary/Random
             ├─ ▶ run test → result saved to 6-day history
             └─ history tab → all past runs for this subprogram
```

---

## Project Structure

```
ada/
├── README.md                         ← This file
├── SETUP_UBUNTU.md                   ← Ubuntu/Linux setup guide
├── package.json                      ← Root (npm run dev starts frontend)
├── vite.config.ts                    ← Proxy: /api → :8001, /analyze → :8001
│
├── backend/                          ← Python FastAPI backend
│   ├── server.py                     ← Main API (port 8001)
│   ├── start_server.bat              ← Windows one-click start
│   ├── start_server_linux.sh         ← Linux/Mac start (Alire venv)
│   ├── requirements.txt              ← fastapi, uvicorn, python-multipart
│   ├── analyzer/
│   │   ├── indexer.py                ← Subprogram index (is_function, params, lines)
│   │   ├── callgraph.py              ← Cross-file call graph
│   │   ├── complexity.py             ← Cyclomatic complexity per subprogram
│   │   ├── deadcode.py               ← Dead code with transitive analysis
│   │   ├── variables_analysis.py     ← Full TypeRegistry + VariablesExtractor
│   │   ├── globals_analysis.py       ← Global read/write per subprogram
│   │   ├── control_flow_extractor.py ← if/case branches + variable types
│   │   ├── loop_analysis.py          ← Loop details (type/line/depth)
│   │   ├── exception_analysis.py     ← Exception handler count
│   │   ├── concurrency.py            ← Tasks and protected objects
│   │   ├── bug_detector.py           ← Division by zero, null deref, uninitialized
│   │   ├── logical_error.py          ← Constant conditions, float div-by-zero
│   │   ├── performance.py            ← Heavy calls inside loops
│   │   └── protected_analysis.py     ← Protected object detection
│   ├── generators/
│   │   ├── harness_generator.py      ← Ada test procedure templates
│   │   └── mock_generator.py         ← Mock/stub templates
│   └── utils/
│       └── json_serializer.py        ← Make results JSON-serializable
│
├── frontend/src/                     ← React TypeScript source (Vite builds this)
│   ├── pages/
│   │   ├── UploadPage.tsx            ← Project management + file upload
│   │   └── EditorPage.tsx            ← Main IDE layout
│   ├── components/
│   │   ├── analysis/AnalysisOutput.tsx      ← Analysis cards (complexity, dead code, ...)
│   │   ├── editor/EditorLayout.tsx          ← Code/Tests/Analysis/Graph tabs
│   │   ├── file-manager/FileManager.tsx     ← File tree + ⬛ Analyse button
│   │   ├── file-manager/ParsedJsonPanel.tsx ← Monaco JSON report viewer
│   │   ├── graph/GraphViewer.tsx            ← Graphviz call graph viewer
│   │   ├── test-cases/TestCasePanel.tsx     ← Test Studio (inputs, run, history)
│   │   └── panels/RightPanel.tsx            ← Files / Report / Outline / Packages tabs
│   ├── hooks/
│   │   └── useFileParser.ts          ← Per-file parse + split analysis results
│   ├── store/
│   │   ├── useFileStore.ts           ← Uploaded files state
│   │   ├── useEditorStore.ts         ← Open tabs, active view
│   │   ├── useParseStore.ts          ← Per-file analysis results
│   │   ├── useSubprogramStore.ts     ← Current file's subprogram list
│   │   ├── useProjectStore.ts        ← Named projects (localStorage)
│   │   └── useTestCaseStore.ts       ← Test history (6-day TTL, localStorage)
│   └── utils/
│       ├── apiClient.ts              ← Backend API calls with fallback
│       └── adaAnalyzer.ts            ← Client-side fallback analyzer
│
└── src/                              ← Mirror of frontend/src (keep in sync)
```

---

## API Reference

### `GET /health`
```bash
curl http://localhost:8001/health
# {"status":"ok","libadalang_available":true,"version":"2.0.0"}
```

### `POST /analyze`
Upload `.adb`/`.ads` files, get full analysis JSON.
```bash
curl -X POST http://localhost:8001/analyze \
  -F "files=@myfile.adb" \
  -F "files=@myfile.ads"
```
Returns: `AdaAnalysisResult` with per-file keys normalized to basename.

### `POST /api/autofill`
Generate smart test values (works without session when `param_types` is provided).
```json
{
  "subprogram": "Check_Pixel",
  "strategy": "normal",
  "param_types": {"Orida_In": "UINT16", "Aran_In": "uint16"}
}
```
Strategies: `normal` · `edge` · `boundary` · `random`

### `POST /api/test/run`
Run a test with type validation.
```json
{
  "subprogram": "Check_Pixel",
  "inputs":   {"Orida_In": "100", "Aran_In": "50"},
  "expected": {"Karan_Out": "150"},
  "param_types": {"Orida_In": "UINT16", "Aran_In": "uint16", "Karan_Out": "UInt16"}
}
```

### `GET /api/subprograms`
Get all subprograms enriched with variables, params, and type constraints.

### `GET /api/export`
Export full analysis + test results as JSON.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+K` | Command palette |
| `Ctrl+M` | Toggle minimap |
| `Ctrl+\` | Toggle right panel |
| `Ctrl++` / `Ctrl+-` | Increase / decrease font size |
| `Alt+1` | Code view |
| `Alt+2` | Test Cases view |
| `Alt+3` | Analysis view |
| `Alt+4` | Call Graph view |

---

## Tech Stack

### Backend
- **Python 3.10+** (GNAT Python on Windows, venv on Linux)
- **FastAPI 0.111** + **Uvicorn 0.29** — async REST API
- **libadalang** — AdaCore's semantic Ada AST parser
- **TypeRegistry** — recursive record/array/enum type expansion

### Frontend
- **React 18** + **TypeScript**
- **Monaco Editor** — VS Code editor engine with Ada syntax
- **Vite 5** — dev server with `/api` and `/analyze` proxy to backend
- **Zustand** — lightweight state management
- **Tailwind CSS** — utility-first styling
- **@hpcc-js/wasm** — Graphviz WebAssembly for call graph rendering
- **Lucide React** — icons
- **date-fns** — date formatting

---

## Notes for Developers

### The `src/` mirror
`frontend/src/` is what Vite builds. `src/` is a manual mirror kept in sync. After editing `frontend/src/`, copy the changed files to `src/` as well.

### Ports
- Frontend: **5173** (Vite dev server)
- Backend: **8001** (FastAPI/Uvicorn)

Vite proxies these routes automatically in development:
- `/health` → `http://localhost:8001/health`
- `/analyze` → `http://localhost:8001/analyze`
- `/api/*` → `http://localhost:8001/api/*`

### History persistence
- **Test run history** — stored in `localStorage` per subprogram, key `ada_run_history__<name>`, expires after 6 days
- **Generated test sets** — stored in `useTestCaseStore`, key `ada_test_history`, expires after 6 days
- **Projects** — stored in `localStorage` key `ada_projects_v1`, no expiry

### Case-insensitive Ada type handling
The backend handles Ada type names in all casings (`UINT16`, `uint16`, `UInt16`) correctly. The frontend `typeConstraint()` function normalizes to lowercase before matching.
