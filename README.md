# Ada Analysis & Test Generation Tool

**Author: Rakshitha**
**GitHub:** https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool
**License:** MIT © 2025 Rakshitha

A full-stack web IDE for **Ada source code static analysis and automatic test case generation** — powered by AdaCore's libadalang semantic AST library.

| Layer | Stack |
|---|---|
| Frontend | React 18 · TypeScript · Monaco Editor · Vite 5 · Zustand · Tailwind CSS |
| Backend | Python · FastAPI · **libadalang** (AdaCore semantic AST) |

> **Works without the backend.** Upload any `.adb`/`.ads` file — the frontend automatically falls back to its built-in TypeScript analyzer if the backend isn't running.

---

## Quick Start

### Step 1 — Install libadalang (choose your OS)

> **libadalang cannot be installed with `pip install`.** Use one of these methods:

#### Windows — GNAT Studio (easiest)
1. Download **GNAT Studio** (free): https://github.com/AdaCore/gnatstudio/releases
2. Install it — this bundles Python + libadalang automatically
3. Done — `start_server.bat` uses it automatically

#### Linux/Mac — Alire build method
```bash
# Prerequisites: Python 3.10, pip, Alire
# Install Alire from: https://alire.ada.dev/

# 1. Build libadalang (one-time)
alr get libadalang
cd libadalang_26.0.0_*/
LIBRARY_TYPE=relocatable alr build

# 2. Create Python venv with FastAPI (one-time)
cd /path/to/project/backend/
python3.10 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Every new terminal — load libadalang environment FIRST
cd libadalang_26.0.0_*/
eval "$(alr printenv)"          # ← MUST do this every new terminal

# 4. Start the server
cd /path/to/project/backend/
source venv/bin/activate
bash start_server_linux.sh      # or: python3 -m uvicorn server:app --port 8001
```

---

### Step 2 — Start the backend

**Windows (one-click):**
```bat
cd D:\ada\backend
start_server.bat
```

**Windows (manual PowerShell):**
```powershell
cd D:\ada\backend
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001
```

**Linux/Mac (after Alire setup above):**
```bash
cd backend/
bash start_server_linux.sh
```

Backend runs at → **http://localhost:8001**

---

### Step 3 — Start the frontend

Open a **second terminal** at the project root:
```bash
cd /path/to/project   # or D:\ada on Windows
npm install
npm run dev
```

Frontend runs at → **http://localhost:5173**

---

### Step 4 — Verify the connection

```bash
# Check backend health
curl http://localhost:8001/health
# Expected: {"status":"ok","libadalang_available":true,"version":"2.0.0"}
```

Then open **http://localhost:5173** in your browser.
The status bar at the bottom shows `libadalang` when connected.

---

## How It Works

1. **Upload** `.adb`/`.ads` Ada source files via drag & drop
2. **Click a file** → it's parsed by libadalang on the backend
3. Each file gets its own **JSON result** with full analysis
4. The **subprogram list** shows only the clicked file's subprograms
5. **Test Cases tab** → select a subprogram → auto-fill inputs → run test

### Frontend ↔ Backend Connection

| Frontend call | Vite proxy | Backend endpoint | Purpose |
|---|---|---|---|
| `GET /health` | `→ :8001/health` | `/health` | Check if libadalang available |
| `POST /analyze` | `→ :8001/analyze` | `/analyze` | Upload files, get full analysis JSON |
| `POST /api/autofill` | `→ :8001/api/autofill` | `/api/autofill` | Generate smart test inputs |
| `POST /api/test/run` | `→ :8001/api/test/run` | `/api/test/run` | Run test with type validation |
| `GET /api/subprograms` | `→ :8001/api/subprograms` | `/api/subprograms` | Get enriched subprogram list |
| `GET /api/export` | `→ :8001/api/export` | `/api/export` | Export full report |

---

## Features

