"""
server.py — FastAPI backend for the Ada Analysis Tool
======================================================
Exposes a single endpoint:

    POST /analyze
        Accepts multipart form-data with one or more Ada source files.
        Returns the full analysis JSON matching the AdaAnalysisResult schema
        used by the React frontend.

Run with:
    cd ADA-Test-master/test/auto_ada_tester
    uvicorn server:app --reload --port 8000

Or:
    python server.py
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
    from analyzer.project_loader import ProjectLoader
    from analyzer.indexer import SubprogramIndexer
    from analyzer.callgraph import CallGraphBuilder
    from analyzer.globals_analysis import GlobalRWDetector
    from analyzer.complexity import ComplexityAnalyzer
    from analyzer.deadcode import DeadCodeDetector
    from analyzer.variables_analysis import VariablesAnalyzer
    from analyzer.control_flow_extractor import ControlFlowExtractor
    from analyzer.loop_analysis import LoopAnalyzer
    from analyzer.exception_analysis import ExceptionAnalyzer
    from analyzer.concurrency import ConcurrencyAnalyzer
    from analyzer.logical_error import LogicalErrorDetector
    from analyzer.performance import PerformanceAnalyzer
    from generators.harness_generator import TestHarnessGenerator
    from generators.mock_generator import MockStubGenerator
    LIBADALANG_AVAILABLE = True
except ImportError as e:
    print(f"[WARNING] libadalang or analyzer modules not available: {e}")
    print("[WARNING] The /analyze endpoint will return an error until libadalang is installed.")
    LIBADALANG_AVAILABLE = False

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ada Analysis Tool API",
    description="Backend API for Ada static analysis using libadalang",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
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
    }


# ── Main analysis endpoint ────────────────────────────────────────────────────
@app.post("/analyze")
async def analyze(files: list[UploadFile] = File(...)):
    """
    Accept one or more Ada source files (.adb / .ads) and return the full
    analysis result as JSON.

    The response shape matches AdaAnalysisResult in the frontend:
    {
        file_paths, subprogram_index, call_graph, global_read_write,
        cyclomatic_complexity, dead_code, variables_info,
        control_flow_extractor, loop_info, exceptions_info,
        concurrency_info, logical_errors, performance_warnings,
        test_harness_data, mock_stub_data
    }
    """
    if not LIBADALANG_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail=(
                "libadalang is not installed on this server. "
                "Install it via the GNAT toolchain or pip install libadalang."
            ),
        )

    # Validate file extensions
    ada_extensions = {".adb", ".ads", ".ada"}
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ada_extensions:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' is not an Ada source file (.adb/.ads/.ada).",
            )

    # Write uploaded files to a temporary directory
    tmp_dir = tempfile.mkdtemp(prefix="ada_analysis_")
    file_paths: list[str] = []

    try:
        for upload in files:
            dest = os.path.join(tmp_dir, upload.filename or "unnamed.adb")
            content = await upload.read()
            with open(dest, "wb") as fh:
                fh.write(content)
            file_paths.append(dest)

        # Run the analysis pipeline
        result = _run_analysis(file_paths)
        return JSONResponse(content=result)

    except Exception as exc:
        tb = traceback.format_exc()
        print(f"[ERROR] Analysis failed:\n{tb}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {exc}")

    finally:
        # Clean up temp files
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)


def _run_analysis(file_paths: list[str]) -> dict:
    """Run the full analysis pipeline and return a serialisable dict."""
    loader = ProjectLoader(file_paths)
    units = loader.load_units()

    subprograms = SubprogramIndexer(units).index()
    callgraph = CallGraphBuilder(units).build()
    globals_rw = GlobalRWDetector(units).detect()
    complexity = ComplexityAnalyzer(units).compute()
    deadcode = DeadCodeDetector(callgraph).detect_unused_subprograms()
    variables_info = VariablesAnalyzer(units).extract()
    control_flow = ControlFlowExtractor(units).run()
    loops_info = LoopAnalyzer(units).detect()
    exceptions_info = ExceptionAnalyzer(units).detect()
    concurrency_info = ConcurrencyAnalyzer(units).analyze()
    logical_errors = LogicalErrorDetector(units).detect()
    performance_warnings = PerformanceAnalyzer(units).analyze()
    test_harness_data = TestHarnessGenerator(subprograms).generate()
    mock_stub_data = MockStubGenerator(callgraph).generate()

    return {
        "file_paths": file_paths,
        "subprogram_index": subprograms,
        "call_graph": callgraph,
        "global_read_write": globals_rw,
        "cyclomatic_complexity": complexity,
        "dead_code": deadcode,
        "variables_info": variables_info,
        "control_flow_extractor": control_flow,
        "loop_info": loops_info,
        "exceptions_info": exceptions_info,
        "concurrency_info": concurrency_info,
        "logical_errors": logical_errors,
        "performance_warnings": performance_warnings,
        "test_harness_data": test_harness_data,
        "mock_stub_data": mock_stub_data,
    }


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    # If running with the wrong Python (no libadalang), re-launch with GNAT Python
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
    print(f"  Ada Analysis Tool API")
    print(f"  Python: {sys.version.split()[0]}  ({sys.executable})")
    print(f"  libadalang: {'available ✓' if LIBADALANG_AVAILABLE else 'NOT FOUND ✗'}")
    if not LIBADALANG_AVAILABLE:
        print()
        print("  To enable full analysis, install GNAT Studio from:")
        print("  https://github.com/AdaCore/gnatstudio/releases/latest")
        print("  Then run this server using the GNAT Python, e.g.:")
        print("  C:\\GNAT\\2026\\bin\\python3.exe server.py")
    print("=" * 60)
    print()

    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)

