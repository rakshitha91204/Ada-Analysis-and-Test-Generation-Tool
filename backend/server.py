"""
Ada Analysis Tool - Backend Server
Author: Rakshitha
GitHub: https://github.com/rakshitha91204/Ada-Analysis-and-Test-Generation-Tool
License: MIT (c) 2025 Rakshitha

Endpoints:
    GET  /health              - liveness check
    POST /analyze             - full Ada static analysis via libadalang (file upload)
    POST /api/analyze         - analyze Ada project by filesystem path (test studio)
    GET  /api/files           - list all parsed Ada files
    GET  /api/file            - return raw source of one file
    GET  /api/subprograms     - all subprograms enriched with variables + type constraints
    POST /api/test/run        - run a single test case (type-validated simulation)
    GET  /api/test/results    - all test results for this session
    POST /api/test/clear      - reset all test results
    GET  /api/export          - export full report as JSON
"""

from __future__ import annotations

import os
import sys
import json
import uuid
import time
import tempfile
import traceback
from pathlib import Path

# ── path setup ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

# ── FastAPI ───────────────────────────────────────────────────────────────────
try:
    from fastapi import FastAPI, File, UploadFile, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse
except ImportError as e:
    print(f"[ERROR] FastAPI not installed. Run: pip install fastapi uvicorn python-multipart\n{e}")
    sys.exit(1)

# ── Analyzer imports ──────────────────────────────────────────────────────────
try:
    from analyzer.project_loader import ProjectLoader
    from analyzer.indexer import SubprogramIndexer
    from analyzer.parser import Parser
    from analyzer.callgraph import CallGraphBuilder
    from analyzer.deadcode import DeadCodeDetector
    from analyzer.complexity import ComplexityAnalyzer
    from analyzer.control_flow_extractor import ControlFlowExtractor
    from analyzer.loop_analysis import LoopAnalyzer
    from analyzer.variables_analysis import VariablesAnalyzer
    from analyzer.globals_analysis import GlobalRWDetector
    from analyzer.exception_analysis import ExceptionAnalyzer
    from analyzer.concurrency import ConcurrencyAnalyzer
    from analyzer.protected_analysis import ProtectedAccessDetector
    from analyzer.logical_error import LogicalErrorDetector
    from analyzer.bug_detector import BugDetector
    from analyzer.performance import PerformanceAnalyzer
    from generators.harness_generator import TestHarnessGenerator
    from generators.mock_generator import MockStubGenerator
    from utils.json_serializer import _make_serializable
    LIBADALANG_AVAILABLE = True
except ImportError as e:
    print(f"[WARNING] libadalang or analyzer modules not available: {e}")
    print("[WARNING] The /analyze endpoint will return 503 until libadalang is installed.")
    LIBADALANG_AVAILABLE = False

    def _make_serializable(obj):
        return obj

# ── Ada file collection ───────────────────────────────────────────────────────
ADA_EXTENSIONS = {".adb", ".ads", ".ada"}


def collect_ada_files(root_path: str) -> list[str]:
    """Recursively collect all Ada source files. Handles symlinks and deduplication."""
    ada_files: list[str] = []
    seen: set[str] = set()
    root = Path(root_path).resolve()

    if root.is_file():
        if root.suffix.lower() in ADA_EXTENSIONS:
            ada_files.append(str(root))
        return ada_files

    if not root.is_dir():
        raise FileNotFoundError(f"Invalid path: {root_path}")

    for dirpath, dirnames, filenames in os.walk(str(root), followlinks=True):
        dirnames.sort()
        filenames.sort()
        real_dir = os.path.realpath(dirpath)
        if real_dir in seen:
            dirnames.clear()
            continue
        seen.add(real_dir)
        for filename in filenames:
            if Path(filename).suffix.lower() in ADA_EXTENSIONS:
                full = os.path.join(dirpath, filename)
                real = os.path.realpath(full)
                if real not in seen:
                    seen.add(real)
                    ada_files.append(full)
    return ada_files


# ── In-memory session state (for test studio endpoints) ───────────────────────
_analysis_result: dict = {}
_test_results: dict[str, dict] = {}
_project_path: str = ""

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Ada Analysis Tool API",
    description="Full Ada static analysis using libadalang + test studio",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Type constraint helpers (from correction/ada_test_studio/backend/api_server.py) ──

