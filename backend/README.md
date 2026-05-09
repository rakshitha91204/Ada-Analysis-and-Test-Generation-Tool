# Ada Analysis Tool — Backend

FastAPI server that performs deep Ada static analysis using **libadalang** (AdaCore's semantic AST library).

## Requirements

- **GNAT Studio 2026** (bundles Python 3.13 + libadalang)
  - Download: https://github.com/AdaCore/gnatstudio/releases/latest
  - Windows installer: `gnatstudio-2026.2-*-x86_64-windows64-bin.exe`
  - Default install path: `C:\GNATSTUDIO\`
- Python packages: `fastapi`, `uvicorn`, `python-multipart` (installed automatically by `start_server.bat`)

## Quick Start (Windows)

```bat
cd backend
start_server.bat
```

Or manually with the GNAT Python:

```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -m pip install -r requirements.txt
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" server.py
```

Server starts at **http://localhost:8001**

## API Endpoints

### `GET /health`
Returns server status and libadalang availability.

```json
{ "status": "ok", "libadalang_available": true }
```

### `POST /analyze`
Accepts one or more Ada source files (`.adb` / `.ads`) as multipart form-data.

**Request:** `multipart/form-data` with field `files` (one or more Ada files)

**Response:** Full analysis JSON:

```json
{
  "file_paths": ["path/to/file.adb"],
  "subprogram_index": {
    "file.adb": [
      { "name": "Add", "parameters": ["A, B : Integer"], "return_type": "Integer", "start_line": 2, "end_line": 5 }
    ]
  },
  "call_graph":            { "Add": [], "Multiply": ["Add"] },
  "global_read_write":     { "file.adb": { "read": [], "write": [] } },
  "cyclomatic_complexity": { "Add": 1, "Multiply": 3 },
  "dead_code":             ["UnusedProc"],
  "variables_info":        { "file.adb": { "global_variables": {}, "global_constants": {}, "local_variables": {} } },
  "control_flow_extractor":{ "file.adb": { "Add": { "if_conditions": [], "branch_body_variables": {}, "procedure_calls": [] } } },
  "loop_info":             { "Add": 0 },
  "exceptions_info":       { "Add": 0 },
  "concurrency_info":      { "tasks": [], "protected_objects": [] },
  "logical_errors":        [],
  "performance_warnings":  [],
  "test_harness_data":     { "file.adb": [{ "test_name": "test_Add", "template": "..." }] },
  "mock_stub_data":        {}
}
```

## Project Structure

```
backend/
├── analyzer/
│   ├── project_loader.py        # Loads Ada files into libadalang AnalysisContext
│   ├── indexer.py               # Extracts subprogram names, params, return types, line ranges
│   ├── callgraph.py             # Builds caller → callee graph
│   ├── complexity.py            # Cyclomatic complexity via AST node counting
│   ├── deadcode.py              # Detects unused subprograms
│   ├── globals_analysis.py      # Global variable read/write detection
│   ├── variables_analysis.py    # Local + global variable extraction with types
│   ├── control_flow_extractor.py# if/elsif/when conditions, branch vars, procedure calls
│   ├── loop_analysis.py         # Loop count per subprogram
│   ├── exception_analysis.py    # Exception handler count per subprogram
│   ├── concurrency.py           # Task and protected object detection
│   ├── logical_error.py         # Division-by-zero and other logic errors
│   └── performance.py           # Performance warnings (heavy loops, etc.)
├── generators/
│   ├── harness_generator.py     # Ada test harness template generation
│   └── mock_generator.py        # Mock stub generation from call graph
├── testada_caseinsensitive/     # Sample Ada files for testing
│   ├── bitmapped_drawing.adb
│   └── bitmapped_drawing.ads
├── utils/
│   └── json_serializer.py
├── server.py                    # FastAPI server (main entry point)
├── runner.py                    # CLI runner (standalone analysis)
├── output_writer.py             # Writes analysis JSON to disk
├── requirements.txt             # Python dependencies
└── start_server.bat             # Windows startup script (auto-detects GNAT Python)
```

## How libadalang is Installed

`libadalang` is **not on PyPI**. It is bundled with GNAT Studio:

1. Download GNAT Studio from https://github.com/AdaCore/gnatstudio/releases/latest
2. Run the Windows `.exe` installer
3. The Python at `C:\GNATSTUDIO\share\gnatstudio\python\python.exe` has libadalang pre-installed

Verify:
```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" -c "import libadalang; print('OK')"
```

## Running the CLI (without the server)

```bat
"C:\GNATSTUDIO\share\gnatstudio\python\python.exe" runner.py
```

Edit the `path` variable at the top of `runner.py` to point to your Ada source directory.
Output is written to `analysis_output.json`.
