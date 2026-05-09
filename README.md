# Ada Analysis & Test Generation Tool

A full-stack web IDE for **Ada source code static analysis and automatic test case generation**.

- **Frontend** — React 18 + TypeScript + Monaco Editor + Vite
- **Backend** — Python FastAPI + libadalang (AdaCore's semantic AST library)

---

## Project Structure

```
ada-analysis-tool/
├── frontend/                    # React/TypeScript web application
│   ├── src/
│   │   ├── components/          # UI components (editor, panels, upload, graph, etc.)
│   │   ├── hooks/               # Custom React hooks
│   │   ├── pages/               # UploadPage, EditorPage
│   │   ├── store/               # Zustand state stores
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # adaParser, adaAnalyzer, apiClient, testCaseGenerator
│   ├── index.html
│   ├── vite.config.ts           # Dev proxy: /api → http://localhost:8001
│   └── package.json
│
├── backend/                     # Python FastAPI analysis server
│   ├── analyzer/                # libadalang-powered analysis modules
│   ├── generators/              # Test harness & mock stub generators
│   ├── server.py                # FastAPI server (POST /analyze, GET /health)
│   ├── runner.py                # CLI standalone runner
│   ├── requirements.txt
│   └── start_server.bat         # Windows one-click startup
│
├── src/                         # Frontend source (root-level, used by Vite)
├── ADA-Test-master/             # Original backend source & sample Ada files
└── README.md
```

---

## Quick Start

### 1. Start the Backend

> **Requires GNAT Studio** (bundles Python + libadalang).
> Download: https://github.com/AdaCore/gnatstudio/releases/latest

```bat
cd backend
start_server.bat
```

Or manually:
```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m pip install -r backend\requirements.txt
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" backend\server.py
```

Backend runs at **http://localhost:8001**

### 2. Start the Frontend

```bash
npm install
npm run dev
```

Frontend runs at **http://localhost:5173**

> The frontend works **without the backend** — it falls back to a client-side TypeScript analyzer automatically.

---

## Installation

### Frontend Requirements
- Node.js 18+
- npm 9+

### Backend Requirements
- **GNAT Studio 2026** (Windows x64)
  - Download the installer (~370 MB):
    ```
    https://github.com/AdaCore/gnatstudio/releases/download/gnatstudio-2026.2-20260409/gnatstudio-2026.2-20260409-x86_64-windows64-bin.exe
    ```
  - Run the `.exe` and install to `C:\GNATSTUDIO\` (default)
  - Verify libadalang:
    ```bat
    "C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -c "import libadalang; print('OK')"
    ```

> **Why GNAT Studio?** `libadalang` is not on PyPI. It is distributed exclusively as part of the GNAT toolchain. GNAT Studio bundles Python 3.13 + libadalang + all required DLLs in a single installer.

---

## Features

### Upload Page
- Drag & drop `.adb` / `.ads` Ada source files or entire folders
- Recursive folder scanning with duplicate detection
- Session persistence — files survive page refresh via localStorage
- Analysis settings toggle (test gen, static analysis, minimap, split editor, font size, theme)

### Editor
- Monaco Editor with custom Ada syntax highlighting
- Three themes: Purple (VS Code-like), Amber (dark), Soft (warm dark)
- Sticky subprogram header — shows which subprogram your cursor is inside
- Inline error squiggles from diagnostics
- Gutter icons: ✓ pass / ✗ fail / ~ partial per subprogram
- Split editor pane — view two files side by side
- Find & Replace (`Ctrl+H`)
- Hover tooltips — hover any subprogram name to see its signature
- Go to definition — `Ctrl+Click` a subprogram name
- Font size controls (`Ctrl++` / `Ctrl+-`)
- Minimap toggle (`Ctrl+M`)

### Subprogram Explorer
- Procedures / Functions tabs with count badges
- Instant search with match highlighting
- Click any row → navigates editor to that exact line
- Complexity dot per row (green/yellow/red)
- Test count badge with pass/fail color coding
- Right-click context menu (Generate Test, View Variables, Show Parameters, Call Graph, Dead Code)

### Test Cases
- Auto-generation: normal, edge, invalid, boundary test cases
- Drag-to-reorder test cards
- Inline note/annotation editor per test case
- Test history with localStorage persistence
- Coverage heatmap — shows which test types are covered per subprogram
- Test statistics panel — total/pass/fail/pending counts
- Export: JSON, `.adb` stub, CSV

### Test Runner
- Run all tests with simulated async execution
- Pass/fail status with animation
- Side-by-side diff view on failure

### Static Analysis (powered by libadalang when backend is running)
- Subprogram index with parameters, return types, line ranges
- Call graph (caller → callee)
- Cyclomatic complexity per subprogram
- Dead code detection (unused subprograms)
- Global variable read/write tracking
- Local variable extraction with types
- Control flow: if/elsif/when conditions, branch variables
- Loop analysis, exception handler counts
- Concurrency: task and protected object detection
- Logical error detection (division by zero, etc.)
- Performance warnings (heavy loops)
- Test harness template generation
- Mock stub generation

### Call Graph
- Graphviz DOT rendering via `@hpcc-js/wasm`
- Pan, zoom, reset controls

### Diagnostics Panel
- Error / Warning / Info rows
- Click any row → navigates editor to that line

### Command Palette (`Ctrl+K`)
- Fuzzy search across files, subprograms, and actions

### Export
- HTML report (self-contained, printable to PDF)
- Project JSON (`.adaproject.json`)

---

## API Reference

### `GET /health`
```json
{ "status": "ok", "libadalang_available": true }
```

### `POST /analyze`
**Request:** `multipart/form-data` — field `files` with one or more `.adb`/`.ads` files

**Response:**
```json
{
  "file_paths": ["..."],
  "subprogram_index": { "file.adb": [{ "name": "Add", "parameters": ["A, B : Integer"], "return_type": "Integer", "start_line": 2, "end_line": 5 }] },
  "call_graph": { "Add": [], "Multiply": ["Add"] },
  "global_read_write": { "file.adb": { "read": [], "write": [] } },
  "cyclomatic_complexity": { "Add": 1 },
  "dead_code": ["UnusedProc"],
  "variables_info": { "file.adb": { "global_variables": {}, "global_constants": {}, "local_variables": { "Multiply": { "Result": { "type": "Integer" } } } } },
  "control_flow_extractor": { "file.adb": { "Add": { "if_conditions": [], "branch_body_variables": {}, "procedure_calls": [] } } },
  "loop_info": { "Add": 0 },
  "exceptions_info": { "Add": 0 },
  "concurrency_info": { "tasks": [], "protected_objects": [] },
  "logical_errors": [],
  "performance_warnings": [],
  "test_harness_data": { "file.adb": [{ "test_name": "test_Add", "template": "procedure test_Add is\nbegin\n    Add(...);\nend test_Add;" }] },
  "mock_stub_data": {}
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React)                       │
│                                                          │
│  UploadPage → drop .adb/.ads files                       │
│       │                                                  │
│       ▼                                                  │
│  useFileParser hook                                      │
│       │                                                  │
│       ├─── Backend available? ──YES──► POST /api/analyze │
│       │                                    │             │
│       │                                    ▼             │
│       │                          libadalang analysis     │
│       │                          (full AST, types, etc.) │
│       │                                    │             │
│       └─── Backend unavailable? ──► adaAnalyzer.ts       │
│                                    (regex fallback)      │
│                                          │               │
│                                          ▼               │
│                              useParseStore (Zustand)     │
│                                          │               │
│                    ┌─────────────────────┤               │
│                    ▼                     ▼               │
│             EditorPage              RightPanel           │
│          (Monaco Editor)     (Analysis/Tests/Graph)      │
└─────────────────────────────────────────────────────────┘
                     │
                     │ /api/* proxy (Vite dev server)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              FastAPI Backend (port 8001)                  │
│                                                          │
│  POST /analyze                                           │
│       │                                                  │
│       ├── ProjectLoader (libadalang AnalysisContext)     │
│       ├── SubprogramIndexer                              │
│       ├── CallGraphBuilder                               │
│       ├── ComplexityAnalyzer                             │
│       ├── DeadCodeDetector                               │
│       ├── GlobalRWDetector                               │
│       ├── VariablesAnalyzer                              │
│       ├── ControlFlowExtractor                           │
│       ├── LoopAnalyzer                                   │
│       ├── ExceptionAnalyzer                              │
│       ├── ConcurrencyAnalyzer                            │
│       ├── LogicalErrorDetector                           │
│       ├── PerformanceAnalyzer                            │
│       ├── TestHarnessGenerator                           │
│       └── MockStubGenerator                              │
│                                                          │
│  Python: C:\GNATSTUDIO\share\gnatstudio\python\          │
└─────────────────────────────────────────────────────────┘
```

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
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite 5 | Build tool + dev server proxy |
| Monaco Editor | Code editor with Ada syntax |
| Zustand | State management |
| `@hpcc-js/wasm` | Graphviz DOT rendering |
| react-dropzone | File upload |
| Tailwind CSS | Styling |
| Lucide React | Icons |

### Backend
| Technology | Purpose |
|---|---|
| Python 3.13 | Runtime (bundled with GNAT Studio) |
| FastAPI | REST API framework |
| uvicorn | ASGI server |
| libadalang | Ada semantic AST analysis |
| python-multipart | File upload parsing |

---

## Development

### Run both together

**Terminal 1 — Backend:**
```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" backend\server.py
```

**Terminal 2 — Frontend:**
```bash
npm run dev
```

### Build for production
```bash
npm run build
```
Output in `dist/`.

---

## Repository

GitHub: https://github.com/Banarji03/ada-analysis-tool