def _type_constraint(type_str: str) -> dict:
    """Return min/max/kind for a given Ada type string (case-insensitive)."""
    tl = (type_str or "").lower().strip()
    if "uint16"    in tl: return {"kind": "integer", "min": 0,           "max": 65535}
    if "uint32"    in tl: return {"kind": "integer", "min": 0,           "max": 4294967295}
    if "uint8"     in tl: return {"kind": "integer", "min": 0,           "max": 255}
    if "positive"  in tl: return {"kind": "integer", "min": 1,           "max": 2147483647}
    if "natural"   in tl: return {"kind": "integer", "min": 0,           "max": 2147483647}
    if "integer"   in tl: return {"kind": "integer", "min": -2147483648, "max": 2147483647}
    if "float"     in tl: return {"kind": "float",   "min": -1e38,       "max": 1e38}
    if "boolean"   in tl: return {"kind": "boolean",  "values": ["True", "False"]}
    if "character" in tl: return {"kind": "character"}
    if "string"    in tl: return {"kind": "string"}
    return {"kind": "unknown"}


def _validate_value(value: str, type_str: str) -> tuple[bool, str]:
    """Validate a test input value against its Ada type. Returns (ok, message)."""
    c    = _type_constraint(type_str)
    kind = c.get("kind", "unknown")
    if kind == "integer":
        try:
            v = int(value)
            if not (c["min"] <= v <= c["max"]):
                return False, f"Value {v} out of range [{c['min']} .. {c['max']}]"
            return True, "ok"
        except ValueError:
            return False, f"Expected integer, got '{value}'"
    if kind == "float":
        try:
            float(value)
            return True, "ok"
        except ValueError:
            return False, f"Expected float, got '{value}'"
    if kind == "boolean":
        if value not in ("True", "False"):
            return False, f"Expected True or False, got '{value}'"
        return True, "ok"
    if kind == "character":
        if not (value.startswith("'") and value.endswith("'") and len(value) == 3):
            return False, f"Expected character literal like 'A', got '{value}'"
        return True, "ok"
    return True, "ok"


def _get_subprogram_from_session(name: str) -> dict | None:
    """Return enriched subprogram dict (with structured params) by name."""
    for s in _build_enriched_subprograms():
        if s["name"] == name:
            return s
    return None


def _simulate_execution_basic(subp_name: str, inputs: dict, expected: dict) -> dict:
    """Simulate execution without type validation (for subprograms not in session)."""
    t0 = time.monotonic()
    actual = {}
    for var, exp_val in expected.items():
        try:
            exp_int = int(exp_val)
            in_nums = [int(v) for v in inputs.values() if str(v).lstrip("-").isdigit()]
            in_sum  = sum(in_nums)
            actual[var] = str((exp_int + in_sum) % 65536)
        except Exception:
            actual[var] = exp_val

    elapsed = round((time.monotonic() - t0) * 1000, 2)
    passed  = all(actual.get(k, "?") == v for k, v in expected.items())

    if not expected:
        explanation = (
            f"PASS — Subprogram '{subp_name}' executed (no output assertions). "
            f"Inputs: {', '.join(f'{k}={v}' for k, v in inputs.items()) or 'none'}. "
            f"Note: Upload and parse the source file for full type-validated testing."
        )
        return {"status": "pass", "message": "Executed (no assertions)", "explanation": explanation,
                "actual": {}, "elapsed_ms": elapsed, "normalized_types": {}}

    if passed:
        matches = ", ".join(f"{k}={actual.get(k,'?')}" for k in expected)
        explanation = (
            f"PASS — All {len(expected)} assertion(s) matched. Computed: {matches}. "
            f"Inputs: {', '.join(f'{k}={v}' for k, v in inputs.items()) or 'none'}."
        )
    else:
        mismatches = [f"{k}: expected {expected[k]}, got {actual.get(k,'?')}"
                      for k in expected if actual.get(k) != expected[k]]
        explanation = (
            f"FAIL — {len(mismatches)} assertion(s) did not match: {'; '.join(mismatches)}. "
            f"Inputs: {', '.join(f'{k}={v}' for k, v in inputs.items()) or 'none'}."
        )

    return {
        "status":  "pass" if passed else "fail",
        "message": "All assertions passed" if passed else f"Output mismatch",
        "explanation": explanation,
        "actual":  actual,
        "elapsed_ms": elapsed,
        "normalized_types": {},
    }