### Static Analysis (libadalang-powered)
| Feature | Details |
|---|---|
| **Subprogram Indexing** | Functions and procedures with parameters, return types, line numbers |
| **Call Graph** | Cross-file call relationships, visualized with Graphviz |
| **Cyclomatic Complexity** | Per-subprogram complexity score with color-coded bars |
| **Dead Code Detection** | Unreferenced subprograms including transitive dead code |
| **Variables Analysis** | Full type resolution — locals, globals, parameters, constants |
| **Type Expansion** | Records expand to `{TypeName: {field: type}}` nested dicts |
| **Control Flow** | if/elsif/case conditions with resolved variable types |
| **Bug Detection** | Division by zero, null dereference, infinite loops, unreachable code, uninitialized variables |
| **Loop Analysis** | Loop count per subprogram with type (for/while/loop) and nesting depth |
| **Exception Analysis** | Exception handler count per subprogram |
| **Concurrency** | Task bodies and protected objects |
| **Performance Warnings** | Heavy function calls inside loops |
| **Logical Errors** | Constant conditions (always true/false), division by zero |
| **Test Harness Generation** | Ada test procedure templates per subprogram |
| **Mock Stubs** | Mock/stub templates for callees |

### Test Studio
| Feature | Details |
|---|---|
| **Auto-fill** | Smart value generation using type constraints (min/max/kind) + name heuristics. Works with or without backend session by sending `param_types` |
| **Type Validation** | Client-side + server-side Ada type checking before running tests |
| **Test History** | Per-subprogram run history with pass/fail/error status |
| **Multiple Strategies** | Normal → Edge → Boundary → Random (cycles on each auto-fill click) |
| **Export** | Download test inputs as JSON |

### IDE Features
| Feature | Details |
|---|---|
| **Monaco Editor** | Ada syntax highlighting, code navigation |
| **Per-file JSON** | Each file gets its own analysis JSON — no mixing |
| **Per-file Subprograms** | Clicking a file shows only that file's subprograms |
| **Code Navigation** | Click subprogram → jumps to line in editor |
| **Status Bar** | Shows cursor position, file type, subprogram count, libadalang status |
| **Call Graph Viewer** | Interactive pan/zoom Graphviz visualization |
| **Diagnostics Panel** | Errors/warnings/info with click-to-navigate |
| **Command Palette** | Ctrl+K for quick actions |
| **Session Persistence** | Files restored from localStorage on reload |

---

## Project Structure

```
ada/
├── backend/                      ← FastAPI Python backend
│   ├── server.py                 ← Main API server (port 8001)
│   ├── start_server.bat          ← Windows one-click start (GNAT Python)
│   ├── start_server_linux.sh     ← Linux/Mac start (Alire venv)
│   ├── requirements.txt          ← fastapi, uvicorn, multipart
│   ├── analyzer/                 ← All libadalang analyzer modules
│   │   ├── bug_detector.py       ← Division by zero, null deref, uninitialized vars
│   │   ├── callgraph.py          ← Call graph builder
│   │   ├── complexity.py         ← Cyclomatic complexity
│   │   ├── concurrency.py        ← Tasks and protected objects
│   │   ├── control_flow_extractor.py  ← If/case conditions + variable types
│   │   ├── deadcode.py           ← Dead code with transitive analysis
│   │   ├── exception_analysis.py ← Exception handler count
│   │   ├── globals_analysis.py   ← Global read/write per subprogram
│   │   ├── indexer.py            ← Subprogram index with is_function flag
│   │   ├── logical_error.py      ← Constant conditions, float div-by-zero
│   │   ├── loop_analysis.py      ← Loop count + details (type/line/depth)
│   │   ├── performance.py        ← Heavy calls inside loops
│   │   ├── protected_analysis.py ← Protected object detection
│   │   ├── variables_analysis.py ← Full TypeRegistry + VariablesExtractor
│   │   └── ...
│   ├── generators/
│   │   ├── harness_generator.py  ← Test harness templates
│   │   └── mock_generator.py     ← Mock stub templates
│   ├── utils/
│   │   └── json_serializer.py    ← Make results JSON-serializable
│   └── testada_caseinsensitive/  ← Test Ada files (bitmapped_drawing, math_utils)
│
├── frontend/src/                 ← React TypeScript frontend
│   ├── components/
│   │   ├── analysis/AnalysisOutput.tsx      ← Complexity, bugs, dead code cards
│   │   ├── diagnostics/DiagnosticsPanel.tsx ← Errors/warnings with line navigation
│   │   ├── editor/EditorLayout.tsx          ← View tabs (Code/Tests/Analysis/Graph)
│   │   ├── editor/EditorTabs.tsx            ← File tabs, per-file subprogram switch
│   │   ├── file-manager/FileManager.tsx     ← File tree with parse-on-click
│   │   ├── file-manager/ParsedJsonPanel.tsx ← Monaco JSON viewer per file
│   │   ├── graph/GraphViewer.tsx            ← Graphviz call graph
│   │   ├── test-cases/TestCasePanel.tsx     ← Test Studio with autofill
│   │   └── ...
│   ├── hooks/
│   │   └── useFileParser.ts      ← Per-file parse + split analysis results
│   ├── utils/
│   │   ├── apiClient.ts          ← Backend API calls
│   │   └── adaAnalyzer.ts        ← Client-side fallback analyzer
│   └── store/                    ← Zustand stores (file, editor, parse, subprogram)
│
├── src/                          ← Mirror of frontend/src (keep in sync)
├── test/                         ← Development test files + backend mirror
└── vite.config.ts                ← Proxy: /api → :8001, /analyze → :8001
```

