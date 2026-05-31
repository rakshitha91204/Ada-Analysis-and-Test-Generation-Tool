# Ada Analysis & Test Generation Tool

**Author: Rakshitha**  
**GitHub:** https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool  
**License:** MIT © 2025 Rakshitha

A full-stack web IDE for **Ada source code static analysis and automatic test case generation**.

| Layer | Stack |
|---|---|
| Frontend | React 18 · TypeScript · Monaco Editor · Vite 5 · Zustand · Tailwind CSS |
| Backend | Python 3.13 · FastAPI · libadalang (AdaCore semantic AST) |

> **Works without the backend.** Upload any `.adb`/`.ads` file and the frontend falls back to a built-in TypeScript analyzer automatically.

---

## Run the Project

### Terminal 1 — Start the backend

> **Requires GNAT Studio 2026** (includes Python 3.13 + libadalang).  
> Download: https://github.com/AdaCore/gnatstudio/releases/latest

Open a terminal and run these commands one at a time:

**PowerShell:**
```powershell
cd D:\ada\backend
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Command Prompt (cmd):**
```bat
cd D:\ada\backend
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Or use the one-click script (opens its own window):**
```bat
cd D:\ada\backend
start_server.bat
```

Backend runs at → **http://localhost:8001**

---

### Terminal 2 — Start the frontend

Open a **second** terminal at the project root (`D:\ada`):

**PowerShell or cmd:**
```bash
cd D:\ada
npm install
npm run dev
```

Frontend runs at → **http://localhost:5173**

> If port 5173 is busy, Vite picks the next available port (e.g. 5174). Check the terminal output.

---

### Verify both are running

```powershell
Invoke-RestMethod http://localhost:8001/health
```

Expected response:
```json
{"status": "ok", "libadalang_available": true, "version": "2.0.0"}
```