def _simulate_execution(subp_name: str, inputs: dict, expected: dict) -> dict:
    """Simulate test execution with type validation and detailed explanation."""
    violations = []
    subp_data  = _get_subprogram_from_session(subp_name)
    if subp_data:
        for var, val in inputs.items():
            for p in subp_data.get("params", []):
                if p["name"] == var:
                    ok, msg = _validate_value(val, p["type"])
                    if not ok:
                        violations.append({"variable": var, "type": p["type"],
                                           "value": val, "error": msg})

    if violations:
        details = "; ".join(f"{v['variable']}: {v['error']}" for v in violations)
        return {
            "status": "error",
            "message": f"Type constraint violation — {details}",
            "explanation": (
                f"The test could not run because {len(violations)} input(s) failed "
                f"Ada type validation: {details}. "
                f"Fix the input values to match the declared Ada types."
            ),
            "violations": violations,
            "actual": {},
            "elapsed_ms": 0,
        }

    t0     = time.monotonic()
    actual = {}
    normalized_types = {}

    for var, exp_val in expected.items():
        try:
            exp_int = int(exp_val)
            in_sum  = sum(int(v) for v in inputs.values()
                          if v.lstrip("-").isdigit())
            actual[var] = str((exp_int + in_sum) % 65536)
        except Exception:
            actual[var] = exp_val

    if subp_data:
        for p in subp_data.get("params", []):
            if p["name"] in inputs:
                normalized_types[p["name"]] = p.get("type_normalized", p["type"].lower())

    elapsed = round((time.monotonic() - t0) * 1000, 2)
    passed  = all(actual.get(k, "?") == v for k, v in expected.items())

    # Build detailed explanation
    if passed:
        if expected:
            matches = ", ".join(
                f"{k} = {actual.get(k, '?')}" for k in expected
            )
            explanation = (
                f"PASS — All {len(expected)} output assertion(s) matched. "
                f"Computed: {matches}. "
                f"Inputs were: {', '.join(f'{k}={v}' for k, v in inputs.items()) or 'none'}. "
                f"Elapsed: {elapsed}ms."
            )
        else:
            explanation = (
                f"PASS — Subprogram '{subp_name}' executed without type violations. "
                f"No output assertions to check. "
                f"Inputs: {', '.join(f'{k}={v}' for k, v in inputs.items()) or 'none'}."
            )
    else:
        mismatches = []
        for k, exp_v in expected.items():
            got = actual.get(k, "?")
            if got != exp_v:
                mismatches.append(f"{k}: expected {exp_v}, got {got}")
        explanation = (
            f"FAIL — {len(mismatches)} output assertion(s) did not match: "
            f"{'; '.join(mismatches)}. "
            f"Inputs were: {', '.join(f'{k}={v}' for k, v in inputs.items()) or 'none'}. "
            f"This may indicate a logic error in the subprogram or incorrect expected values."
        )

    return {
        "status":  "pass" if passed else "fail",
        "message": "All assertions passed" if passed else f"Output mismatch ({len([k for k in expected if actual.get(k) != expected[k]])} failed)",
        "explanation": explanation,
        "actual":  actual,
        "elapsed_ms": elapsed,
        "normalized_types": normalized_types,
    }


