"""
Ada Analysis Tool — Backend Server
Author: Rakshitha
GitHub: https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool
License: MIT © 2025 Rakshitha
"""

======================================================
Exposes:
    GET  /health    — liveness check
    POST /analyze   — full Ada static analysis via libadalang

Run with:
    "C:\\GNATSTUDIO\\share\\gnatstudio\\python\\python.exe" server.py

Or via start_server.bat
"""

from __future__ import annotations

import os
import sys
import tempfile
import traceback
from pathlib import Path

# ── path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

# ── FastAPI ───────────────────────────────────────────────────────────────────
try:
    from fastapi import FastAPI, File, UploadFile, HTTPException
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
except ImportError as e:
    print(f"[ERROR] FastAPI not installed.")
    print(f"  Run: pip install fastapi uvicorn python-multipart")
    print(f"  Detail: {e}")
    sys.exit(1)

# ── Analyzer imports ──────────────────────────────────────────────────────────
try:
    # Core
    from analyzer.project_loader import ProjectLoader
    from analyzer.indexer import SubprogramIndexer
    from analyzer.parser import Parser

    # Call graph & dead code
    from analyzer.callgraph import CallGraphBuilder
    from analyzer.deadcode import DeadCodeDetector

    # Complexity & control flow
    from analyzer.complexity import ComplexityAnalyzer
    from analyzer.control_flow_extractor import ControlFlowExtractor
    from analyzer.loop_analysis import LoopAnalyzer

    # Variables & globals
    from analyzer.variables_analysis import VariablesAnalyzer
    from analyzer.globals_analysis import GlobalRWDetector

    # Exceptions & concurrency
    from analyzer.exception_analysis import ExceptionAnalyzer
    from analyzer.concurrency import ConcurrencyAnalyzer
    from analyzer.protected_analysis import ProtectedAccessDetector

    # Errors & performance
    from analyzer.logical_error import LogicalErrorDetector
    from analyzer.performance import PerformanceAnalyzer
    from analyzer.bug_detector import BugDetector

    # Generators
    from generators.harness_generator import TestHarnessGenerator
    from generators.mock_generator import MockStubGenerator

    # Utils
    from utils.json_serializer import _make_serializable

    LIBADALANG_AVAILABLE = True

except ImportError as e:
    print(f"[WARNING] libadalang or analyzer modules not available: {e}")
    print("[WARNING] The /analyze endpoint will return 503 until libadalang is installed.")
    LIBADALANG_AVAILABLE = False

    def _make_serializable(obj):
        return obj

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ada Analysis Tool API",
    description="Full Ada static analysis using libadalang — all analyzer modules connected",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "libadalang_available": LIBADALANG_AVAILABLE,
        "version": "2.0.0",
    }


# ── Analysis endpoint ─────────────────────────────────────────────────────────
@app.post("/analyze")
async def analyze(files: list[UploadFile] = File(...)):
    """
    Accept one or more Ada source files (.adb / .ads) and return the full
    analysis JSON.

    All analyzer modules are connected:
      subprogram_index, ast_info, call_graph, global_read_write,
      cyclomatic_complexity, dead_code, variables_info,
      control_flow_extractor, loop_info, exceptions_info,
      concurrency_info, protected_objects, logical_errors,
      bug_report, performance_warnings, test_harness_data, mock_stub_data
    """
    if not LIBADALANG_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "libadalang is not installed. "
                "Install GNAT Studio from https://github.com/AdaCore/gnatstudio/releases/latest"
            ),
        )

    # Validate extensions
    ada_extensions = {".adb", ".ads", ".ada"}
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ada_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename}' is not an Ada source file (.adb/.ads/.ada).",
            )

    # Write uploads to a temp directory
    tmp_dir = tempfile.mkdtemp(prefix="ada_analysis_")
    file_paths: list[str] = []

    try:
        for upload in files:
            dest = os.path.join(tmp_dir, upload.filename or "unnamed.adb")
            content = await upload.read()
            with open(dest, "wb") as fh:
                fh.write(content)
            file_paths.append(dest)

        result = _run_analysis(file_paths)
        # Use json_serializer to handle sets, Paths, etc.
        return JSONResponse(content=_make_serializable(result))

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[ERROR] Analysis failed:\n{tb}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {exc}")

    finally:
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ── Full pipeline ─────────────────────────────────────────────────────────────
def _run_analysis(file_paths: list[str]) -> dict:
    """
    Run every analyzer module and return a single merged result dict.

    Modules connected:
      ProjectLoader         → lal.AnalysisContext + units
      SubprogramIndexer     → subprogram_index
      Parser                → ast_info (root kind per file)
      CallGraphBuilder      → call_graph
      DeadCodeDetector      → dead_code
      ComplexityAnalyzer    → cyclomatic_complexity
      ControlFlowExtractor  → control_flow_extractor
      LoopAnalyzer          → loop_info
      VariablesAnalyzer     → variables_info
      GlobalRWDetector      → global_read_write
      ExceptionAnalyzer     → exceptions_info
      ConcurrencyAnalyzer   → concurrency_info
      ProtectedAccessDetector → protected_objects
      LogicalErrorDetector  → logical_errors
      BugDetector           → bug_report
      PerformanceAnalyzer   → performance_warnings
      TestHarnessGenerator  → test_harness_data
      MockStubGenerator     → mock_stub_data
    """

    # ── Load all files into libadalang ────────────────────────────────────────
    loader = ProjectLoader(file_paths)
    units = loader.load_units()

    # ── Core analysis ─────────────────────────────────────────────────────────
    subprogram_index = SubprogramIndexer(units).index()
    ast_info         = Parser(units).extract_ast()
    callgraph        = CallGraphBuilder(units).build()
    dead_code        = DeadCodeDetector(callgraph).detect_unused_subprograms()

    # ── Complexity & control flow ─────────────────────────────────────────────
    cyclomatic_complexity = ComplexityAnalyzer(units).compute()
    control_flow          = ControlFlowExtractor(units).run()
    loop_info             = LoopAnalyzer(units).detect()

    # ── Variables & globals ───────────────────────────────────────────────────
    variables_info  = VariablesAnalyzer(units).extract()
    global_read_write = GlobalRWDetector(units).detect()

    # ── Exceptions & concurrency ──────────────────────────────────────────────
    exceptions_info   = ExceptionAnalyzer(units).detect()
    concurrency_info  = ConcurrencyAnalyzer(units).analyze()
    protected_objects = ProtectedAccessDetector(units).detect()

    # ── Errors & performance ──────────────────────────────────────────────────
    logical_errors       = LogicalErrorDetector(units).detect()
    bug_report           = BugDetector(units).detect()
    performance_warnings = PerformanceAnalyzer(units).analyze()

    # ── Generators ────────────────────────────────────────────────────────────
    test_harness_data = TestHarnessGenerator(subprogram_index).generate()
    mock_stub_data    = MockStubGenerator(callgraph).generate()

    return {
        # ── File info ──────────────────────────────────────────────────────
        "file_paths":            file_paths,
        "ast_info":              ast_info,

        # ── Subprograms ────────────────────────────────────────────────────
        "subprogram_index":      subprogram_index,

        # ── Call graph & dead code ─────────────────────────────────────────
        "call_graph":            callgraph,
        "dead_code":             dead_code,

        # ── Complexity & control flow ──────────────────────────────────────
        "cyclomatic_complexity": cyclomatic_complexity,
        "control_flow_extractor": control_flow,
        "loop_info":             loop_info,

        # ── Variables & globals ────────────────────────────────────────────
        "variables_info":        variables_info,
        "global_read_write":     global_read_write,

        # ── Exceptions & concurrency ───────────────────────────────────────
        "exceptions_info":       exceptions_info,
        "concurrency_info":      concurrency_info,
        "protected_objects":     protected_objects,

        # ── Errors & performance ───────────────────────────────────────────
        "logical_errors":        logical_errors,
        "bug_report":            bug_report,
        "performance_warnings":  performance_warnings,

        # ── Generators ────────────────────────────────────────────────────
        "test_harness_data":     test_harness_data,
        "mock_stub_data":        mock_stub_data,
    }


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    GNAT_PYTHON = r"C:\GNATSTUDIO\share\gnatstudio\python\python.exe"
    if not LIBADALANG_AVAILABLE and os.path.exists(GNAT_PYTHON) and sys.executable != GNAT_PYTHON:
        import subprocess
        print(f"[INFO] Re-launching with GNAT Python: {GNAT_PYTHON}")
        result = subprocess.run([GNAT_PYTHON] + sys.argv)
        sys.exit(result.returncode)

    try:
        import uvicorn
    except ImportError:
        print("[ERROR] uvicorn not installed.")
        print(f"  Run: {sys.executable} -m pip install uvicorn")
        sys.exit(1)

    print("=" * 60)
    print(f"  Ada Analysis Tool API  v2.0.0")
    print(f"  Python  : {sys.version.split()[0]}  ({sys.executable})")
    print(f"  libadalang: {'available ✓' if LIBADALANG_AVAILABLE else 'NOT FOUND ✗'}")
    if LIBADALANG_AVAILABLE:
        print(f"  Modules : SubprogramIndexer, Parser, CallGraph, DeadCode,")
        print(f"            Complexity, ControlFlow, Loops, Variables, Globals,")
        print(f"            Exceptions, Concurrency, Protected, LogicalErrors,")
        print(f"            BugDetector, Performance, HarnessGen, MockGen")
    else:
        print()
        print("  Install GNAT Studio from:")
        print("  https://github.com/AdaCore/gnatstudio/releases/latest")
    print("=" * 60)
    print()

    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