---

## API Reference

### `POST /analyze`
Upload Ada files and get full analysis JSON.
```bash
curl -X POST http://localhost:8001/analyze \
  -F "files=@myfile.adb" \
  -F "files=@myfile.ads"
```
Returns: Full `AdaAnalysisResult` JSON with per-file keys normalized to basename.

### `GET /health`
```bash
curl http://localhost:8001/health
# {"status":"ok","libadalang_available":true,"version":"2.0.0"}
```

### `POST /api/autofill`
Generate smart test values. Works even without backend session when `param_types` is sent.
```json
{
  "subprogram": "Add",
  "strategy": "normal",
  "param_types": {"A": "Integer", "B": "Integer"}
}
```

### `POST /api/test/run`
Run a test with type validation.
```json
{
  "subprogram": "Add",
  "inputs": {"A": "5", "B": "3"},
  "expected": {"Result": "8"},
  "param_types": {"A": "Integer", "B": "Integer"}
}
```

### `GET /api/subprograms`
Get all subprograms enriched with variables, params, type constraints.

### `GET /api/export`
Export full analysis + test results as JSON.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command palette |
| `Ctrl+M` | Toggle minimap |
| `Ctrl+\` | Toggle right panel |
| `Ctrl++` / `Ctrl+-` | Increase/decrease font size |
| `Alt+1..4` | Switch editor view (Code/Tests/Analysis/Graph) |

---

## Tech Stack

### Backend
- **Python** (3.10+ via venv, or GNAT Python on Windows)
- **FastAPI** 0.111 + **Uvicorn** 0.29 — async API server
- **libadalang** — AdaCore's semantic Ada AST parser (bundled with GNAT Studio or built via Alire)
- **TypeRegistry** — recursive record/array/enum type expansion

### Frontend
- **React 18** + **TypeScript**
- **Monaco Editor** — VS Code's editor with Ada syntax
- **Vite 5** — dev server with proxy to backend
- **Zustand** — state management (file, editor, parse, subprogram stores)
- **Tailwind CSS** — utility styling
- **@hpcc-js/wasm** — Graphviz WebAssembly for call graph rendering
- **Lucide React** — icons

---

## Development Notes

### Running after `git clone`
```bash
# 1. Clone
git clone https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool.git
cd Ada-Analysis-and-Test-Generation-Tool

# 2. Install frontend deps
npm install

# 3. Start frontend
npm run dev

# 4. Start backend (Windows)
cd backend
start_server.bat

# 4. Start backend (Linux/Mac — see Alire setup above first)
cd backend
bash start_server_linux.sh
```

### The `src/` and `frontend/src/` directories
Both contain the same React source. `frontend/src/` is the one Vite builds from. `src/` is a mirror kept in sync. If you edit one, copy to the other.

### Backend runs on port 8001, frontend on port 5173
Vite proxies these routes to the backend:
- `/health` → `http://localhost:8001/health`
- `/analyze` → `http://localhost:8001/analyze`
- `/api/*` → `http://localhost:8001/api/*`