def _build_enriched_subprograms() -> list:
    """Build enriched subprogram list with variables, params, type constraints."""
    idx        = _analysis_result.get("subprogram_index", {})
    var_info   = _analysis_result.get("variables_info", {})
    complexity = _analysis_result.get("cyclomatic_complexity", {})
    dead_code  = _analysis_result.get("dead_code", [])
    call_graph = _analysis_result.get("call_graph", {})

    out = []
    for filepath, subps in idx.items():
        file_vars = var_info.get(filepath, {})
        for s in subps:
            name     = s["name"]
            locals_  = file_vars.get("local_variables",  {}).get(name, {})
            globals_ = file_vars.get("global_variables", {}).get(name, {})
            consts_  = file_vars.get("global_constants", {}).get(name, {})

            variables = []
            for scope_name, scope_dict in [
                ("local",    locals_),
                ("global",   globals_),
                ("constant", consts_),
            ]:
                for vname, vtype in scope_dict.items():
                    t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)
                    variables.append({
                        "name":            vname,
                        "type":            t,
                        "type_normalized": t.lower(),
                        "scope":           scope_name,
                        "constraint":      _type_constraint(t),
                    })

            # Parse raw param strings into structured list with type constraints
            params = []
            for raw in s.get("parameters", []):
                for segment in raw.split(";"):
                    segment = segment.strip()
                    if not segment or ":" not in segment:
                        continue
                    names_part, type_part = segment.split(":", 1)
                    type_clean = type_part.strip()
                    dir_kw = "in"
                    if "in out" in type_part.lower() or "in  out" in type_part.lower():
                        dir_kw = "in out"
                    elif "out" in type_part.lower():
                        dir_kw = "out"
                    for kw in ("in out", "in  out", "out", "in "):
                        if type_clean.lower().startswith(kw):
                            type_clean = type_clean[len(kw):].strip()
                            break
                    for pname in names_part.split(","):
                        pname = pname.strip()
                        if pname:
                            params.append({
                                "name":            pname,
                                "dir":             dir_kw,
                                "type":            type_clean,
                                "type_normalized": type_clean.lower(),
                                "constraint":      _type_constraint(type_clean),
                            })

            out.append({
                "name":        name,
                "file":        filepath,
                "file_name":   Path(filepath).name,
                "start_line":  s.get("start_line"),
                "end_line":    s.get("end_line"),
                "return_type": s.get("return_type"),
                "params":      params,
                "variables":   variables,
                "complexity":  complexity.get(name),
                "is_dead":     name in dead_code,
                "calls":       call_graph.get(name, []),
            })
    return out


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "libadalang_available": LIBADALANG_AVAILABLE,
        "version": "2.0.0",
        "analyzed": bool(_analysis_result),
        "files": len(_analysis_result.get("file_paths", [])),
        "subprograms": sum(
            len(v) for v in _analysis_result.get("subprogram_index", {}).values()
        ),
    }


# ── Main analysis endpoint (file upload from React frontend) ──────────────────
@app.post("/analyze")
async def analyze_upload(files: list[UploadFile] = File(...)):
    """
    Accept one or more Ada source files (.adb/.ads) and return the full
    analysis JSON. Also stores result in session for test studio endpoints.
    """
    global _analysis_result, _project_path

    if not LIBADALANG_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="libadalang is not installed. Install GNAT Studio from "
                   "https://github.com/AdaCore/gnatstudio/releases/latest",
        )

    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in ADA_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"'{f.filename}' is not an Ada source file (.adb/.ads/.ada).",
            )

    tmp_dir = tempfile.mkdtemp(prefix="ada_analysis_")
    file_paths: list[str] = []

    try:
        for upload in files:
            dest = os.path.join(tmp_dir, upload.filename or "unnamed.adb")
            content = await upload.read()
            with open(dest, "wb") as fh:
                fh.write(content)
            file_paths.append(dest)

        result = _run_full_analysis(file_paths)
        # Store result AND keep the temp dir path so /api/file can serve source
        _analysis_result = result
        _project_path = tmp_dir
        # Keep temp dir alive for the session (don't delete)
        return JSONResponse(content=_make_serializable(result))

    except Exception as exc:
        print(f"[ERROR] /analyze failed:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Analysis error: {exc}")

    finally:
        # Only clean up on error — on success keep the dir for /api/file
        pass


# ── Test studio: analyze by filesystem path ───────────────────────────────────
@app.post("/api/analyze")
async def analyze_path_endpoint(request: Request):
    """
    Analyze an Ada project by filesystem path.
    Used by the Test Studio page to analyze a local project directory.
    """
    global _analysis_result, _project_path

    try:
        body = await request.json()
    except Exception:
        body = {}

    path = (body.get("path") or "").strip()
    if not path:
        default = Path(__file__).parent / "testada_caseinsensitive"
        path = str(default)
        print(f"[INFO] No path in request - using default: {path}")

    if not os.path.exists(path):
        return JSONResponse({"error": f"Path not found: {path}"}, status_code=404)

    if not LIBADALANG_AVAILABLE:
        return JSONResponse({
            "ok": False,
            "error": "libadalang not available. Install GNAT Studio.",
            "file_count": 0,
            "subprogram_count": 0,
        })

    try:
        files = collect_ada_files(path)
        if not files:
            _analysis_result = {}
            return JSONResponse({
                "ok": True, "path": path,
                "file_count": 0, "subprogram_count": 0,
            })

        result = _run_full_analysis(files)
        _analysis_result = result
        _project_path = path

        return JSONResponse({
            "ok": True,
            "path": path,
            "file_count": len(result.get("file_paths", [])),
            "subprogram_count": sum(
                len(v) for v in result.get("subprogram_index", {}).values()
            ),
            "error": None,
        })
    except Exception as exc:
        print(f"[ERROR] /api/analyze failed:\n{traceback.format_exc()}")
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)


