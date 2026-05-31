# Ada Analysis & Test Generation Tool

A full-stack web IDE for **Ada source code static analysis and automatic test case generation**.

| Layer | Stack |
|---|---|
| Frontend | React 18 · TypeScript · Monaco Editor · Vite 5 · Zustand · Tailwind CSS |
| Backend | Python 3.13 · FastAPI · libadalang (AdaCore semantic AST) |

> **Live demo** — the frontend works without the backend. Upload any `.adb`/`.ads` file and it falls back to a client-side TypeScript analyzer automatically.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Quick Start](#quick-start)
3. [Installation](#installation)
4. [How It Works](#how-it-works)
5. [Features](#features)
6. [API Reference](#api-reference)
7. [Backend Analyzer Modules](#backend-analyzer-modules)
8. [Frontend Data Flow](#frontend-data-flow)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Tech Stack](#tech-stack)
11. [Development](#development)

---

## Project Structure

```
ada-analysis-tool/
│
├── src/                          ← Frontend source (used by Vite at root)
│   ├── components/
│   │   ├── analysis/             ← AnalysisOutput (complexity, bugs, dead code)
│   │   ├── diagnostics/          ← DiagnosticsPanel (errors, warnings, info)
│   │   ├── editor/               ← Monaco editor, tabs, breadcrumbs, Ada syntax
│   │   ├── file-manager/         ← File tree, JSON panel, package hierarchy
│   │   ├── graph/                ← Graphviz call graph viewer
│   │   ├── panels/               ← Resizable right/bottom panels
│   │   ├── subprogram/           ← Outline explorer, context menu, parameters modal
│   │   ├── test-cases/           ← Test panel, cards, history, runner, heatmap
│   │   ├── upload/               ← Dropzone, file/folder preview cards
│   │   └── shared/               ← Badge, Button, Toast, Tooltip, CommandPalette
│   ├── hooks/
│   │   ├── useFileParser.ts      ← Triggers parse on file click; calls backend or fallback
│   │   ├── useResizablePanel.ts
│   │   └── useKeyboardShortcuts.ts
│   ├── mocks/                    ← Demo data (used only when no real files loaded)
│   ├── pages/
│   │   ├── UploadPage.tsx        ← Drag & drop entry point
│   │   └── EditorPage.tsx        ← Full IDE layout
│   ├── store/                    ← Zustand stores
│   │   ├── useFileStore.ts
│   │   ├── useParseStore.ts      ← Holds AdaAnalysisResult per file
│   │   ├── useSubprogramStore.ts
│   │   ├── useTestCaseStore.ts
│   │   ├── useEditorStore.ts
│   │   └── useSettingsStore.ts
│   ├── types/
│   │   ├── diagnostic.types.ts
│   │   ├── file.types.ts
│   │   ├── graph.types.ts
│   │   ├── subprogram.types.ts
│   │   └── testcase.types.ts
│   └── utils/
│       ├── adaAnalyzer.ts        ← Client-side fallback analyzer (regex-based)
│       ├── adaParser.ts          ← Ada subprogram/package parser
│       ├── apiClient.ts          ← fetch wrapper → POST /api/analyze
│       ├── dotGenerator.ts       ← Converts call_graph to Graphviz DOT
│       ├── reportExport.ts       ← HTML + JSON report export
│       └── testCaseGenerator.ts  ← Heuristic test case generator
│
├── frontend/                     ← Mirror copy of src/ + config files
│   └── src/                      ← (same structure as above)
│
├── backend/                      ← Python FastAPI analysis server
│   ├── analyzer/
│   │   ├── project_loader.py     ← libadalang AnalysisContext
│   │   ├── indexer.py            ← Subprogram names, params, line ranges
│   │   ├── callgraph.py          ← Caller → callee graph
│   │   ├── complexity.py         ← Cyclomatic complexity
│   │   ├── deadcode.py           ← Unused subprograms
│   │   ├── globals_analysis.py   ← Global variable read/write
│   │   ├── variables_analysis.py ← Local + global vars with types
│   │   ├── control_flow_extractor.py ← if/elsif/when, branch vars, calls
│   │   ├── loop_analysis.py      ← Loop count per subprogram
│   │   ├── exception_analysis.py ← Exception handler count
│   │   ├── concurrency.py        ← Tasks + protected objects
│   │   ├── protected_analysis.py ← Protected access detection
│   │   ├── logical_error.py      ← Division-by-zero, logic errors
│   │   ├── bug_detector.py       ← Null deref, infinite loops, unreachable code
│   │   ├── performance.py        ← Heavy loop warnings
│   │   └── parser.py             ← AST root kind per file
│   ├── generators/
│   │   ├── harness_generator.py  ← Ada test harness templates
│   │   └── mock_generator.py     ← Mock stub generation
│   ├── utils/
│   │   └── json_serializer.py    ← Safe JSON serialization (sets, Paths, etc.)
│   ├── server.py                 ← FastAPI entry point (GET /health, POST /analyze)
│   ├── runner.py                 ← CLI standalone runner
│   ├── output_writer.py          ← Writes analysis_output.json to disk
│   ├── requirements.txt          ← fastapi, uvicorn, python-multipart
│   └── start_server.bat          ← Windows one-click startup
│
├── ADA-Test-master/              ← Original backend source + sample Ada files
├── index.html
├── package.json
├── vite.config.ts                ← Dev proxy: /api → http://localhost:8001
├── tailwind.config.ts
├── tsconfig.json
└── README.md                     ← This file
```

---

## Quick Start

### Step 1 — Start the backend

> Requires **GNAT Studio 2026** (bundles Python 3.13 + libadalang).
> Download (~370 MB): https://github.com/AdaCore/gnatstudio/releases/latest

```bat
cd backend
start_server.bat
```

Or manually:

```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m pip install -r backend\requirements.txt
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" backend\server.py
```

Backend starts at **http://localhost:8001**

### Step 2 — Start the frontend

```bash
npm install
npm run dev
```

Frontend starts at **http://localhost:5173**

Open your browser, upload `.adb` / `.ads` files, click a file to parse it — the full analysis JSON appears instantly.

---

## Installation

### Frontend

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |

```bash
npm install
```

### Backend

`libadalang` is **not on PyPI** — it ships exclusively with the GNAT toolchain.

**Install GNAT Studio 2026 (Windows x64):**

```bat
REM Download the installer
curl -L -o gnatstudio-installer.exe ^
  "https://github.com/AdaCore/gnatstudio/releases/download/gnatstudio-2026.2-20260409/gnatstudio-2026.2-20260409-x86_64-windows64-bin.exe"

REM Run it — installs to C:\GNATSTUDIO\ by default
gnatstudio-installer.exe
```

**Verify libadalang:**

```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -c "import libadalang; print('OK')"
```

**Install Python dependencies into the GNAT Python:**

```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m pip install -r backend\requirements.txt
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
│         ├── Backend available? ──YES──► POST /api/analyze     │
│         │                                      │              │
│         │                              libadalang (18 modules)│
│         │                                      │              │
│         │                              AdaAnalysisResult JSON │
│         │                                      │              │
│         └── Backend unavailable? ──► adaAnalyzer.ts (regex)  │
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
│  3. Click "Generate Tests from JSON"                          │
│         → TestCasePanel generates normal/edge/invalid tests   │
│         → TestRunner simulates execution                      │
│                                                               │
│  4. Export HTML report or project JSON                        │
└──────────────────────────────────────────────────────────────┘
                        │
              /api/* proxy (Vite)
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│              FastAPI Backend  http://localhost:8001            │
│                                                               │
│  POST /analyze                                                │
│    ├── ProjectLoader       → libadalang AnalysisContext       │
│    ├── SubprogramIndexer   → subprogram_index                 │
│    ├── Parser              → ast_info                         │
│    ├── CallGraphBuilder    → call_graph                       │
│    ├── DeadCodeDetector    → dead_code                        │
│    ├── ComplexityAnalyzer  → cyclomatic_complexity            │
│    ├── ControlFlowExtractor→ control_flow_extractor           │
│    ├── LoopAnalyzer        → loop_info                        │
│    ├── VariablesAnalyzer   → variables_info                   │
│    ├── GlobalRWDetector    → global_read_write                │
│    ├── ExceptionAnalyzer   → exceptions_info                  │
│    ├── ConcurrencyAnalyzer → concurrency_info                 │
│    ├── ProtectedAccessDetector → protected_objects            │
│    ├── LogicalErrorDetector→ logical_errors                   │
│    ├── BugDetector         → bug_report                       │
│    ├── PerformanceAnalyzer → performance_warnings             │
│    ├── TestHarnessGenerator→ test_harness_data                │
│    └── MockStubGenerator   → mock_stub_data                   │
│                                                               │
│  Python: C:\GNATSTUDIO\share\gnatstudio\python\python.exe    │
└──────────────────────────────────────────────────────────────┘
```

---

## Features

### Upload Page
- Drag & drop `.adb` / `.ads` files or entire folders
- Recursive folder scanning with duplicate detection
- Session persistence — files survive page refresh via `localStorage`
- Settings toggle: test generation, static analysis, minimap, split editor, font size, theme

### Editor
- Monaco Editor with custom Ada syntax highlighting
- Three themes: Purple (VS Code-like), Amber (dark), Soft (warm dark)
- Sticky subprogram header — shows which subprogram the cursor is inside
- Inline error squiggles from diagnostics
- Gutter icons: ✓ pass / ✗ fail / ~ partial per subprogram
- Split editor pane — view two files side by side
- Find & Replace (`Ctrl+H`)
- Hover tooltips — hover any subprogram name to see its signature
- Go to definition — `Ctrl+Click` a subprogram name
- Font size controls (`Ctrl++` / `Ctrl+-`)
- Minimap toggle (`Ctrl+M`)

### File Manager & JSON Panel
- Click any file → parses it immediately → JSON analysis appears in the JSON tab
- Switch editor tabs → JSON panel follows the active file automatically
- Each parsed file gets its own tab in the JSON panel with a ✕ remove button
- Editable JSON — modify the analysis before generating tests
- Download JSON button per file
- Summary bar: subprograms · local vars · global vars · dead code · bugs · loops · tasks

### Subprogram Explorer
- Procedures / Functions tabs with count badges
- Instant search with match highlighting
- Click any row → navigates editor to that exact line
- Complexity dot per row (green / yellow / red)
- Test count badge with pass/fail color coding
- Right-click context menu: Generate Test, View Variables, Show Parameters, Call Graph, Dead Code

### Static Analysis (libadalang when backend running, regex fallback otherwise)

| Field | Source | Frontend consumer |
|---|---|---|
| `subprogram_index` | SubprogramIndexer | SubprogramExplorer, ParsedJsonPanel |
| `call_graph` | CallGraphBuilder | GraphViewer |
| `cyclomatic_complexity` | ComplexityAnalyzer | AnalysisOutput |
| `dead_code` | DeadCodeDetector | AnalysisOutput, DiagnosticsPanel |
| `variables_info` | VariablesAnalyzer | ParsedJsonPanel, AnalysisOutput |
| `global_read_write` | GlobalRWDetector | ParsedJsonPanel |
| `control_flow_extractor` | ControlFlowExtractor | ParsedJsonPanel |
| `loop_info` | LoopAnalyzer | AnalysisOutput |
| `exceptions_info` | ExceptionAnalyzer | AnalysisOutput |
| `concurrency_info` | ConcurrencyAnalyzer | AnalysisOutput |
| `protected_objects` | ProtectedAccessDetector | AnalysisOutput |
| `logical_errors` | LogicalErrorDetector | AnalysisOutput, DiagnosticsPanel |
| `bug_report` | BugDetector | AnalysisOutput, DiagnosticsPanel |
| `performance_warnings` | PerformanceAnalyzer | AnalysisOutput, DiagnosticsPanel |
| `test_harness_data` | TestHarnessGenerator | ParsedJsonPanel |
| `mock_stub_data` | MockStubGenerator | ParsedJsonPanel |
| `ast_info` | Parser | ParsedJsonPanel |

### Test Cases
- Auto-generation: normal, edge, invalid, boundary test cases per subprogram
- Drag-to-reorder test cards
- Inline note/annotation editor per test case
- Test history with `localStorage` persistence (up to 50 sets)
- Coverage heatmap — shows which test types are covered per subprogram
- Test statistics panel — total / pass / fail / pending counts with pass rate bar
- Export: JSON, `.adb` stub, CSV

### Test Runner
- Run all tests with simulated async execution
- Pass/fail status with stagger animation
- Side-by-side diff view on failure (Expected vs Actual)

### Call Graph
- Graphviz DOT rendering via `@hpcc-js/wasm`
- Uses real `call_graph` from libadalang when a file is parsed
- Falls back to demo graph when no file is parsed
- Pan (drag), zoom (scroll wheel), reset controls
- `libadalang ✓` badge shown when real data is active

### Diagnostics Panel
- Built from real `bug_report`, `logical_errors`, `performance_warnings`, `dead_code`
- Falls back to demo diagnostics when no file is parsed
- Error / Warning / Info filter tabs
- Click any row → navigates editor to that exact line
- `libadalang ✓` badge shown when real data is active

### Analysis Output
- Real cyclomatic complexity bars per subprogram
- Bug report: division-by-zero, null dereference, infinite loops, unreachable code
- Logical errors and performance warnings
- Concurrency: tasks and protected objects
- Variables summary: local vars, global vars, loop count, exception handlers
- Falls back to demo data when no file is parsed

### Command Palette (`Ctrl+K`)
- Fuzzy search across files, subprograms, and actions
- Keyboard navigation (↑↓ Enter Esc)

### Export
- **HTML report** — self-contained, printable to PDF, includes real diagnostics from all parsed files
- **Project JSON** — `.adaproject.json` with files, subprograms, test sets

---

## API Reference

### `GET /health`

```json
{
  "status": "ok",
  "libadalang_available": true,
  "version": "2.0.0"
}
```

### `POST /analyze`

**Request:** `multipart/form-data` — field `files`, one or more `.adb` / `.ads` / `.ada` files

**Response — 17 top-level fields:**

```json
{
  "file_paths": ["C:/tmp/math_utils.adb"],
  "ast_info": { "math_utils.adb": "CompilationUnit" },
  "subprogram_index": {
    "math_utils.adb": [
      { "name": "Add", "parameters": ["A, B : Integer"], "return_type": "Integer", "start_line": 2, "end_line": 5 }
    ]
  },
  "call_graph":             { "Add": [], "Multiply": ["Add"] },
  "dead_code":              ["UnusedProc"],
  "cyclomatic_complexity":  { "Add": 1, "Multiply": 3 },
  "control_flow_extractor": { "math_utils.adb": { "Add": { "if_conditions": [], "branch_body_variables": {}, "procedure_calls": [] } } },
  "loop_info":              { "Add": 0 },
  "variables_info":         { "math_utils.adb": { "global_variables": {}, "global_constants": {}, "local_variables": { "Multiply": { "Result": { "type": "Integer" } } } } },
  "global_read_write":      { "math_utils.adb": { "read": [], "write": [] } },
  "exceptions_info":        { "Add": 0 },
  "concurrency_info":       { "tasks": [], "protected_objects": [] },
  "protected_objects":      [],
  "logical_errors":         [],
  "bug_report": {
    "division_by_zero":    [],
    "uninitialized_variables": [],
    "null_dereference":    [],
    "infinite_loops":      [],
    "unreachable_code":    []
  },
  "performance_warnings":   [],
  "test_harness_data": {
    "math_utils.adb": [
      {
        "test_name": "Test_Add",
        "original_subprogram": "Add",
        "is_function": true,
        "return_type": "Integer",
        "parameters": ["A, B : Integer"],
        "template": "procedure Test_Add is\n   A : Integer := <>;\n   B : Integer := <>;\n   Result : Integer;\nbegin\n   Result := Add(A, B);\nend Test_Add;"
      }
    ]
  },
  "mock_stub_data": {}
}
```

**Error responses:**

| Status | Meaning |
|---|---|
| `400` | File is not `.adb` / `.ads` / `.ada` |
| `503` | libadalang not installed on the server |
| `500` | Analysis pipeline error (traceback in server logs) |

---

## Backend Analyzer Modules

All 18 modules are wired to `server.py` and run on every `POST /analyze` call:

| Module | Class | Output field |
|---|---|---|
| `project_loader.py` | `ProjectLoader` | — (loads units) |
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

Every component reads from `useParseStore` — no component uses hardcoded or mock data when a real file is parsed:

```
Click file in Files panel
        │
        ▼
useFileParser.parseFile(file)
        │
        ├── POST /api/analyze  ──► backend returns AdaAnalysisResult
        │         │
        │         └── backendSubprogramsToStore()
        │               converts subprogram_index → Subprogram[]
        │               (accurate line numbers, types from libadalang)
        │
        └── fallback: adaAnalyzer.ts (regex-based, same schema)
                │
                ▼
        useParseStore.setResult(fileId, { analysis, jsonText, subprograms })
                │
        ┌───────┼────────────────────────────────────┐
        ▼       ▼                ▼                   ▼
  GraphViewer  DiagnosticsPanel  AnalysisOutput  ParsedJsonPanel
  call_graph   bug_report        complexity      full JSON editor
               logical_errors    dead_code       Generate Tests btn
               dead_code         concurrency
               perf_warnings     variables
```

**Mock data is only used as a demo fallback** — it appears when no file has been parsed yet (first load with no uploaded files). As soon as any file is clicked and parsed, all components switch to real libadalang data.

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
| `Ctrl+\`` | Toggle bottom panel |
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

### Run both servers

**Terminal 1 — Backend:**
```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" backend\server.py
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

### Available scripts

```bash
npm run dev      # Dev server at http://localhost:5173
npm run build    # Production build → dist/
npm run preview  # Preview production build
```

### Run the CLI analyzer (no server)

```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" backend\runner.py
```

Edit the `path` variable at the top of `runner.py` to point to your Ada source directory. Output is written to `analysis_output.json`.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Override backend URL for production |

---

## Repository

**GitHub:** https://github.com/Banarji03/ada-analysis-tool