Then open **http://localhost:5173** in your browser.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Installation](#installation)
3. [How It Works](#how-it-works)
4. [Features](#features)
5. [API Reference](#api-reference)
6. [Backend Analyzer Modules](#backend-analyzer-modules)
7. [Frontend Data Flow](#frontend-data-flow)
8. [Keyboard Shortcuts](#keyboard-shortcuts)
9. [Tech Stack](#tech-stack)
10. [Development](#development)

---

## Project Structure

```
ada-analysis-tool/
│
├── src/                          ← Frontend source (used by Vite)
│   ├── components/
│   │   ├── analysis/             ← AnalysisOutput (complexity, bugs, dead code)
│   │   ├── diagnostics/          ← DiagnosticsPanel (errors, warnings, info)
│   │   ├── editor/               ← Monaco editor, tabs, breadcrumbs, Ada syntax
│   │   ├── file-manager/         ← File tree, JSON panel, package hierarchy
│   │   ├── graph/                ← Graphviz call graph viewer
│   │   ├── panels/               ← Resizable right/bottom panels
│   │   ├── subprogram/           ← Outline explorer, context menu, parameters modal
│   │   ├── test-cases/           ← TestCasePanel (embedded Test Studio inputs),
│   │   │                           TestStudioPanel, cards, history, runner, heatmap
│   │   ├── upload/               ← Dropzone, file/folder preview cards
│   │   └── shared/               ← Badge, Button, Toast, Tooltip, CommandPalette
│   ├── hooks/
│   │   ├── useFileParser.ts      ← Triggers parse on file click; calls backend or fallback
│   │   ├── useResizablePanel.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── mocks/                    ← Demo data (used only when no real files loaded)
│   ├── pages/
│   │   ├── UploadPage.tsx        ← Drag & drop entry + Open Test Studio button
│   │   ├── EditorPage.tsx        ← Full IDE layout
│   │   └── TestStudioPage.tsx    ← Standalone Test Studio page (/test-studio)
│   ├── store/                    ← Zustand stores
│   ├── styles/
│   │   └── TestStudio.css        ← Test Studio styles (light + .ts-dark overrides)
│   ├── types/
│   └── utils/
│       ├── adaAnalyzer.ts        ← Client-side fallback analyzer
│       ├── apiClient.ts          ← fetch wrapper (ROOT_URL for /health & /analyze,
│       │                           BASE_URL /api for test studio endpoints)
│       └── ...
│
├── frontend/                     ← Mirror copy of src/ (kept in sync)
│
├── backend/                      ← Python FastAPI analysis server
│   ├── analyzer/                 ← 19 libadalang analyzer modules
│   ├── generators/               ← harness_generator.py, mock_generator.py
│   ├── utils/
│   │   └── json_serializer.py
│   ├── server.py                 ← FastAPI entry point — all 10 endpoints
│   ├── runner.py                 ← CLI standalone runner (no server needed)
│   ├── output_writer.py          ← Writes analysis_output.json to disk
│   ├── requirements.txt          ← fastapi, uvicorn, python-multipart
│   ├── start_server.bat          ← Windows one-click startup
│   └── testada_caseinsensitive/  ← Sample Ada files for testing
│
├── correction/                   ← Reference implementation (integrated)
├── index.html
├── package.json
├── vite.config.ts                ← Dev proxy: /api, /analyze, /health → localhost:8001
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Installation

### Frontend

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |

```bash
# Install dependencies (run once from project root)
npm install

# Start dev server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Backend

`libadalang` is **not on PyPI** — it ships exclusively with GNAT Studio.

**Step 1 — Install GNAT Studio 2026 (Windows x64)**

Download from:
```
https://github.com/AdaCore/gnatstudio/releases/latest
```

Run the `.exe` installer — installs to `C:\GNATSTUDIO\` by default.

**Step 2 — Verify libadalang is available**

**PowerShell:**
```powershell
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -c "import libadalang; print('libadalang OK')"
```

**cmd:**
```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -c "import libadalang; print('libadalang OK')"
```

Expected: `libadalang OK`

**Step 3 — Install Python dependencies**

**PowerShell:**
```powershell
cd D:\ada\backend
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
```

**cmd:**
```bat
cd D:\ada\backend
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9
```

**Step 4 — Start the server**

**PowerShell:**
```powershell
cd D:\ada\backend
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**cmd:**
```bat
cd D:\ada\backend
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

---

## How It Works

```
┌──────────────────────────────────────────────────────────────┐
│                      Browser (React)                          │
│                                                               │
│  1. Upload .adb / .ads files via drag & drop                  │
│                                                               │
│  2. Click a file in the Files panel                           │
│         │                                                     │
│         ▼                                                     │
│  useFileParser hook                                           │
│         │                                                     │
│         ├── Backend available? ──YES──► POST /analyze         │
│         │                                      │              │
│         │                              libadalang (18 modules)│
│         │                                      │              │
│         │                              AdaAnalysisResult JSON │
│         │                                      │              │
│         └── Backend unavailable? ──► adaAnalyzer.ts (regex)   │
│                                               │               │
│                                               ▼               │
│                                   useParseStore (Zustand)     │
│                                               │               │
│              ┌────────────────────────────────┤               │
│              ▼                ▼               ▼               │
│        GraphViewer    DiagnosticsPanel  AnalysisOutput        │
│        (call_graph)   (bug_report,      (complexity,          │
│                        dead_code,        dead_code,           │
│                        logical_errors)   concurrency)         │
│                                                               │
│  3. Test Cases tab → TestStudioInputs shows real params       │
│         → editable input fields with type labels              │
│         → run test / auto-fill / export inputs                │
│         → variables tab, history tab                          │
│                                                               │
│  4. Export HTML report or project JSON                        │
└──────────────────────────────────────────────────────────────┘
                        │
          Vite proxy (/analyze, /health, /api/*)
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│              FastAPI Backend  http://localhost:8001            │
│                                                               │
│  POST /analyze          (file upload — multipart/form-data)   │
│  POST /api/analyze      (path-based — JSON body)              │
│  GET  /health                                                 │
│  GET  /api/files                                              │
│  GET  /api/file                                               │
│  GET  /api/subprograms  (enriched with type constraints)      │
│  POST /api/test/run     (type-validated simulation)           │
│  GET  /api/test/results                                       │
│  POST /api/test/clear                                         │
│  GET  /api/export                                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Features

### Upload Page
- Drag & drop `.adb` / `.ads` files or entire folders
- **Open Test Studio** button — goes directly to the Test Studio page
- Session persistence — files survive page refresh via `localStorage`

### Editor — Test Cases tab
- **Test Studio inputs embedded at the top** when a subprogram is selected:
  - `inputs` tab — editable parameter cards with type labels (UINT16 CAPS, uint16 lower, UInt16 orig), range hints (0..65535), run test / auto-fill / export buttons
  - `variables` tab — full variable table with declared type, normalized type, scope, constraint
  - `history` tab — every test run with timestamp, pass/fail/error, inputs
  - Result box — pass/fail/error with actual vs expected values and type violations
- Auto-generated test cases (normal, edge, invalid, boundary) shown below
- Drag-to-reorder test cards, export as JSON / .adb / CSV

### Test Studio (standalone at `/test-studio`)
- Enter any Ada project path → click Analyze
- Subprogram list with dead code badges and test status dots
- Same input/variables/history UI as the embedded version
- Results sidebar, export report button

### Static Analysis — 18 libadalang modules

| Field | Module | Frontend |
|---|---|---|
| `subprogram_index` | SubprogramIndexer | SubprogramExplorer |
| `call_graph` | CallGraphBuilder | GraphViewer |
| `cyclomatic_complexity` | ComplexityAnalyzer | AnalysisOutput |
| `dead_code` | DeadCodeDetector | AnalysisOutput, DiagnosticsPanel |
| `variables_info` | VariablesAnalyzer | ParsedJsonPanel, AnalysisOutput |
| `global_read_write` | GlobalRWDetector | AnalysisOutput |
| `control_flow_extractor` | ControlFlowExtractor | AnalysisOutput |
| `loop_info` | LoopAnalyzer | AnalysisOutput |
| `exceptions_info` | ExceptionAnalyzer | AnalysisOutput |
| `concurrency_info` | ConcurrencyAnalyzer | AnalysisOutput |
| `protected_objects` | ProtectedAccessDetector | AnalysisOutput |
| `logical_errors` | LogicalErrorDetector | DiagnosticsPanel |
| `bug_report` | BugDetector | DiagnosticsPanel, AnalysisOutput |
| `performance_warnings` | PerformanceAnalyzer | DiagnosticsPanel |
| `test_harness_data` | TestHarnessGenerator | TestCasePanel |
| `mock_stub_data` | MockStubGenerator | ParsedJsonPanel |
| `ast_info` | Parser | ParsedJsonPanel |

---

## API Reference

### `GET /health`

```json
{
  "status": "ok",
  "libadalang_available": true,
  "version": "2.0.0",
  "analyzed": true,
  "files": 2,
  "subprograms": 4
}
```

### `POST /analyze` — file upload

**Request:** `multipart/form-data`, field `files`, one or more `.adb`/`.ads`/`.ada` files

```bash
curl -X POST http://localhost:8001/analyze \
  -F "files=@my_package.adb" \
  -F "files=@my_package.ads"
```

**Error responses:**

| Status | Meaning |
|---|---|
| `400` | File is not `.adb` / `.ads` / `.ada` |
| `503` | libadalang not installed |
| `500` | Analysis pipeline error |

### `POST /api/analyze` — path-based (Test Studio)

```bash
curl -X POST http://localhost:8001/api/analyze \
  -H "Content-Type: application/json" \
  -d "{\"path\": \"C:\\\\path\\\\to\\\\ada\\\\project\"}"
```

**Response:**
```json
{"ok": true, "file_count": 2, "subprogram_count": 4, "error": null}
```

### `GET /api/subprograms`

```json
[
  {
    "name": "Check_Pixel",
    "file_name": "bitmapped_drawing.adb",
    "start_line": 30,
    "end_line": 88,
    "complexity": 5,
    "is_dead": true,
    "params": [
      {"name": "Orida_In",  "dir": "in",  "type": "UINT16", "constraint": {"kind": "integer", "min": 0, "max": 65535}},
      {"name": "Aran_In",   "dir": "in",  "type": "uint16", "constraint": {"kind": "integer", "min": 0, "max": 65535}},
      {"name": "Karan_Out", "dir": "out", "type": "UInt16", "constraint": {"kind": "integer", "min": 0, "max": 65535}}
    ],
    "variables": [...],
    "calls": []
  }
]
```

### `POST /api/test/run`

```bash
curl -X POST http://localhost:8001/api/test/run \
  -H "Content-Type: application/json" \
  -d "{\"subprogram\": \"Check_Pixel\", \"inputs\": {\"Orida_In\": \"100\", \"Aran_In\": \"50\"}, \"expected\": {\"Karan_Out\": \"150\"}}"
```

**Response — pass:**
```json
{"status": "pass", "message": "All assertions passed", "actual": {"Karan_Out": "150"}, "elapsed_ms": 0.02}
```

**Response — type violation:**
```json
{
  "status": "error",
  "message": "Type constraint violation",
  "violations": [
    {"variable": "Orida_In", "type": "UINT16", "value": "99999", "error": "Value 99999 out of range [0 .. 65535]"}
  ],
  "actual": {}
}
```

### Other endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/files` | GET | List all Ada files from last analysis |
| `/api/file?path=...` | GET | Get raw source of one file |
| `/api/test/results` | GET | All test results for this session |
| `/api/test/clear` | POST | Reset all test results |
| `/api/export` | GET | Export full analysis + test results as JSON |

---

## Backend Analyzer Modules

All 18 modules run on every `POST /analyze` call:

| Module | Class | Output field |
|---|---|---|
| `project_loader.py` | `ProjectLoader` | — (loads libadalang units) |
| `indexer.py` | `SubprogramIndexer` | `subprogram_index` |
| `parser.py` | `Parser` | `ast_info` |
| `callgraph.py` | `CallGraphBuilder` | `call_graph` |
| `deadcode.py` | `DeadCodeDetector` | `dead_code` |
| `complexity.py` | `ComplexityAnalyzer` | `cyclomatic_complexity` |
| `control_flow_extractor.py` | `ControlFlowExtractor` | `control_flow_extractor` |
| `loop_analysis.py` | `LoopAnalyzer` | `loop_info` |
| `variables_analysis.py` | `VariablesAnalyzer` | `variables_info` |
| `globals_analysis.py` | `GlobalRWDetector` | `global_read_write` |
| `exception_analysis.py` | `ExceptionAnalyzer` | `exceptions_info` |
| `concurrency.py` | `ConcurrencyAnalyzer` | `concurrency_info` |
| `protected_analysis.py` | `ProtectedAccessDetector` | `protected_objects` |
| `logical_error.py` | `LogicalErrorDetector` | `logical_errors` |
| `bug_detector.py` | `BugDetector` | `bug_report` |
| `performance.py` | `PerformanceAnalyzer` | `performance_warnings` |
| `harness_generator.py` | `TestHarnessGenerator` | `test_harness_data` |
| `mock_generator.py` | `MockStubGenerator` | `mock_stub_data` |

---

## Frontend Data Flow

```
Click file in Files panel
        │
        ▼
useFileParser.parseFile(file)
        │
        ├── POST /analyze  ──► backend returns AdaAnalysisResult
        │         │
        │         └── backendSubprogramsToStore()
        │               converts subprogram_index → Subprogram[]
        │
        └── fallback: adaAnalyzer.ts (regex-based, same schema)
                │
                ▼
        useParseStore.setResult(fileId, { analysis, jsonText, subprograms })
                │
        ┌───────┼────────────────────────────────────┐
        ▼       ▼                ▼                   ▼
  GraphViewer  DiagnosticsPanel  AnalysisOutput  TestCasePanel
  call_graph   bug_report        complexity      TestStudioInputs
               logical_errors    dead_code       (real params from
               dead_code         concurrency      /api/subprograms)
```

**URL routing in `apiClient.ts`:**

| Function | URL | Vite proxy → Backend |
|---|---|---|
| `checkHealth()` | `GET /health` | → `GET /health` |
| `analyzeFiles()` | `POST /analyze` | → `POST /analyze` (FormData) |
| `analyzeByPath()` | `POST /api/analyze` | → `POST /api/analyze` (JSON) |
| `getFiles()` | `GET /api/files` | → `GET /api/files` |
| `getSubprograms()` | `GET /api/subprograms` | → `GET /api/subprograms` |
| `runTest()` | `POST /api/test/run` | → `POST /api/test/run` |
| `getTestResults()` | `GET /api/test/results` | → `GET /api/test/results` |
| `clearTestResults()` | `POST /api/test/clear` | → `POST /api/test/clear` |
| `getExportUrl()` | `GET /api/export` | → `GET /api/export` |

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+K` | Command Palette |
| `Ctrl+Shift+T` | Switch to Test Cases tab |
| `Ctrl+Shift+G` | Switch to Call Graph tab |
| `Ctrl+Shift+P` | Focus subprogram search |
| `Ctrl+E` | Export current tests as JSON |
| `Ctrl+H` | Find & Replace in editor |
| `Ctrl+M` | Toggle minimap |
| `Ctrl++` / `Ctrl+-` | Increase / decrease font size |
| `Ctrl+\` | Toggle right panel |
| `Ctrl+`` ` `` | Toggle bottom panel |
| `?` | Keyboard shortcuts modal |
| `Esc` | Close modal / context menu |

---

## Tech Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5.3 | Type safety |
| Vite | 5 | Build tool + dev proxy |
| Monaco Editor | 0.47 | Code editor with Ada syntax |
| Zustand | 4.5 | State management |
| `@hpcc-js/wasm` | 2.13 | Graphviz DOT rendering |
| react-dropzone | 14 | File upload |
| Tailwind CSS | 3.4 | Styling |
| Lucide React | 0.344 | Icons |
| date-fns | 3.3 | Date formatting |

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.13 | Runtime (bundled with GNAT Studio) |
| FastAPI | 0.111 | REST API framework |
| uvicorn | 0.29 | ASGI server |
| libadalang | 26.0 | Ada semantic AST analysis |
| python-multipart | 0.0.9 | File upload parsing |

---

## Development

### Run both servers (copy-paste ready)

**Terminal 1 — Backend (PowerShell):**

```powershell
cd D:\ada\backend
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 1 — Backend (cmd):**

```bat
cd D:\ada\backend
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 2 — Frontend (PowerShell or cmd):**

```bash
cd D:\ada
npm run dev
```

### npm scripts

```bash
npm run dev      # Dev server  →  http://localhost:5173
npm run build    # Production build  →  dist/
npm run preview  # Preview build  →  http://localhost:4173
```

### Run the CLI analyzer (no server needed)

**PowerShell:**
```powershell
cd D:\ada\backend
& "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" runner.py
```

**cmd:**
```bat
cd D:\ada\backend
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" runner.py
```

Output is written to `analysis_output.json`.  
To analyze your own files, edit the `path` variable in `runner.py`:

```python
# Default:
path = Path(__file__).parent / "testada_caseinsensitive"

# Change to your project:
path = Path("C:/your/ada/project")
```

### Environment variables (production)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_ROOT_URL` | `""` | Base URL for `/health` and `/analyze` |
| `VITE_API_BASE_URL` | `/api` | Base URL for all `/api/*` endpoints |

Create a `.env` file at the project root:

```env
VITE_API_ROOT_URL=https://your-backend.example.com
VITE_API_BASE_URL=https://your-backend.example.com/api
```

---

## Repository

**GitHub:** https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool  
**Author:** Rakshitha  
**License:** MIT © 2025 Rakshitha