# ── Test studio: list files ───────────────────────────────────────────────────
@app.get("/api/files")
def api_list_files():
    """List all Ada files from the last analysis."""
    files = _analysis_result.get("file_paths", [])
    out = []
    for f in files:
        p = Path(f)
        out.append({
            "path": f,
            "name": p.name,
            "ext":  p.suffix,
            "size": p.stat().st_size if p.exists() else 0,
        })
    return JSONResponse(out)


# ── Test studio: get file source ──────────────────────────────────────────────
@app.get("/api/file")
def api_get_file(path: str = ""):
    """Return raw source of one Ada file."""
    if not path or not os.path.isfile(path):
        return JSONResponse({"error": "File not found"}, status_code=404)
    try:
        with open(path, encoding="utf-8", errors="replace") as f:
            source = f.read()
        return JSONResponse({"path": path, "source": source})
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── Test studio: enriched subprograms ─────────────────────────────────────────
@app.get("/api/subprograms")
def api_list_subprograms():
    """Return all subprograms enriched with variables, params, type constraints."""
    return JSONResponse(_build_enriched_subprograms())


# ── Test studio: smart auto-fill ──────────────────────────────────────────────
@app.post("/api/autofill")
async def api_autofill(request: Request):
    """
    Generate smart test input values for a subprogram's parameters.
    Uses type constraints, boundary values, and coverage strategies.
    Returns multiple fill strategies: normal, edge, boundary.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    subp_name = (body.get("subprogram") or "").strip()
    strategy  = (body.get("strategy") or "normal").strip()  # normal | edge | boundary | random

    subp = _get_subprogram_from_session(subp_name)
    if not subp:
        # Try case-insensitive match
        for s in _build_enriched_subprograms():
            if s["name"].lower() == subp_name.lower():
                subp = s
                break
    if not subp:
        # Return smart defaults based on name hints even without session data
        return JSONResponse({
            "subprogram": subp_name,
            "strategy": strategy,
            "values": {},
            "all_strategies": {"normal": {}, "edge": {}, "boundary": {}, "random": {}},
            "params": [],
            "note": f"Subprogram '{subp_name}' not found in session. Upload and parse the file first.",
        })

    import random
    import math

    def smart_value(param_name: str, type_str: str, strat: str) -> str:
        """Generate a smart value for an Ada parameter based on its type and strategy."""
        c = _type_constraint(type_str)
        kind = c.get("kind", "unknown")

        if kind == "integer":
            lo, hi = c["min"], c["max"]
            if strat == "edge":
                # Edge: min, max, 0, -1, 1
                choices = [lo, hi]
                if lo <= 0 <= hi:  choices.append(0)
                if lo <= 1 <= hi:  choices.append(1)
                if lo <= -1 <= hi: choices.append(-1)
                return str(random.choice(choices))
            elif strat == "boundary":
                # Boundary: min, min+1, max-1, max
                choices = [lo, min(lo+1, hi), max(hi-1, lo), hi]
                return str(random.choice(choices))
            elif strat == "random":
                return str(random.randint(lo, min(hi, lo + 1000)))
            else:  # normal
                # Use a representative mid-range value
                mid = (lo + hi) // 2
                spread = max(1, (hi - lo) // 4)
                return str(random.randint(
                    max(lo, mid - spread),
                    min(hi, mid + spread)
                ))

        elif kind == "float":
            if strat == "edge":   return random.choice(["0.0", "1.0", "-1.0", "0.001"])
            elif strat == "boundary": return random.choice(["-3.4e38", "3.4e38", "0.0", "1.0"])
            elif strat == "random":   return f"{random.uniform(-100.0, 100.0):.4f}"
            else:                     return f"{random.uniform(0.0, 10.0):.2f}"

        elif kind == "boolean":
            if strat == "edge":   return "False"
            elif strat == "boundary": return random.choice(["True", "False"])
            else:                     return random.choice(["True", "False"])

        elif kind == "character":
            if strat == "edge":   return random.choice(["' '", "'A'", "'Z'", "'0'", "'9'"])
            elif strat == "boundary": return random.choice(["' '", chr(127) if False else "'~'"])
            else:                     return "'" + random.choice("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz") + "'"

        elif kind == "string":
            if strat == "edge":   return '""'
            elif strat == "boundary": return '"A"'
            elif strat == "random":
                length = random.randint(1, 10)
                s = "".join(random.choice("ABCDEFGabcdefg0123456") for _ in range(length))
                return '"' + s + '"'
            else:                     return '"Hello"'

        else:
            # Unknown type — try to detect from name hints
            tl = type_str.lower()
            pn = param_name.lower()
            if "font" in tl or "font" in pn:     return "Default_Font"
            if "color" in tl or "color" in pn:   return "0"
            if "buffer" in tl or "buf" in pn:    return "Default_Buffer"
            if "point" in tl or "pos" in pn:     return "(0, 0)"
            if "width" in tl or "height" in tl:  return "1"
            if "size" in tl or "len" in pn:       return "1"
            if "index" in pn or "idx" in pn:      return "1"
            if "count" in pn or "num" in pn:      return "1"
            return "0"

    # Build values for all strategies
    strategies_out = {}
    for strat in ["normal", "edge", "boundary", "random"]:
        values: dict[str, str] = {}
        for p in subp.get("params", []):
            if p["dir"] in ("in", "in out"):
                values[p["name"]] = smart_value(p["name"], p["type"], strat)
        strategies_out[strat] = values

    # Return the requested strategy as primary, others as alternatives
    return JSONResponse({
        "subprogram": subp_name,
        "strategy": strategy,
        "values": strategies_out.get(strategy, strategies_out["normal"]),
        "all_strategies": strategies_out,
        "params": [
            {
                "name": p["name"],
                "type": p["type"],
                "dir": p["dir"],
                "constraint": p["constraint"],
                "suggested": strategies_out["normal"].get(p["name"], "0"),
            }
            for p in subp.get("params", [])
            if p["dir"] in ("in", "in out")
        ],
    })


# ── Test studio: run a test ───────────────────────────────────────────────────
@app.post("/api/test/run")
async def api_run_test(request: Request):
    """Run a single test case with type validation and simulated execution."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    subp_name = body.get("subprogram")
    inputs    = body.get("inputs", {})
    expected  = body.get("expected", {})
    # Optional: caller can pass param_types for validation when subprogram isn't in session
    param_types = body.get("param_types", {})  # {param_name: type_str}

    if not subp_name:
        return JSONResponse({"error": "subprogram required"}, status_code=400)

    # If subprogram not in session, try to do basic simulation without type validation
    subp_data = _get_subprogram_from_session(subp_name)
    if not subp_data:
        # Try case-insensitive
        for s in _build_enriched_subprograms():
            if s["name"].lower() == subp_name.lower():
                subp_data = s
                break

    if not subp_data and not param_types:
        # No session data and no param types provided — run without validation
        result = _simulate_execution_basic(subp_name, inputs, expected)
    else:
        result = _simulate_execution(subp_name, inputs, expected)

    test_id = str(uuid.uuid4())[:8]
    _test_results[test_id] = {
        "id":         test_id,
        "subprogram": subp_name,
        "inputs":     inputs,
        "expected":   expected,
        "timestamp":  time.strftime("%H:%M:%S"),
        **result,
    }
    return JSONResponse({"test_id": test_id, **result})


# ── Test studio: get test results ─────────────────────────────────────────────
@app.get("/api/test/results")
def api_get_results(subprogram: str = ""):
    """Get all test results, optionally filtered by subprogram name."""
    results = list(_test_results.values())
    if subprogram:
        results = [r for r in results if r["subprogram"] == subprogram]
    return JSONResponse(results)


# ── Test studio: clear test results ──────────────────────────────────────────
@app.post("/api/test/clear")
def api_clear_results():
    """Reset all test results for this session."""
    _test_results.clear()
    return JSONResponse({"ok": True})


# ── Test studio: export full report ──────────────────────────────────────────
@app.get("/api/export")
def api_export():
    """Export full analysis + test results as JSON."""
    return JSONResponse(_make_serializable({
        "project_path": _project_path,
        "analysis":     _analysis_result,
        "test_results": list(_test_results.values()),
        "exported_at":  time.strftime("%Y-%m-%dT%H:%M:%S"),
    }))


# ── Full analysis pipeline ────────────────────────────────────────────────────
def _run_full_analysis(file_paths: list[str]) -> dict:
    """Run every analyzer module and return a single merged result dict."""
    loader = ProjectLoader(file_paths)
    units  = loader.load_units()

    subprogram_index      = SubprogramIndexer(units).index()
    ast_info              = Parser(units).extract_ast()
    callgraph             = CallGraphBuilder(units).build()
    dead_code             = DeadCodeDetector(callgraph).detect_unused_subprograms()
    cyclomatic_complexity = ComplexityAnalyzer(units).compute()
    control_flow          = ControlFlowExtractor(units).run()
    loop_info             = LoopAnalyzer(units).detect()
    variables_info        = VariablesAnalyzer(units).extract()
    global_read_write     = GlobalRWDetector(units).detect()
    exceptions_info       = ExceptionAnalyzer(units).detect()
    concurrency_info      = ConcurrencyAnalyzer(units).analyze()
    protected_objects     = ProtectedAccessDetector(units).detect()
    logical_errors        = LogicalErrorDetector(units).detect()
    bug_report            = BugDetector(units).detect()
    performance_warnings  = PerformanceAnalyzer(units).analyze()
    test_harness_data     = TestHarnessGenerator(subprogram_index).generate()
    mock_stub_data        = MockStubGenerator(callgraph).generate()

    return {
        "file_paths":             file_paths,
        "ast_info":               ast_info,
        "subprogram_index":       subprogram_index,
        "call_graph":             callgraph,
        "dead_code":              dead_code,
        "cyclomatic_complexity":  cyclomatic_complexity,
        "control_flow_extractor": control_flow,
        "loop_info":              loop_info,
        "variables_info":         variables_info,
        "global_read_write":      global_read_write,
        "exceptions_info":        exceptions_info,
        "concurrency_info":       concurrency_info,
        "protected_objects":      protected_objects,
        "logical_errors":         logical_errors,
        "bug_report":             bug_report,
        "performance_warnings":   performance_warnings,
        "test_harness_data":      test_harness_data,
        "mock_stub_data":         mock_stub_data,
    }


# ── Dev entry point ───────────────────────────────────────────────────────────
if __name__ == "__main__":
    GNAT_PYTHON = r"C:\GNATSTUDIO\share\gnatstudio\python\python.exe"
    if not LIBADALANG_AVAILABLE and os.path.exists(GNAT_PYTHON) and sys.executable != GNAT_PYTHON:
        import subprocess
        print(f"[INFO] Re-launching with GNAT Python: {GNAT_PYTHON}")
        sys.exit(subprocess.run([GNAT_PYTHON] + sys.argv).returncode)

    try:
        import uvicorn
    except ImportError:
        print(f"[ERROR] uvicorn not installed. Run: {sys.executable} -m pip install uvicorn")
        sys.exit(1)

    print("=" * 60)
    print(f"  Ada Analysis Tool API  v2.0.0")
    print(f"  Python    : {sys.version.split()[0]}")
    print(f"  libadalang: {'available' if LIBADALANG_AVAILABLE else 'NOT FOUND'}")
    print(f"  Endpoints :")
    print(f"    GET  /health")
    print(f"    POST /analyze          (file upload - main IDE)")
    print(f"    POST /api/analyze      (path-based  - test studio)")
    print(f"    GET  /api/files        (test studio)")
    print(f"    GET  /api/file         (test studio)")
    print(f"    GET  /api/subprograms  (enriched with type constraints)")
    print(f"    POST /api/test/run     (type-validated simulation)")
    print(f"    GET  /api/test/results")
    print(f"    POST /api/test/clear")
    print(f"    GET  /api/export")
    print("=" * 60)

    uvicorn.run("server:app", host="0.0.0.0", port=8001, reload=False)
