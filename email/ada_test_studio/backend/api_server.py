"""
Ada Test Studio — Flask API backend (fixed)
"""



# import sys
# from pathlib import Path

# ROOT = Path(__file__).resolve().parents[2]

# if str(ROOT) not in sys.path:
#     sys.path.insert(0, str(ROOT))

# AUTO_TESTER = ROOT / "testss" / "auto_ada_tester"

# if str(AUTO_TESTER) not in sys.path:
#     sys.path.insert(0, str(AUTO_TESTER))

# from testss.auto_ada_tester.runner import (
#     collect_ada_files,
#     VariablesAnalyzer
# )

# from flask import Flask, jsonify, request, abort
# from flask_cors import CORS
# from testss.auto_ada_tester.analyzer.project_loader import ProjectLoader
# from testss.auto_ada_tester.analyzer.indexer import SubprogramIndexer
# from testss.auto_ada_tester.analyzer.callgraph import CallGraphBuilder
# from testss.auto_ada_tester.analyzer.globals_analysis import GlobalRWDetector
# from testss.auto_ada_tester.analyzer.complexity import ComplexityAnalyzer
# from testss.auto_ada_tester.analyzer.deadcode import DeadCodeDetector
# from testss.auto_ada_tester.analyzer.control_flow_extractor import ControlFlowExtractor
# from testss.auto_ada_tester.output_writer import OutputWriter



# app = Flask(__name__)
# CORS(app)

# # ── In-memory session state ────────────────────────────────────────────────
# _analysis_result: dict = {}
# _test_results: dict[str, dict] = {}
# _project_path: str = ""


# # ── Type constraint helpers ────────────────────────────────────────────────

# def _type_constraint(type_str: str) -> dict:
#     tl = (type_str or "").lower().strip()
#     if "uint16"   in tl: return {"kind": "integer", "min": 0,           "max": 65535}
#     if "uint32"   in tl: return {"kind": "integer", "min": 0,           "max": 4294967295}
#     if "uint8"    in tl: return {"kind": "integer", "min": 0,           "max": 255}
#     if "positive" in tl: return {"kind": "integer", "min": 1,           "max": 2147483647}
#     if "natural"  in tl: return {"kind": "integer", "min": 0,           "max": 2147483647}
#     if "integer"  in tl: return {"kind": "integer", "min": -2147483648, "max": 2147483647}
#     if "float"    in tl: return {"kind": "float",   "min": -1e38,       "max": 1e38}
#     if "boolean"  in tl: return {"kind": "boolean",  "values": ["True", "False"]}
#     if "character"in tl: return {"kind": "character"}
#     if "string"   in tl: return {"kind": "string"}
#     return {"kind": "unknown"}


# def _validate_value(value: str, type_str: str) -> tuple[bool, str]:
#     c    = _type_constraint(type_str)
#     kind = c.get("kind", "unknown")
#     if kind == "integer":
#         try:
#             v = int(value)
#             if not (c["min"] <= v <= c["max"]):
#                 return False, f"Value {v} out of range [{c['min']} .. {c['max']}]"
#             return True, "ok"
#         except ValueError:
#             return False, f"Expected integer, got '{value}'"
#     if kind == "float":
#         try:
#             float(value); return True, "ok"
#         except ValueError:
#             return False, f"Expected float, got '{value}'"
#     if kind == "boolean":
#         if value not in ("True", "False"):
#             return False, f"Expected True or False, got '{value}'"
#         return True, "ok"
#     if kind == "character":
#         if not (value.startswith("'") and value.endswith("'") and len(value) == 3):
#             return False, f"Expected character literal like 'A', got '{value}'"
#         return True, "ok"
#     return True, "ok"


# def _get_subprogram(name: str) -> dict | None:
#     for fdata in _analysis_result.get("subprogram_index", {}).values():
#         for s in fdata:
#             if s["name"] == name:
#                 return s
#     return None


# def _simulate_execution(subp_name: str, inputs: dict, expected: dict) -> dict:
#     violations = []
#     subp_data  = _get_subprogram(subp_name)
#     if subp_data:
#         for var, val in inputs.items():
#             for p in subp_data.get("params", []):
#                 if p["name"] == var:
#                     ok, msg = _validate_value(val, p["type"])
#                     if not ok:
#                         violations.append({"variable": var, "type": p["type"],
#                                            "value": val, "error": msg})

#     if violations:
#         return {"status": "error", "message": "Type constraint violation",
#                 "violations": violations, "actual": {}, "elapsed_ms": 0}

#     t0     = time.monotonic()
#     actual = {}
#     for var, exp_val in expected.items():
#         try:
#             exp_int = int(exp_val)
#             in_sum  = sum(int(v) for v in inputs.values()
#                           if v.lstrip("-").isdigit())
#             actual[var] = str((exp_int + in_sum) % 65536)
#         except Exception:
#             actual[var] = exp_val

#     elapsed = round((time.monotonic() - t0) * 1000, 2)
#     passed  = all(actual.get(k, "?") == v for k, v in expected.items())

#     return {
#         "status":  "pass" if passed else "fail",
#         "message": "All assertions passed" if passed else "Output mismatch",
#         "actual":  actual,
#         "elapsed_ms": elapsed,
#         "normalized_types": {
#             var: next(
#                 (p["type"].lower()
#                  for p in (_get_subprogram(subp_name) or {}).get("params", [])
#                  if p["name"] == var),
#                 "unknown"
#             )
#             for var in inputs
#         },
#     }


# # ── Analysis trigger ───────────────────────────────────────────────────────

# def _run_analysis(project_path: str) -> dict:
#     """
#     BUG FIX 3 (the main one — why nothing was generated):

#     Your original had THREE fatal problems inside this function:

#     A) `project_path` was immediately overwritten:
#            project_path = Path(__file__).parent / "testada_caseinsensitive"
#        So whatever path the user typed in the UI was silently ignored.
#        The hardcoded path was then passed to collect_ada_files instead.

#     B) DeadCodeDetector was called with `...` (literal Ellipsis):
#            DeadCodeDetector(...).detect_unused_subprograms()
#        This crashes with TypeError at runtime — Ellipsis is not a valid argument.
#        It needs the callgraph that was just built.

#     C) Dead code after return: the stub JSON-load block and the fallback
#        skeleton were AFTER the return statement, so they never ran even
#        if the real pipeline failed. This meant any crash gave no fallback.

#     All three are fixed below.
#     """
#     global _analysis_result, _project_path
#     _project_path = project_path  # keep what the user actually passed

#     print(f"[INFO] Running analysis on: {project_path}")

#     try:
#         # ── Step 1: collect files ─────────────────────────────────────────
#         files = collect_ada_files(project_path)
#         if not files:
#             print(f"[WARN] No Ada files found in {project_path}")
#             _analysis_result = _empty_skeleton(files)
#             return _analysis_result

#         print(f"[INFO] Found {len(files)} Ada file(s)")

#         # ── Step 2: load units ────────────────────────────────────────────
#         loader = ProjectLoader(files)
#         units  = loader.load_units()

#         if not units:
#             print(f"[WARN] No units loaded — check file syntax")
#             _analysis_result = _empty_skeleton(files)
#             return _analysis_result

#         # ── Step 3: run all analyzers ─────────────────────────────────────
#         subprograms = SubprogramIndexer(units).index()
#         callgraph   = CallGraphBuilder(units).build()
#         globals_rw  = GlobalRWDetector(units).detect()
#         complexity  = ComplexityAnalyzer(units).compute()

#         # BUG FIX B: pass callgraph, not Ellipsis
#         deadcode    = DeadCodeDetector(callgraph).detect_unused_subprograms()

#         variables_info       = VariablesAnalyzer(units).extract()
#         control_flow         = ControlFlowExtractor(units).run()

#         _analysis_result = {
#             "file_paths":            files,
#             "subprogram_index":      subprograms,
#             "call_graph":            callgraph,
#             "global_read_write":     globals_rw,
#             "cyclomatic_complexity": complexity,
#             "dead_code":             deadcode,
#             "variables_info":        variables_info,
#             "control_flow_extractor": control_flow,
#         }

#         print(f"[INFO] Analysis complete — "
#               f"{sum(len(v) for v in subprograms.values())} subprograms found")

#         # ── Step 4: also save JSON report next to the source ─────────────
#         report_path = Path(project_path) / "variables_report.json"
#         try:
#             with open(report_path, "w") as f:
#                 json.dump(_analysis_result, f, indent=2, default=str)
#             print(f"[INFO] Report saved → {report_path}")
#         except Exception as e:
#             print(f"[WARN] Could not save report: {e}")

#         return _analysis_result

#     except Exception as e:
#         # BUG FIX C: catch any crash so the API always returns something
#         print(f"[ERROR] Analysis failed: {e}")
#         import traceback; traceback.print_exc()
#         _analysis_result = _empty_skeleton([])
#         _analysis_result["_error"] = str(e)
#         return _analysis_result


# def _empty_skeleton(files: list) -> dict:
#     return {
#         "file_paths": files,
#         "subprogram_index": {},
#         "call_graph": {},
#         "global_read_write": {},
#         "cyclomatic_complexity": {},
#         "dead_code": [],
#         "variables_info": {},
#         "control_flow_extractor": {},
#     }


# # ── Routes ────────────────────────────────────────────────────────────────

# @app.route("/api/analyze", methods=["POST"])
# def analyze():
#     body = request.get_json(silent=True) or {}

#     # BUG FIX 4: accept path from body OR fall back to the hardcoded test path
#     # so you can test from both the UI and curl without changing code
#     path = body.get("path", "").strip()
#     if not path:
#         # default to the testada_caseinsensitive folder next to this file
#         path = str(Path(__file__).parent / "testada_caseinsensitive")
#         print(f"[INFO] No path in request — using default: {path}")

#     if not os.path.exists(path):
#         return jsonify({"error": f"Path not found: {path}"}), 404

#     result = _run_analysis(path)
#     return jsonify({
#         "ok":               True,
#         "path":             path,
#         "file_count":       len(result.get("file_paths", [])),
#         "subprogram_count": sum(len(v) for v in result.get("subprogram_index", {}).values()),
#         "error":            result.get("_error"),
#     })


# @app.route("/api/files", methods=["GET"])
# def list_files():
#     files = _analysis_result.get("file_paths", [])
#     out   = []
#     for f in files:
#         p = Path(f)
#         out.append({
#             "path": f,
#             "name": p.name,
#             "ext":  p.suffix,
#             "size": p.stat().st_size if p.exists() else 0,
#         })
#     return jsonify(out)


# @app.route("/api/file", methods=["GET"])
# def get_file():
#     path = request.args.get("path", "")
#     if not path or not os.path.isfile(path):
#         return jsonify({"error": "File not found"}), 404
#     with open(path, encoding="utf-8", errors="replace") as f:
#         source = f.read()
#     return jsonify({"path": path, "source": source})


# @app.route("/api/subprograms", methods=["GET"])
# def list_subprograms():
#     idx        = _analysis_result.get("subprogram_index", {})
#     var_info   = _analysis_result.get("variables_info", {})
#     complexity = _analysis_result.get("cyclomatic_complexity", {})
#     dead_code  = _analysis_result.get("dead_code", [])
#     call_graph = _analysis_result.get("call_graph", {})

#     out = []
#     for filepath, subps in idx.items():
#         file_vars = var_info.get(filepath, {})
#         for s in subps:
#             name     = s["name"]
#             locals_  = file_vars.get("local_variables",  {}).get(name, {})
#             globals_ = file_vars.get("global_variables", {}).get(name, {})
#             consts_  = file_vars.get("global_constants", {}).get(name, {})

#             variables = []
#             for scope_name, scope_dict in [
#                 ("local",    locals_),
#                 ("global",   globals_),
#                 ("constant", consts_),
#             ]:
#                 for vname, vtype in scope_dict.items():
#                     t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)
#                     variables.append({
#                         "name":            vname,
#                         "type":            t,
#                         "type_normalized": t.lower(),
#                         "scope":           scope_name,
#                         "constraint":      _type_constraint(t),
#                     })

#             # parse raw param strings into structured list
#             params = []
#             for raw in s.get("parameters", []):
#                 for segment in raw.split(";"):
#                     segment = segment.strip()
#                     if not segment or ":" not in segment:
#                         continue
#                     names_part, type_part = segment.split(":", 1)
#                     type_clean = type_part.strip()
#                     dir_kw = "in"
#                     if "in out" in type_part.lower() or "in  out" in type_part.lower():
#                         dir_kw = "in out"
#                     elif "out" in type_part.lower():
#                         dir_kw = "out"
#                     for kw in ("in out", "in  out", "out", "in "):
#                         if type_clean.lower().startswith(kw):
#                             type_clean = type_clean[len(kw):].strip()
#                             break
#                     for pname in names_part.split(","):
#                         pname = pname.strip()
#                         if pname:
#                             params.append({
#                                 "name":            pname,
#                                 "dir":             dir_kw,
#                                 "type":            type_clean,
#                                 "type_normalized": type_clean.lower(),
#                                 "constraint":      _type_constraint(type_clean),
#                             })

#             out.append({
#                 "name":        name,
#                 "file":        filepath,
#                 "file_name":   Path(filepath).name,
#                 "start_line":  s.get("start_line"),
#                 "end_line":    s.get("end_line"),
#                 "return_type": s.get("return_type"),
#                 "params":      params,
#                 "variables":   variables,
#                 "complexity":  complexity.get(name),
#                 "is_dead":     name in dead_code,
#                 "calls":       call_graph.get(name, []),
#             })

#     return jsonify(out)


# @app.route("/api/test/run", methods=["POST"])
# def run_test():
#     body      = request.get_json(silent=True) or {}
#     subp_name = body.get("subprogram")
#     inputs    = body.get("inputs", {})
#     expected  = body.get("expected", {})
#     if not subp_name:
#         return jsonify({"error": "subprogram required"}), 400
#     result  = _simulate_execution(subp_name, inputs, expected)
#     test_id = str(uuid.uuid4())[:8]
#     _test_results[test_id] = {
#         "id": test_id, "subprogram": subp_name,
#         "inputs": inputs, "expected": expected,
#         "timestamp": time.strftime("%H:%M:%S"),
#         **result,
#     }
#     return jsonify({"test_id": test_id, **result})


# @app.route("/api/test/results", methods=["GET"])
# def get_results():
#     subp    = request.args.get("subprogram")
#     results = list(_test_results.values())
#     if subp:
#         results = [r for r in results if r["subprogram"] == subp]
#     return jsonify(results)


# @app.route("/api/test/clear", methods=["POST"])
# def clear_results():
#     _test_results.clear()
#     return jsonify({"ok": True})


# @app.route("/api/export", methods=["GET"])
# def export_report():
#     return jsonify({
#         "project_path": _project_path,
#         "analysis":     _analysis_result,
#         "test_results": list(_test_results.values()),
#         "exported_at":  time.strftime("%Y-%m-%dT%H:%M:%S"),
#     })


# @app.route("/api/health", methods=["GET"])
# def health():
#     return jsonify({
#         "ok":       True,
#         "analyzed": bool(_analysis_result),
#         "files":    len(_analysis_result.get("file_paths", [])),
#         "subprograms": sum(
#             len(v) for v in _analysis_result.get("subprogram_index", {}).values()
#         ),
#     })


# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser(description="Ada Test Studio API")
#     parser.add_argument("--path",  default="", help="Ada project path to analyze on startup")
#     parser.add_argument("--port",  type=int, default=5050)
#     parser.add_argument("--debug", action="store_true")
#     args = parser.parse_args()

#     if args.path:
#         print(f"[INFO] Analyzing on startup: {args.path}")
#         _run_analysis(args.path)
#     else:
#         # auto-analyze the test folder next to this file if it exists
#         default = Path(__file__).parent / "testada_caseinsensitive"
#         if default.exists():
#             print(f"[INFO] Auto-analyzing default test path: {default}")
#             _run_analysis(str(default))

#     print(f"[INFO] Ada Test Studio API → http://localhost:{args.port}")
#     app.run(debug=args.debug, port=args.port)



"""
Ada Test Studio — Flask API backend (fixed)
"""

# import os
# import sys
# import json
# import uuid
# import time
# from pathlib import Path
# from flask import Flask, jsonify, request
# from flask_cors import CORS

# # ── BUG FIX 1: Single clean ROOT setup, no duplicates ─────────────────────
# # Your original had ROOT set twice with different parents[N] values,
# # and the second one (parents[4]) was wrong — it pointed too far up.
# ROOT = Path(__file__).resolve().parents[2]
# if str(ROOT) not in sys.path:
#     sys.path.insert(0, str(ROOT))

# # ── BUG FIX 2: Import at module level once, not re-imported inside function ─
# # Your original re-imported everything inside _run_analysis() on every call,
# # AND had dead code after a return statement that made them unreachable.
# from testss.auto_ada_tester.analyzer.project_loader import ProjectLoader
# from testss.auto_ada_tester.analyzer.indexer import SubprogramIndexer
# from testss.auto_ada_tester.analyzer.callgraph import CallGraphBuilder
# from testss.auto_ada_tester.analyzer.globals_analysis import GlobalRWDetector
# from testss.auto_ada_tester.analyzer.complexity import ComplexityAnalyzer
# from testss.auto_ada_tester.analyzer.deadcode import DeadCodeDetector
# from testss.auto_ada_tester.analyzer.control_flow_extractor import ControlFlowExtractor
# from testss.auto_ada_tester.analyzer.variables_analysis import VariablesAnalyzer
# # collect_ada_files defined inline — no dependency on runner.py
# ADA_EXTENSIONS = {".adb", ".ads", ".ada"}

# def collect_ada_files(root_path: str) -> list:
#     """
#     Recursively collect all Ada source files under root_path.
#     Handles nested dirs, symlinks, deduplication via real-path tracking.
#     """
#     ada_files = []
#     seen = set()
#     root = Path(root_path).resolve()

#     if root.is_file():
#         if root.suffix.lower() in ADA_EXTENSIONS:
#             ada_files.append(str(root))
#         return ada_files

#     if not root.is_dir():
#         raise FileNotFoundError(f"Invalid path: {root_path}")

#     for dirpath, dirnames, filenames in os.walk(str(root), followlinks=True):
#         dirnames.sort()
#         filenames.sort()
#         real_dir = os.path.realpath(dirpath)
#         if real_dir in seen:
#             dirnames.clear()
#             continue
#         seen.add(real_dir)
#         for filename in filenames:
#             if Path(filename).suffix.lower() in ADA_EXTENSIONS:
#                 full = os.path.join(dirpath, filename)
#                 real = os.path.realpath(full)
#                 if real not in seen:
#                     seen.add(real)
#                     ada_files.append(full)
#     return ada_files

# app = Flask(__name__)
# # Explicitly allow the React dev server origin so browsers don't block
# # cross-origin requests (which cause the HTML error page / JSON parse error).
# CORS(app, resources={
#     r"/api/*": {
#         "origins": [
#             "http://localhost:3000",   # React dev server
#             "http://127.0.0.1:3000",
#             "http://localhost:5050",   # direct API access
#             "http://127.0.0.1:5050",
#         ],
#         "methods": ["GET", "POST", "OPTIONS"],
#         "allow_headers": ["Content-Type"],
#     }
# })

# # ── In-memory session state ────────────────────────────────────────────────
# _analysis_result: dict = {}
# _test_results: dict[str, dict] = {}
# _project_path: str = ""


# # ── Type constraint helpers ────────────────────────────────────────────────

# def _type_constraint(type_str: str) -> dict:
#     tl = (type_str or "").lower().strip()
#     if "uint16"   in tl: return {"kind": "integer", "min": 0,           "max": 65535}
#     if "uint32"   in tl: return {"kind": "integer", "min": 0,           "max": 4294967295}
#     if "uint8"    in tl: return {"kind": "integer", "min": 0,           "max": 255}
#     if "positive" in tl: return {"kind": "integer", "min": 1,           "max": 2147483647}
#     if "natural"  in tl: return {"kind": "integer", "min": 0,           "max": 2147483647}
#     if "integer"  in tl: return {"kind": "integer", "min": -2147483648, "max": 2147483647}
#     if "float"    in tl: return {"kind": "float",   "min": -1e38,       "max": 1e38}
#     if "boolean"  in tl: return {"kind": "boolean",  "values": ["True", "False"]}
#     if "character"in tl: return {"kind": "character"}
#     if "string"   in tl: return {"kind": "string"}
#     return {"kind": "unknown"}


# def _validate_value(value: str, type_str: str) -> tuple[bool, str]:
#     c    = _type_constraint(type_str)
#     kind = c.get("kind", "unknown")
#     if kind == "integer":
#         try:
#             v = int(value)
#             if not (c["min"] <= v <= c["max"]):
#                 return False, f"Value {v} out of range [{c['min']} .. {c['max']}]"
#             return True, "ok"
#         except ValueError:
#             return False, f"Expected integer, got '{value}'"
#     if kind == "float":
#         try:
#             float(value); return True, "ok"
#         except ValueError:
#             return False, f"Expected float, got '{value}'"
#     if kind == "boolean":
#         if value not in ("True", "False"):
#             return False, f"Expected True or False, got '{value}'"
#         return True, "ok"
#     if kind == "character":
#         if not (value.startswith("'") and value.endswith("'") and len(value) == 3):
#             return False, f"Expected character literal like 'A', got '{value}'"
#         return True, "ok"
#     return True, "ok"


# def _get_subprogram(name: str) -> dict | None:
#     for fdata in _analysis_result.get("subprogram_index", {}).values():
#         for s in fdata:
#             if s["name"] == name:
#                 return s
#     return None


# def _simulate_execution(subp_name: str, inputs: dict, expected: dict) -> dict:
#     violations = []
#     subp_data  = _get_subprogram(subp_name)
#     if subp_data:
#         for var, val in inputs.items():
#             for p in subp_data.get("params", []):
#                 if p["name"] == var:
#                     ok, msg = _validate_value(val, p["type"])
#                     if not ok:
#                         violations.append({"variable": var, "type": p["type"],
#                                            "value": val, "error": msg})

#     if violations:
#         return {"status": "error", "message": "Type constraint violation",
#                 "violations": violations, "actual": {}, "elapsed_ms": 0}

#     t0     = time.monotonic()
#     actual = {}
#     for var, exp_val in expected.items():
#         try:
#             exp_int = int(exp_val)
#             in_sum  = sum(int(v) for v in inputs.values()
#                           if v.lstrip("-").isdigit())
#             actual[var] = str((exp_int + in_sum) % 65536)
#         except Exception:
#             actual[var] = exp_val

#     elapsed = round((time.monotonic() - t0) * 1000, 2)
#     passed  = all(actual.get(k, "?") == v for k, v in expected.items())

#     return {
#         "status":  "pass" if passed else "fail",
#         "message": "All assertions passed" if passed else "Output mismatch",
#         "actual":  actual,
#         "elapsed_ms": elapsed,
#         "normalized_types": {
#             var: next(
#                 (p["type"].lower()
#                  for p in (_get_subprogram(subp_name) or {}).get("params", [])
#                  if p["name"] == var),
#                 "unknown"
#             )
#             for var in inputs
#         },
#     }


# # ── Analysis trigger ───────────────────────────────────────────────────────

# def _run_analysis(project_path: str) -> dict:
#     """
#     BUG FIX 3 (the main one — why nothing was generated):

#     Your original had THREE fatal problems inside this function:

#     A) `project_path` was immediately overwritten:
#            project_path = Path(__file__).parent / "testada_caseinsensitive"
#        So whatever path the user typed in the UI was silently ignored.
#        The hardcoded path was then passed to collect_ada_files instead.

#     B) DeadCodeDetector was called with `...` (literal Ellipsis):
#            DeadCodeDetector(...).detect_unused_subprograms()
#        This crashes with TypeError at runtime — Ellipsis is not a valid argument.
#        It needs the callgraph that was just built.

#     C) Dead code after return: the stub JSON-load block and the fallback
#        skeleton were AFTER the return statement, so they never ran even
#        if the real pipeline failed. This meant any crash gave no fallback.

#     All three are fixed below.
#     """
#     global _analysis_result, _project_path
#     _project_path = project_path  # keep what the user actually passed

#     print(f"[INFO] Running analysis on: {project_path}")

#     try:
#         # ── Step 1: collect files ─────────────────────────────────────────
#         files = collect_ada_files(project_path)
#         if not files:
#             print(f"[WARN] No Ada files found in {project_path}")
#             _analysis_result = _empty_skeleton(files)
#             return _analysis_result

#         print(f"[INFO] Found {len(files)} Ada file(s)")

#         # ── Step 2: load units ────────────────────────────────────────────
#         loader = ProjectLoader(files)
#         units  = loader.load_units()

#         if not units:
#             print(f"[WARN] No units loaded — check file syntax")
#             _analysis_result = _empty_skeleton(files)
#             return _analysis_result

#         # ── Step 3: run all analyzers ─────────────────────────────────────
#         subprograms = SubprogramIndexer(units).index()
#         callgraph   = CallGraphBuilder(units).build()
#         globals_rw  = GlobalRWDetector(units).detect()
#         complexity  = ComplexityAnalyzer(units).compute()

#         # BUG FIX B: pass callgraph, not Ellipsis
#         deadcode    = DeadCodeDetector(callgraph).detect_unused_subprograms()

#         variables_info       = VariablesAnalyzer(units).extract()
#         control_flow         = ControlFlowExtractor(units).run()

#         _analysis_result = {
#             "file_paths":            files,
#             "subprogram_index":      subprograms,
#             "call_graph":            callgraph,
#             "global_read_write":     globals_rw,
#             "cyclomatic_complexity": complexity,
#             "dead_code":             deadcode,
#             "variables_info":        variables_info,
#             "control_flow_extractor": control_flow,
#         }

#         print(f"[INFO] Analysis complete — "
#               f"{sum(len(v) for v in subprograms.values())} subprograms found")

#         # ── Step 4: also save JSON report next to the source ─────────────
#         report_path = Path(project_path) / "variables_report.json"
#         try:
#             with open(report_path, "w") as f:
#                 json.dump(_analysis_result, f, indent=2, default=str)
#             print(f"[INFO] Report saved → {report_path}")
#         except Exception as e:
#             print(f"[WARN] Could not save report: {e}")

#         return _analysis_result

#     except Exception as e:
#         # BUG FIX C: catch any crash so the API always returns something
#         print(f"[ERROR] Analysis failed: {e}")
#         import traceback; traceback.print_exc()
#         _analysis_result = _empty_skeleton([])
#         _analysis_result["_error"] = str(e)
#         return _analysis_result


# def _empty_skeleton(files: list) -> dict:
#     return {
#         "file_paths": files,
#         "subprogram_index": {},
#         "call_graph": {},
#         "global_read_write": {},
#         "cyclomatic_complexity": {},
#         "dead_code": [],
#         "variables_info": {},
#         "control_flow_extractor": {},
#     }


# # ── Routes ────────────────────────────────────────────────────────────────

# @app.route("/api/analyze", methods=["POST"])
# def analyze():
#     body = request.get_json(silent=True) or {}

#     # BUG FIX 4: accept path from body OR fall back to the hardcoded test path
#     # so you can test from both the UI and curl without changing code
#     path = body.get("path", "").strip()
#     if not path:
#         # default to the testada_caseinsensitive folder next to this file
#         path = str(Path(__file__).parent / "testada_caseinsensitive")
#         print(f"[INFO] No path in request — using default: {path}")

#     if not os.path.exists(path):
#         return jsonify({"error": f"Path not found: {path}"}), 404

#     result = _run_analysis(path)
#     return jsonify({
#         "ok":               True,
#         "path":             path,
#         "file_count":       len(result.get("file_paths", [])),
#         "subprogram_count": sum(len(v) for v in result.get("subprogram_index", {}).values()),
#         "error":            result.get("_error"),
#     })


# @app.route("/api/files", methods=["GET"])
# def list_files():
#     files = _analysis_result.get("file_paths", [])
#     out   = []
#     for f in files:
#         p = Path(f)
#         out.append({
#             "path": f,
#             "name": p.name,
#             "ext":  p.suffix,
#             "size": p.stat().st_size if p.exists() else 0,
#         })
#     return jsonify(out)


# @app.route("/api/file", methods=["GET"])
# def get_file():
#     path = request.args.get("path", "")
#     if not path or not os.path.isfile(path):
#         return jsonify({"error": "File not found"}), 404
#     with open(path, encoding="utf-8", errors="replace") as f:
#         source = f.read()
#     return jsonify({"path": path, "source": source})


# @app.route("/api/subprograms", methods=["GET"])
# def list_subprograms():
#     idx        = _analysis_result.get("subprogram_index", {})
#     var_info   = _analysis_result.get("variables_info", {})
#     complexity = _analysis_result.get("cyclomatic_complexity", {})
#     dead_code  = _analysis_result.get("dead_code", [])
#     call_graph = _analysis_result.get("call_graph", {})

#     out = []
#     for filepath, subps in idx.items():
#         file_vars = var_info.get(filepath, {})
#         for s in subps:
#             name     = s["name"]
#             locals_  = file_vars.get("local_variables",  {}).get(name, {})
#             globals_ = file_vars.get("global_variables", {}).get(name, {})
#             consts_  = file_vars.get("global_constants", {}).get(name, {})

#             variables = []
#             for scope_name, scope_dict in [
#                 ("local",    locals_),
#                 ("global",   globals_),
#                 ("constant", consts_),
#             ]:
#                 for vname, vtype in scope_dict.items():
#                     t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)
#                     variables.append({
#                         "name":            vname,
#                         "type":            t,
#                         "type_normalized": t.lower(),
#                         "scope":           scope_name,
#                         "constraint":      _type_constraint(t),
#                     })

#             # parse raw param strings into structured list
#             params = []
#             for raw in s.get("parameters", []):
#                 for segment in raw.split(";"):
#                     segment = segment.strip()
#                     if not segment or ":" not in segment:
#                         continue
#                     names_part, type_part = segment.split(":", 1)
#                     type_clean = type_part.strip()
#                     dir_kw = "in"
#                     if "in out" in type_part.lower() or "in  out" in type_part.lower():
#                         dir_kw = "in out"
#                     elif "out" in type_part.lower():
#                         dir_kw = "out"
#                     for kw in ("in out", "in  out", "out", "in "):
#                         if type_clean.lower().startswith(kw):
#                             type_clean = type_clean[len(kw):].strip()
#                             break
#                     for pname in names_part.split(","):
#                         pname = pname.strip()
#                         if pname:
#                             params.append({
#                                 "name":            pname,
#                                 "dir":             dir_kw,
#                                 "type":            type_clean,
#                                 "type_normalized": type_clean.lower(),
#                                 "constraint":      _type_constraint(type_clean),
#                             })

#             out.append({
#                 "name":        name,
#                 "file":        filepath,
#                 "file_name":   Path(filepath).name,
#                 "start_line":  s.get("start_line"),
#                 "end_line":    s.get("end_line"),
#                 "return_type": s.get("return_type"),
#                 "params":      params,
#                 "variables":   variables,
#                 "complexity":  complexity.get(name),
#                 "is_dead":     name in dead_code,
#                 "calls":       call_graph.get(name, []),
#             })

#     return jsonify(out)


# @app.route("/api/test/run", methods=["POST"])
# def run_test():
#     body      = request.get_json(silent=True) or {}
#     subp_name = body.get("subprogram")
#     inputs    = body.get("inputs", {})
#     expected  = body.get("expected", {})
#     if not subp_name:
#         return jsonify({"error": "subprogram required"}), 400
#     result  = _simulate_execution(subp_name, inputs, expected)
#     test_id = str(uuid.uuid4())[:8]
#     _test_results[test_id] = {
#         "id": test_id, "subprogram": subp_name,
#         "inputs": inputs, "expected": expected,
#         "timestamp": time.strftime("%H:%M:%S"),
#         **result,
#     }
#     return jsonify({"test_id": test_id, **result})


# @app.route("/api/test/results", methods=["GET"])
# def get_results():
#     subp    = request.args.get("subprogram")
#     results = list(_test_results.values())
#     if subp:
#         results = [r for r in results if r["subprogram"] == subp]
#     return jsonify(results)


# @app.route("/api/test/clear", methods=["POST"])
# def clear_results():
#     _test_results.clear()
#     return jsonify({"ok": True})


# @app.route("/api/export", methods=["GET"])
# def export_report():
#     return jsonify({
#         "project_path": _project_path,
#         "analysis":     _analysis_result,
#         "test_results": list(_test_results.values()),
#         "exported_at":  time.strftime("%Y-%m-%dT%H:%M:%S"),
#     })


# @app.route("/api/health", methods=["GET"])
# def health():
#     return jsonify({
#         "ok":       True,
#         "analyzed": bool(_analysis_result),
#         "files":    len(_analysis_result.get("file_paths", [])),
#         "subprograms": sum(
#             len(v) for v in _analysis_result.get("subprogram_index", {}).values()
#         ),
#     })


# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser(description="Ada Test Studio API")
#     parser.add_argument("--path",  default="", help="Ada project path to analyze on startup")
#     parser.add_argument("--port",  type=int, default=5050)
#     parser.add_argument("--debug", action="store_true")
#     args = parser.parse_args()

#     if args.path:
#         print(f"[INFO] Analyzing on startup: {args.path}")
#         _run_analysis(args.path)
#     else:
#         # auto-analyze the test folder next to this file if it exists
#         default = Path(__file__).parent / "testada_caseinsensitive"
#         if default.exists():
#             print(f"[INFO] Auto-analyzing default test path: {default}")
#             _run_analysis(str(default))

#     print(f"[INFO] Ada Test Studio API → http://localhost:{args.port}")
#     app.run(debug=args.debug, port=args.port)

"""
Ada Test Studio — Flask API backend (fixed)
"""

# import os
# import sys
# import json
# import uuid
# import time
# from pathlib import Path
# from flask import Flask, jsonify, request
# from flask_cors import CORS

# # ── BUG FIX 1: Single clean ROOT setup, no duplicates ─────────────────────
# # Your original had ROOT set twice with different parents[N] values,
# # and the second one (parents[4]) was wrong — it pointed too far up.
# ROOT = Path(__file__).resolve().parents[2]
# if str(ROOT) not in sys.path:
#     sys.path.insert(0, str(ROOT))

# # ── BUG FIX 2: Import at module level once, not re-imported inside function ─
# # Your original re-imported everything inside _run_analysis() on every call,
# # AND had dead code after a return statement that made them unreachable.
# from testss.auto_ada_tester.analyzer.project_loader import ProjectLoader
# from testss.auto_ada_tester.analyzer.indexer import SubprogramIndexer
# from testss.auto_ada_tester.analyzer.callgraph import CallGraphBuilder
# from testss.auto_ada_tester.analyzer.globals_analysis import GlobalRWDetector
# from testss.auto_ada_tester.analyzer.complexity import ComplexityAnalyzer
# from testss.auto_ada_tester.analyzer.deadcode import DeadCodeDetector
# from testss.auto_ada_tester.analyzer.control_flow_extractor import ControlFlowExtractor
# from testss.auto_ada_tester.analyzer.variables_analysis import VariablesAnalyzer
# # collect_ada_files defined inline — no dependency on runner.py
# ADA_EXTENSIONS = {".adb", ".ads", ".ada"}

# def collect_ada_files(root_path: str) -> list:
#     """
#     Recursively collect all Ada source files under root_path.
#     Handles nested dirs, symlinks, deduplication via real-path tracking.
#     """
#     ada_files = []
#     seen = set()
#     root = Path(root_path).resolve()

#     if root.is_file():
#         if root.suffix.lower() in ADA_EXTENSIONS:
#             ada_files.append(str(root))
#         return ada_files

#     if not root.is_dir():
#         raise FileNotFoundError(f"Invalid path: {root_path}")

#     for dirpath, dirnames, filenames in os.walk(str(root), followlinks=True):
#         dirnames.sort()
#         filenames.sort()
#         real_dir = os.path.realpath(dirpath)
#         if real_dir in seen:
#             dirnames.clear()
#             continue
#         seen.add(real_dir)
#         for filename in filenames:
#             if Path(filename).suffix.lower() in ADA_EXTENSIONS:
#                 full = os.path.join(dirpath, filename)
#                 real = os.path.realpath(full)
#                 if real not in seen:
#                     seen.add(real)
#                     ada_files.append(full)
#     return ada_files

# app = Flask(__name__)
# # Explicitly allow the React dev server origin so browsers don't block
# # cross-origin requests (which cause the HTML error page / JSON parse error).
# CORS(app, resources={
#     r"/api/*": {
#         "origins": [
#             "http://localhost:3000",   # React dev server
#             "http://127.0.0.1:3000",
#             "http://localhost:5050",   # direct API access
#             "http://127.0.0.1:5050",
#         ],
#         "methods": ["GET", "POST", "OPTIONS"],
#         "allow_headers": ["Content-Type"],
#     }
# })

# # ── In-memory session state ────────────────────────────────────────────────
# _analysis_result: dict = {}
# _test_results: dict[str, dict] = {}
# _project_path: str = ""


# # ── Type constraint helpers ────────────────────────────────────────────────

# def _type_constraint(type_str: str) -> dict:
#     tl = (type_str or "").lower().strip()
#     if "uint16"   in tl: return {"kind": "integer", "min": 0,           "max": 65535}
#     if "uint32"   in tl: return {"kind": "integer", "min": 0,           "max": 4294967295}
#     if "uint8"    in tl: return {"kind": "integer", "min": 0,           "max": 255}
#     if "positive" in tl: return {"kind": "integer", "min": 1,           "max": 2147483647}
#     if "natural"  in tl: return {"kind": "integer", "min": 0,           "max": 2147483647}
#     if "integer"  in tl: return {"kind": "integer", "min": -2147483648, "max": 2147483647}
#     if "float"    in tl: return {"kind": "float",   "min": -1e38,       "max": 1e38}
#     if "boolean"  in tl: return {"kind": "boolean",  "values": ["True", "False"]}
#     if "character"in tl: return {"kind": "character"}
#     if "string"   in tl: return {"kind": "string"}
#     return {"kind": "unknown"}


# def _validate_value(value: str, type_str: str) -> tuple[bool, str]:
#     c    = _type_constraint(type_str)
#     kind = c.get("kind", "unknown")
#     if kind == "integer":
#         try:
#             v = int(value)
#             if not (c["min"] <= v <= c["max"]):
#                 return False, f"Value {v} out of range [{c['min']} .. {c['max']}]"
#             return True, "ok"
#         except ValueError:
#             return False, f"Expected integer, got '{value}'"
#     if kind == "float":
#         try:
#             float(value); return True, "ok"
#         except ValueError:
#             return False, f"Expected float, got '{value}'"
#     if kind == "boolean":
#         if value not in ("True", "False"):
#             return False, f"Expected True or False, got '{value}'"
#         return True, "ok"
#     if kind == "character":
#         if not (value.startswith("'") and value.endswith("'") and len(value) == 3):
#             return False, f"Expected character literal like 'A', got '{value}'"
#         return True, "ok"
#     return True, "ok"


# def _get_subprogram(name: str) -> dict | None:
#     for fdata in _analysis_result.get("subprogram_index", {}).values():
#         for s in fdata:
#             if s["name"] == name:
#                 return s
#     return None


# def _simulate_execution(subp_name: str, inputs: dict, expected: dict) -> dict:
#     violations = []
#     subp_data  = _get_subprogram(subp_name)
#     if subp_data:
#         for var, val in inputs.items():
#             for p in subp_data.get("params", []):
#                 if p["name"] == var:
#                     ok, msg = _validate_value(val, p["type"])
#                     if not ok:
#                         violations.append({"variable": var, "type": p["type"],
#                                            "value": val, "error": msg})

#     if violations:
#         return {"status": "error", "message": "Type constraint violation",
#                 "violations": violations, "actual": {}, "elapsed_ms": 0}

#     t0     = time.monotonic()
#     actual = {}
#     for var, exp_val in expected.items():
#         try:
#             exp_int = int(exp_val)
#             in_sum  = sum(int(v) for v in inputs.values()
#                           if v.lstrip("-").isdigit())
#             actual[var] = str((exp_int + in_sum) % 65536)
#         except Exception:
#             actual[var] = exp_val

#     elapsed = round((time.monotonic() - t0) * 1000, 2)
#     passed  = all(actual.get(k, "?") == v for k, v in expected.items())

#     return {
#         "status":  "pass" if passed else "fail",
#         "message": "All assertions passed" if passed else "Output mismatch",
#         "actual":  actual,
#         "elapsed_ms": elapsed,
#         "normalized_types": {
#             var: next(
#                 (p["type"].lower()
#                  for p in (_get_subprogram(subp_name) or {}).get("params", [])
#                  if p["name"] == var),
#                 "unknown"
#             )
#             for var in inputs
#         },
#     }


# # ── Analysis trigger ───────────────────────────────────────────────────────

# def _run_analysis(project_path: str) -> dict:
#     """
#     BUG FIX 3 (the main one — why nothing was generated):

#     Your original had THREE fatal problems inside this function:

#     A) `project_path` was immediately overwritten:
#            project_path = Path(__file__).parent / "testada_caseinsensitive"
#        So whatever path the user typed in the UI was silently ignored.
#        The hardcoded path was then passed to collect_ada_files instead.

#     B) DeadCodeDetector was called with `...` (literal Ellipsis):
#            DeadCodeDetector(...).detect_unused_subprograms()
#        This crashes with TypeError at runtime — Ellipsis is not a valid argument.
#        It needs the callgraph that was just built.

#     C) Dead code after return: the stub JSON-load block and the fallback
#        skeleton were AFTER the return statement, so they never ran even
#        if the real pipeline failed. This meant any crash gave no fallback.

#     All three are fixed below.
#     """
#     global _analysis_result, _project_path
#     _project_path = project_path  # keep what the user actually passed

#     print(f"[INFO] Running analysis on: {project_path}")

#     try:
#         # ── Step 1: collect files ─────────────────────────────────────────
#         files = collect_ada_files(project_path)
#         if not files:
#             print(f"[WARN] No Ada files found in {project_path}")
#             _analysis_result = _empty_skeleton(files)
#             return _analysis_result

#         print(f"[INFO] Found {len(files)} Ada file(s)")

#         # ── Step 2: load units ────────────────────────────────────────────
#         loader = ProjectLoader(files)
#         units  = loader.load_units()

#         if not units:
#             print(f"[WARN] No units loaded — check file syntax")
#             _analysis_result = _empty_skeleton(files)
#             return _analysis_result

#         # ── Step 3: run all analyzers ─────────────────────────────────────
#         subprograms = SubprogramIndexer(units).index()
#         callgraph   = CallGraphBuilder(units).build()
#         globals_rw  = GlobalRWDetector(units).detect()
#         complexity  = ComplexityAnalyzer(units).compute()

#         # BUG FIX B: pass callgraph, not Ellipsis
#         deadcode    = DeadCodeDetector(callgraph).detect_unused_subprograms()

#         variables_info       = VariablesAnalyzer(units).extract()
#         control_flow         = ControlFlowExtractor(units).run()

#         _analysis_result = {
#             "file_paths":            files,
#             "subprogram_index":      subprograms,
#             "call_graph":            callgraph,
#             "global_read_write":     globals_rw,
#             "cyclomatic_complexity": complexity,
#             "dead_code":             deadcode,
#             "variables_info":        variables_info,
#             "control_flow_extractor": control_flow,
#         }

#         print(f"[INFO] Analysis complete — "
#               f"{sum(len(v) for v in subprograms.values())} subprograms found")

#         # ── Step 4: also save JSON report next to the source ─────────────
#         report_path = Path(project_path) / "variables_report.json"
#         try:
#             with open(report_path, "w") as f:
#                 json.dump(_analysis_result, f, indent=2, default=str)
#             print(f"[INFO] Report saved → {report_path}")
#         except Exception as e:
#             print(f"[WARN] Could not save report: {e}")

#         return _analysis_result

#     except Exception as e:
#         # BUG FIX C: catch any crash so the API always returns something
#         print(f"[ERROR] Analysis failed: {e}")
#         import traceback; traceback.print_exc()
#         _analysis_result = _empty_skeleton([])
#         _analysis_result["_error"] = str(e)
#         return _analysis_result


# def _empty_skeleton(files: list) -> dict:
#     return {
#         "file_paths": files,
#         "subprogram_index": {},
#         "call_graph": {},
#         "global_read_write": {},
#         "cyclomatic_complexity": {},
#         "dead_code": [],
#         "variables_info": {},
#         "control_flow_extractor": {},
#     }


# # ── Routes ────────────────────────────────────────────────────────────────

# @app.route("/api/analyze", methods=["POST"])
# def analyze():
#     body = request.get_json(silent=True) or {}

#     # BUG FIX 4: accept path from body OR fall back to the hardcoded test path
#     # so you can test from both the UI and curl without changing code
#     path = body.get("path", "").strip()
#     if not path:
#         # default to the testada_caseinsensitive folder next to this file
#         path = str(Path(__file__).parent / "testada_caseinsensitive")
#         print(f"[INFO] No path in request — using default: {path}")

#     if not os.path.exists(path):
#         return jsonify({"error": f"Path not found: {path}"}), 404

#     result = _run_analysis(path)
#     return jsonify({
#         "ok":               True,
#         "path":             path,
#         "file_count":       len(result.get("file_paths", [])),
#         "subprogram_count": sum(len(v) for v in result.get("subprogram_index", {}).values()),
#         "error":            result.get("_error"),
#     })


# @app.route("/api/files", methods=["GET"])
# def list_files():
#     files = _analysis_result.get("file_paths", [])
#     out   = []
#     for f in files:
#         p = Path(f)
#         out.append({
#             "path": f,
#             "name": p.name,
#             "ext":  p.suffix,
#             "size": p.stat().st_size if p.exists() else 0,
#         })
#     return jsonify(out)


# @app.route("/api/file", methods=["GET"])
# def get_file():
#     path = request.args.get("path", "")
#     if not path or not os.path.isfile(path):
#         return jsonify({"error": "File not found"}), 404
#     with open(path, encoding="utf-8", errors="replace") as f:
#         source = f.read()
#     return jsonify({"path": path, "source": source})


# # ── helper: pull initial value from control_flow branch_body_variables ──────
# def _initial_value_from_cf(cf_subp: dict, var_name: str) -> str:
#     """
#     Scan control_flow branch_body_variables for initial_value / assigned_from
#     of a variable. Handles loop-body and conditional-body declarations.
#     """
#     bv = cf_subp.get("branch_body_variables", {})
#     entry = bv.get(var_name)
#     if entry:
#         return entry.get("assigned_from", entry.get("initial_value", ""))
#     # case-insensitive fallback
#     vl = var_name.lower()
#     for k, v in bv.items():
#         if k.lower() == vl:
#             return v.get("assigned_from", v.get("initial_value", ""))
#     return ""


# # ── helper: pull ALL vars from control_flow (loop/conditional bodies) ────────
# def _cf_all_vars(cf_subp: dict) -> list:
#     """
#     Return every variable found in branch_body_variables that has a
#     non-unknown type — these are variables declared inside if/for/while/declare
#     blocks that VariablesAnalyzer misses because it only walks top-level ObjectDecl.
#     """
#     bv = cf_subp.get("branch_body_variables", {})
#     result = []
#     for vname, info in bv.items():
#         if info.get("kind") not in ("local_decl", "assignment"):
#             continue
#         dt = info.get("data_type", {})
#         t  = dt.get("type", "Unknown") if isinstance(dt, dict) else str(dt)
#         if t in ("Unknown", "", None):
#             continue
#         result.append({
#             "name":          vname,
#             "type":          t,
#             "scope":         "loop/cond",
#             "initial_value": info.get("assigned_from", ""),
#             "source":        info.get("used_in_branch", ""),
#         })
#     return result


# # ── helper: expand dotted name "Rec.Field" into proper field entry ───────────
# def _expand_dotted_var(vname: str, vtype_dict: dict,
#                        scope: str, cf_subp: dict) -> list:
#     """
#     If vname contains '.' (e.g. Uplink.LineCentre), treat it as a record field
#     access and return a proper entry instead of showing "Unknown" at the top level.
#     If vtype is Unknown and we have a dotted name, try to get field type from
#     control_flow variables dict which may have it resolved.
#     """
#     if "." not in vname:
#         return []

#     parts     = vname.split(".", 1)
#     rec_name  = parts[0]
#     field     = parts[1]

#     t = vtype_dict.get("type", "Unknown") if isinstance(vtype_dict, dict) else str(vtype_dict)

#     # If still Unknown, try control_flow branch_body_variables
#     if t in ("Unknown", "", None):
#         bv = cf_subp.get("branch_body_variables", {})
#         for k, v in bv.items():
#             if k.lower() == vname.lower():
#                 dt = v.get("data_type", {})
#                 t  = dt.get("type", "Unknown") if isinstance(dt, dict) else str(dt)
#                 break

#     return [{
#         "name":            vname,
#         "type":            t,
#         "type_normalized": t.lower(),
#         "scope":           scope,
#         "constraint":      _type_constraint(t),
#         "initial_value":   _initial_value_from_cf(cf_subp, vname),
#         "source":          f"field of {rec_name}",
#         "record_parent":   rec_name,
#         "record_field":    field,
#     }]


# @app.route("/api/subprograms", methods=["GET"])
# def list_subprograms():
#     idx        = _analysis_result.get("subprogram_index", {})
#     var_info   = _analysis_result.get("variables_info", {})
#     complexity = _analysis_result.get("cyclomatic_complexity", {})
#     dead_code  = _analysis_result.get("dead_code", [])
#     call_graph = _analysis_result.get("call_graph", {})
#     cf_data    = _analysis_result.get("control_flow_extractor", {})

#     out = []
#     for filepath, subps in idx.items():
#         file_vars = var_info.get(filepath, {})
#         # control_flow is keyed by filepath → subp_name
#         cf_file   = cf_data.get(filepath, {})

#         for s in subps:
#             name     = s["name"]
#             locals_  = file_vars.get("local_variables",  {}).get(name, {})
#             globals_ = file_vars.get("global_variables", {}).get(name, {})
#             consts_  = file_vars.get("global_constants", {}).get(name, {})
#             cf_subp  = cf_file.get(name, {})

#             # ── track seen names to avoid duplicates ──────────────────────
#             seen: set = set()
#             variables: list = []

#             def _add(vname, t, scope, initial="", source="", extra=None):
#                 key = vname.lower()
#                 if key in seen:
#                     return
#                 seen.add(key)
#                 entry = {
#                     "name":            vname,
#                     "type":            t,
#                     "type_normalized": t.lower(),
#                     "scope":           scope,
#                     "constraint":      _type_constraint(t),
#                     "initial_value":   initial,
#                     "source":          source,
#                 }
#                 if extra:
#                     entry.update(extra)
#                 variables.append(entry)

#             # ── FIX 1: standard locals / globals / constants ──────────────
#             for scope_name, scope_dict, is_const in [
#                 ("local",    locals_,  False),
#                 ("global",   globals_, False),
#                 ("constant", consts_,  True),
#             ]:
#                 for vname, vtype in scope_dict.items():
#                     # ── FIX 2: expand dotted names (Uplink.LineCentre) ────
#                     if "." in vname:
#                         for entry in _expand_dotted_var(vname, vtype, scope_name, cf_subp):
#                             key = entry["name"].lower()
#                             if key not in seen:
#                                 seen.add(key)
#                                 variables.append(entry)
#                         continue

#                     t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)

#                     # ── FIX 3: constant initial value ─────────────────────
#                     init = ""
#                     if is_const:
#                         init = (vtype.get("value", "") or
#                                 vtype.get("initial_value", "") or
#                                 vtype.get("init", "")
#                                 if isinstance(vtype, dict) else "")
#                         # fallback: check cf branch_body
#                         if not init:
#                             init = _initial_value_from_cf(cf_subp, vname)

#                     _add(vname, t, scope_name, initial=init)

#             # ── FIX 4: loop / conditional body variables (deep scan) ──────
#             for entry in _cf_all_vars(cf_subp):
#                 vname = entry["name"]
#                 if "." in vname:
#                     # expand dotted names found in cf too
#                     vtype_d = {"type": entry["type"]}
#                     for exp in _expand_dotted_var(vname, vtype_d, "loop/cond", cf_subp):
#                         key = exp["name"].lower()
#                         if key not in seen:
#                             seen.add(key)
#                             variables.append(exp)
#                 else:
#                     _add(vname, entry["type"], "loop/cond",
#                          initial=entry.get("initial_value", ""),
#                          source=entry.get("source", ""))

#             # parse raw param strings into structured list
#             params = []
#             for raw in s.get("parameters", []):
#                 for segment in raw.split(";"):
#                     segment = segment.strip()
#                     if not segment or ":" not in segment:
#                         continue
#                     names_part, type_part = segment.split(":", 1)
#                     type_clean = type_part.strip()
#                     dir_kw = "in"
#                     if "in out" in type_part.lower() or "in  out" in type_part.lower():
#                         dir_kw = "in out"
#                     elif "out" in type_part.lower():
#                         dir_kw = "out"
#                     for kw in ("in out", "in  out", "out", "in "):
#                         if type_clean.lower().startswith(kw):
#                             type_clean = type_clean[len(kw):].strip()
#                             break
#                     for pname in names_part.split(","):
#                         pname = pname.strip()
#                         if pname:
#                             params.append({
#                                 "name":            pname,
#                                 "dir":             dir_kw,
#                                 "type":            type_clean,
#                                 "type_normalized": type_clean.lower(),
#                                 "constraint":      _type_constraint(type_clean),
#                             })

#             out.append({
#                 "name":        name,
#                 "file":        filepath,
#                 "file_name":   Path(filepath).name,
#                 "start_line":  s.get("start_line"),
#                 "end_line":    s.get("end_line"),
#                 "return_type": s.get("return_type"),
#                 "params":      params,
#                 "variables":   variables,
#                 "complexity":  complexity.get(name),
#                 "is_dead":     name in dead_code,
#                 "calls":       call_graph.get(name, []),
#             })

#     return jsonify(out)


# @app.route("/api/test/run", methods=["POST"])
# def run_test():
#     body      = request.get_json(silent=True) or {}
#     subp_name = body.get("subprogram")
#     inputs    = body.get("inputs", {})
#     expected  = body.get("expected", {})
#     if not subp_name:
#         return jsonify({"error": "subprogram required"}), 400
#     result  = _simulate_execution(subp_name, inputs, expected)
#     test_id = str(uuid.uuid4())[:8]
#     _test_results[test_id] = {
#         "id": test_id, "subprogram": subp_name,
#         "inputs": inputs, "expected": expected,
#         "timestamp": time.strftime("%H:%M:%S"),
#         **result,
#     }
#     return jsonify({"test_id": test_id, **result})


# @app.route("/api/test/results", methods=["GET"])
# def get_results():
#     subp    = request.args.get("subprogram")
#     results = list(_test_results.values())
#     if subp:
#         results = [r for r in results if r["subprogram"] == subp]
#     return jsonify(results)


# @app.route("/api/test/clear", methods=["POST"])
# def clear_results():
#     _test_results.clear()
#     return jsonify({"ok": True})


# @app.route("/api/export", methods=["GET"])
# def export_report():
#     return jsonify({
#         "project_path": _project_path,
#         "analysis":     _analysis_result,
#         "test_results": list(_test_results.values()),
#         "exported_at":  time.strftime("%Y-%m-%dT%H:%M:%S"),
#     })


# @app.route("/api/health", methods=["GET"])
# def health():
#     return jsonify({
#         "ok":       True,
#         "analyzed": bool(_analysis_result),
#         "files":    len(_analysis_result.get("file_paths", [])),
#         "subprograms": sum(
#             len(v) for v in _analysis_result.get("subprogram_index", {}).values()
#         ),
#     })


# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser(description="Ada Test Studio API")
#     parser.add_argument("--path",  default="", help="Ada project path to analyze on startup")
#     parser.add_argument("--port",  type=int, default=5050)
#     parser.add_argument("--debug", action="store_true")
#     args = parser.parse_args()

#     if args.path:
#         print(f"[INFO] Analyzing on startup: {args.path}")
#         _run_analysis(args.path)
#     else:
#         # auto-analyze the test folder next to this file if it exists
#         default = Path(__file__).parent / "testada_caseinsensitive"
#         if default.exists():
#             print(f"[INFO] Auto-analyzing default test path: {default}")
#             _run_analysis(str(default))

#     print(f"[INFO] Ada Test Studio API → http://localhost:{args.port}")
#     app.run(debug=args.debug, port=args.port)



"""
Ada Test Studio — Flask API backend (fixed)
"""

import os
import sys
import json
import uuid
import time
from pathlib import Path
from flask import Flask, jsonify, request
from flask_cors import CORS

# ── BUG FIX 1: Single clean ROOT setup, no duplicates ─────────────────────
# Your original had ROOT set twice with different parents[N] values,
# and the second one (parents[4]) was wrong — it pointed too far up.
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# ── BUG FIX 2: Import at module level once, not re-imported inside function ─
# Your original re-imported everything inside _run_analysis() on every call,
# AND had dead code after a return statement that made them unreachable.
from testss.auto_ada_tester.analyzer.project_loader import ProjectLoader
from testss.auto_ada_tester.analyzer.indexer import SubprogramIndexer
from testss.auto_ada_tester.analyzer.callgraph import CallGraphBuilder
from testss.auto_ada_tester.analyzer.globals_analysis import GlobalRWDetector
from testss.auto_ada_tester.analyzer.complexity import ComplexityAnalyzer
from testss.auto_ada_tester.analyzer.deadcode import DeadCodeDetector
from testss.auto_ada_tester.analyzer.control_flow_extractor import ControlFlowExtractor
from testss.auto_ada_tester.analyzer.variables_analysis import VariablesAnalyzer
# collect_ada_files defined inline — no dependency on runner.py
ADA_EXTENSIONS = {".adb", ".ads", ".ada"}

def collect_ada_files(root_path: str) -> list:
    """
    Recursively collect all Ada source files under root_path.
    Handles nested dirs, symlinks, deduplication via real-path tracking.
    """
    ada_files = []
    seen = set()
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

app = Flask(__name__)
# Explicitly allow the React dev server origin so browsers don't block
# cross-origin requests (which cause the HTML error page / JSON parse error).
CORS(app, resources={
    r"/api/*": {
        "origins": [
            "http://localhost:3000",   # React dev server
            "http://127.0.0.1:3000",
            "http://localhost:5050",   # direct API access
            "http://127.0.0.1:5050",
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"],
    }
})

# ── In-memory session state ────────────────────────────────────────────────
_analysis_result: dict = {}
_test_results: dict[str, dict] = {}
_project_path: str = ""


# ── Type constraint helpers ────────────────────────────────────────────────

def _type_constraint(type_str: str) -> dict:
    tl = (type_str or "").lower().strip()
    if "uint16"   in tl: return {"kind": "integer", "min": 0,           "max": 65535}
    if "uint32"   in tl: return {"kind": "integer", "min": 0,           "max": 4294967295}
    if "uint8"    in tl: return {"kind": "integer", "min": 0,           "max": 255}
    if "positive" in tl: return {"kind": "integer", "min": 1,           "max": 2147483647}
    if "natural"  in tl: return {"kind": "integer", "min": 0,           "max": 2147483647}
    if "integer"  in tl: return {"kind": "integer", "min": -2147483648, "max": 2147483647}
    if "float"    in tl: return {"kind": "float",   "min": -1e38,       "max": 1e38}
    if "boolean"  in tl: return {"kind": "boolean",  "values": ["True", "False"]}
    if "character"in tl: return {"kind": "character"}
    if "string"   in tl: return {"kind": "string"}
    return {"kind": "unknown"}


def _validate_value(value: str, type_str: str) -> tuple[bool, str]:
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
            float(value); return True, "ok"
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


def _get_subprogram(name: str) -> dict | None:
    for fdata in _analysis_result.get("subprogram_index", {}).values():
        for s in fdata:
            if s["name"] == name:
                return s
    return None


def _simulate_execution(subp_name: str, inputs: dict, expected: dict) -> dict:
    violations = []
    subp_data  = _get_subprogram(subp_name)
    if subp_data:
        for var, val in inputs.items():
            for p in subp_data.get("params", []):
                if p["name"] == var:
                    ok, msg = _validate_value(val, p["type"])
                    if not ok:
                        violations.append({"variable": var, "type": p["type"],
                                           "value": val, "error": msg})

    if violations:
        return {"status": "error", "message": "Type constraint violation",
                "violations": violations, "actual": {}, "elapsed_ms": 0}

    t0     = time.monotonic()
    actual = {}
    for var, exp_val in expected.items():
        try:
            exp_int = int(exp_val)
            in_sum  = sum(int(v) for v in inputs.values()
                          if v.lstrip("-").isdigit())
            actual[var] = str((exp_int + in_sum) % 65536)
        except Exception:
            actual[var] = exp_val

    elapsed = round((time.monotonic() - t0) * 1000, 2)
    passed  = all(actual.get(k, "?") == v for k, v in expected.items())

    return {
        "status":  "pass" if passed else "fail",
        "message": "All assertions passed" if passed else "Output mismatch",
        "actual":  actual,
        "elapsed_ms": elapsed,
        "normalized_types": {
            var: next(
                (p["type"].lower()
                 for p in (_get_subprogram(subp_name) or {}).get("params", [])
                 if p["name"] == var),
                "unknown"
            )
            for var in inputs
        },
    }


# ── Analysis trigger ───────────────────────────────────────────────────────

def _run_analysis(project_path: str) -> dict:
    """
    BUG FIX 3 (the main one — why nothing was generated):

    Your original had THREE fatal problems inside this function:

    A) `project_path` was immediately overwritten:
           project_path = Path(__file__).parent / "testada_caseinsensitive"
       So whatever path the user typed in the UI was silently ignored.
       The hardcoded path was then passed to collect_ada_files instead.

    B) DeadCodeDetector was called with `...` (literal Ellipsis):
           DeadCodeDetector(...).detect_unused_subprograms()
       This crashes with TypeError at runtime — Ellipsis is not a valid argument.
       It needs the callgraph that was just built.

    C) Dead code after return: the stub JSON-load block and the fallback
       skeleton were AFTER the return statement, so they never ran even
       if the real pipeline failed. This meant any crash gave no fallback.

    All three are fixed below.
    """
    global _analysis_result, _project_path
    _project_path = project_path  # keep what the user actually passed

    print(f"[INFO] Running analysis on: {project_path}")

    try:
        # ── Step 1: collect files ─────────────────────────────────────────
        files = collect_ada_files(project_path)
        if not files:
            print(f"[WARN] No Ada files found in {project_path}")
            _analysis_result = _empty_skeleton(files)
            return _analysis_result

        print(f"[INFO] Found {len(files)} Ada file(s)")

        # ── Step 2: load units ────────────────────────────────────────────
        loader = ProjectLoader(files)
        units  = loader.load_units()

        if not units:
            print(f"[WARN] No units loaded — check file syntax")
            _analysis_result = _empty_skeleton(files)
            return _analysis_result

        # ── Step 3: run all analyzers ─────────────────────────────────────
        subprograms = SubprogramIndexer(units).index()
        callgraph   = CallGraphBuilder(units).build()
        globals_rw  = GlobalRWDetector(units).detect()
        complexity  = ComplexityAnalyzer(units).compute()

        # BUG FIX B: pass callgraph, not Ellipsis
        deadcode    = DeadCodeDetector(callgraph).detect_unused_subprograms()

        variables_info       = VariablesAnalyzer(units).extract()
        control_flow         = ControlFlowExtractor(units).run()

        _analysis_result = {
            "file_paths":            files,
            "subprogram_index":      subprograms,
            "call_graph":            callgraph,
            "global_read_write":     globals_rw,
            "cyclomatic_complexity": complexity,
            "dead_code":             deadcode,
            "variables_info":        variables_info,
            "control_flow_extractor": control_flow,
        }

        print(f"[INFO] Analysis complete — "
              f"{sum(len(v) for v in subprograms.values())} subprograms found")

        # ── Step 4: also save JSON report next to the source ─────────────
        report_path = Path(project_path) / "variables_report.json"
        try:
            with open(report_path, "w") as f:
                json.dump(_analysis_result, f, indent=2, default=str)
            print(f"[INFO] Report saved → {report_path}")
        except Exception as e:
            print(f"[WARN] Could not save report: {e}")

        return _analysis_result

    except Exception as e:
        # BUG FIX C: catch any crash so the API always returns something
        print(f"[ERROR] Analysis failed: {e}")
        import traceback; traceback.print_exc()
        _analysis_result = _empty_skeleton([])
        _analysis_result["_error"] = str(e)
        return _analysis_result


def _empty_skeleton(files: list) -> dict:
    return {
        "file_paths": files,
        "subprogram_index": {},
        "call_graph": {},
        "global_read_write": {},
        "cyclomatic_complexity": {},
        "dead_code": [],
        "variables_info": {},
        "control_flow_extractor": {},
    }


# ── Routes ────────────────────────────────────────────────────────────────

@app.route("/api/analyze", methods=["POST"])
def analyze():
    body = request.get_json(silent=True) or {}

    # BUG FIX 4: accept path from body OR fall back to the hardcoded test path
    # so you can test from both the UI and curl without changing code
    path = body.get("path", "").strip()
    if not path:
        # default to the testada_caseinsensitive folder next to this file
        path = str(Path(__file__).parent / "testada_caseinsensitive")
        print(f"[INFO] No path in request — using default: {path}")

    if not os.path.exists(path):
        return jsonify({"error": f"Path not found: {path}"}), 404

    result = _run_analysis(path)
    return jsonify({
        "ok":               True,
        "path":             path,
        "file_count":       len(result.get("file_paths", [])),
        "subprogram_count": sum(len(v) for v in result.get("subprogram_index", {}).values()),
        "error":            result.get("_error"),
    })


@app.route("/api/files", methods=["GET"])
def list_files():
    files = _analysis_result.get("file_paths", [])
    out   = []
    for f in files:
        p = Path(f)
        out.append({
            "path": f,
            "name": p.name,
            "ext":  p.suffix,
            "size": p.stat().st_size if p.exists() else 0,
        })
    return jsonify(out)


@app.route("/api/file", methods=["GET"])
def get_file():
    path = request.args.get("path", "")
    if not path or not os.path.isfile(path):
        return jsonify({"error": "File not found"}), 404
    with open(path, encoding="utf-8", errors="replace") as f:
        source = f.read()
    return jsonify({"path": path, "source": source})


# ── helper: pull initial value from control_flow branch_body_variables ──────
def _initial_value_from_cf(cf_subp: dict, var_name: str) -> str:
    """
    Scan control_flow branch_body_variables for initial_value / assigned_from
    of a variable. Handles loop-body and conditional-body declarations.
    """
    bv = cf_subp.get("branch_body_variables", {})
    entry = bv.get(var_name)
    if entry:
        return entry.get("assigned_from", entry.get("initial_value", ""))
    # case-insensitive fallback
    vl = var_name.lower()
    for k, v in bv.items():
        if k.lower() == vl:
            return v.get("assigned_from", v.get("initial_value", ""))
    return ""


# ── helper: pull ALL vars from control_flow (loop/conditional bodies) ────────
def _cf_all_vars(cf_subp: dict) -> list:
    """
    Return every variable found in branch_body_variables that has a
    non-unknown type — these are variables declared inside if/for/while/declare
    blocks that VariablesAnalyzer misses because it only walks top-level ObjectDecl.
    """
    bv = cf_subp.get("branch_body_variables", {})
    result = []
    for vname, info in bv.items():
        if info.get("kind") not in ("local_decl", "assignment"):
            continue
        dt = info.get("data_type", {})
        t  = dt.get("type", "Unknown") if isinstance(dt, dict) else str(dt)
        if t in ("Unknown", "", None):
            continue
        result.append({
            "name":          vname,
            "type":          t,
            "scope":         "loop/cond",
            "initial_value": info.get("assigned_from", ""),
            "source":        info.get("used_in_branch", ""),
        })
    return result


# ── helper: expand dotted name "Rec.Field" into proper field entry ───────────
def _expand_dotted_var(vname: str, vtype_dict: dict,
                       scope: str, cf_subp: dict) -> list:
    """
    If vname contains '.' (e.g. Uplink.LineCentre), treat it as a record field
    access and return a proper entry instead of showing "Unknown" at the top level.
    If vtype is Unknown and we have a dotted name, try to get field type from
    control_flow variables dict which may have it resolved.
    """
    if "." not in vname:
        return []

    parts     = vname.split(".", 1)
    rec_name  = parts[0]
    field     = parts[1]

    t = vtype_dict.get("type", "Unknown") if isinstance(vtype_dict, dict) else str(vtype_dict)

    # If still Unknown, try control_flow branch_body_variables
    if t in ("Unknown", "", None):
        bv = cf_subp.get("branch_body_variables", {})
        for k, v in bv.items():
            if k.lower() == vname.lower():
                dt = v.get("data_type", {})
                t  = dt.get("type", "Unknown") if isinstance(dt, dict) else str(dt)
                break

    return [{
        "name":            vname,
        "type":            t,
        "type_normalized": t.lower(),
        "scope":           scope,
        "constraint":      _type_constraint(t),
        "initial_value":   _initial_value_from_cf(cf_subp, vname),
        "source":          f"field of {rec_name}",
        "record_parent":   rec_name,
        "record_field":    field,
    }]


# ── helper: resolve record-field type from the TypeRegistry ─────────────────
def _resolve_field_type(rec_var_type: str, field_name: str,
                        cf_data_all: dict) -> str:
    """
    Given a record variable's declared type (e.g. 'Telemetry_Packet') and a
    field name (e.g. 'LineCentre'), look it up in the __registry__ that
    ControlFlowExtractor stores, walking through subtypes/aliases.

    Returns the field's Ada type string, or 'Unknown'.
    """
    registry = cf_data_all.get("__registry__", {})
    types    = registry.get("types", {})

    # case-insensitive lookup for the parent record type
    rec_type_key = rec_var_type.lower()
    rec_entry    = None
    for k, v in types.items():
        if k.lower() == rec_type_key:
            rec_entry = v
            break

    if rec_entry is None:
        return "Unknown"

    # follow subtype/alias chain
    depth = 0
    while rec_entry.get("kind") in ("subtype", "alias") and depth < 10:
        base = rec_entry.get("base_type") or rec_entry.get("base", "")
        if not base:
            break
        found = None
        for k, v in types.items():
            if k.lower() == base.lower():
                found = v
                break
        if found is None:
            break
        rec_entry = found
        depth += 1

    if rec_entry.get("kind") != "record":
        return "Unknown"

    # case-insensitive field lookup
    fields = rec_entry.get("record_fields", {})
    for fname, finfo in fields.items():
        if fname.lower() == field_name.lower():
            st = finfo.get("structured_type", {})
            rt = finfo.get("raw_type", "")
            if isinstance(st, dict):
                return st.get("type", rt or "Unknown")
            return rt or "Unknown"

    return "Unknown"


# ── helper: resolve the type of a variable name from registry objects ─────────
def _resolve_var_type_from_registry(var_name: str, cf_data_all: dict) -> str:
    """
    Look up var_name in the __registry__ objects dict (case-insensitive).
    Returns its Ada type string.
    """
    registry = cf_data_all.get("__registry__", {})
    objects  = registry.get("objects", {})
    vl = var_name.lower()
    for k, v in objects.items():
        if k.lower() == vl:
            dt = v.get("data_type", {})
            if isinstance(dt, dict):
                return dt.get("type", "Unknown")
            return str(dt) if dt else "Unknown"
    return "Unknown"


@app.route("/api/subprograms", methods=["GET"])
def list_subprograms():
    idx        = _analysis_result.get("subprogram_index", {})
    var_info   = _analysis_result.get("variables_info", {})
    complexity = _analysis_result.get("cyclomatic_complexity", {})
    dead_code  = _analysis_result.get("dead_code", [])
    call_graph = _analysis_result.get("call_graph", {})
    cf_data    = _analysis_result.get("control_flow_extractor", {})

    out = []
    for filepath, subps in idx.items():
        file_vars = var_info.get(filepath, {})
        cf_file   = cf_data.get(filepath, {})

        for s in subps:
            name     = s["name"]
            locals_  = file_vars.get("local_variables",  {}).get(name, {})
            globals_ = file_vars.get("global_variables", {}).get(name, {})
            consts_  = file_vars.get("global_constants", {}).get(name, {})
            cf_subp  = cf_file.get(name, {})

            seen: set     = set()
            variables: list = []

            def _add(vname, t, scope, initial="", source="", extra=None):
                key = vname.lower()
                if key in seen:
                    return
                seen.add(key)
                entry = {
                    "name":            vname,
                    "type":            t,
                    "type_normalized": t.lower(),
                    "scope":           scope,
                    "constraint":      _type_constraint(t),
                    "initial_value":   initial,
                    "source":          source,
                }
                if extra:
                    entry.update(extra)
                variables.append(entry)

            # ── PASS 1: subprogram parameters (FIX for Font:BMP_Font missing)
            # Parameters live in ParamSpec nodes, not ObjectDecl.
            # They ARE in subprogram_index["parameters"] as raw text.
            # We parse them here so they appear in the variables tab.
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
                    # strip default value if present (e.g. "Natural := 0")
                    if ":=" in type_clean:
                        type_clean = type_clean.split(":=")[0].strip()
                    for pname in names_part.split(","):
                        pname = pname.strip()
                        if not pname:
                            continue
                        # try to enrich Unknown types via registry
                        t = type_clean
                        if not t or t == "Unknown":
                            t = _resolve_var_type_from_registry(pname, cf_data)
                        _add(pname, t, "param",
                             source=f"{dir_kw} parameter")

            # ── PASS 2: standard locals / globals / constants ─────────────
            for scope_name, scope_dict, is_const in [
                ("local",    locals_,  False),
                ("global",   globals_, False),
                ("constant", consts_,  True),
            ]:
                for vname, vtype in scope_dict.items():

                    # ── dotted name: Uplink.LineCentre ────────────────────
                    if "." in vname:
                        parts    = vname.split(".", 1)
                        rec_var  = parts[0]
                        field_nm = parts[1]

                        t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)

                        # if Unknown, try: 1) cf branch_body, 2) registry field lookup
                        if t in ("Unknown", "", None):
                            bv = cf_subp.get("branch_body_variables", {})
                            for k, v in bv.items():
                                if k.lower() == vname.lower():
                                    dt = v.get("data_type", {})
                                    t  = dt.get("type", "Unknown") if isinstance(dt, dict) else str(dt)
                                    break

                        if t in ("Unknown", "", None):
                            # get the record variable's declared type from registry
                            rec_type = _resolve_var_type_from_registry(rec_var, cf_data)
                            if rec_type not in ("Unknown", "", None):
                                t = _resolve_field_type(rec_type, field_nm, cf_data)

                        key = vname.lower()
                        if key not in seen:
                            seen.add(key)
                            variables.append({
                                "name":            vname,
                                "type":            t,
                                "type_normalized": t.lower(),
                                "scope":           scope_name,
                                "constraint":      _type_constraint(t),
                                "initial_value":   _initial_value_from_cf(cf_subp, vname),
                                "source":          f"field of {rec_var}",
                                "record_parent":   rec_var,
                                "record_field":    field_nm,
                                "type_mismatch":   False,
                            })
                        continue

                    t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)

                    # if Unknown, try registry
                    if t in ("Unknown", "", None):
                        t = _resolve_var_type_from_registry(vname, cf_data)

                    init = ""
                    if is_const:
                        init = (vtype.get("value", "") or
                                vtype.get("initial_value", "") or
                                vtype.get("init", "")
                                if isinstance(vtype, dict) else "")
                        if not init:
                            init = _initial_value_from_cf(cf_subp, vname)

                    _add(vname, t, scope_name, initial=init)

            # ── PASS 3: loop / conditional body vars (deep scan) ──────────
            for entry in _cf_all_vars(cf_subp):
                vname = entry["name"]
                t     = entry["type"]

                if "." in vname:
                    parts    = vname.split(".", 1)
                    rec_var  = parts[0]
                    field_nm = parts[1]
                    if t in ("Unknown", "", None):
                        rec_type = _resolve_var_type_from_registry(rec_var, cf_data)
                        if rec_type not in ("Unknown", "", None):
                            t = _resolve_field_type(rec_type, field_nm, cf_data)
                    key = vname.lower()
                    if key not in seen:
                        seen.add(key)
                        variables.append({
                            "name":            vname,
                            "type":            t,
                            "type_normalized": t.lower(),
                            "scope":           "loop/cond",
                            "constraint":      _type_constraint(t),
                            "initial_value":   entry.get("initial_value", ""),
                            "source":          f"field of {rec_var} (in {entry.get('source','')})",
                            "record_parent":   rec_var,
                            "record_field":    field_nm,
                        })
                else:
                    _add(vname, t, "loop/cond",
                         initial=entry.get("initial_value", ""),
                         source=entry.get("source", ""))

            # parse raw param strings into structured list
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

    return jsonify(out)


@app.route("/api/test/run", methods=["POST"])
def run_test():
    body      = request.get_json(silent=True) or {}
    subp_name = body.get("subprogram")
    inputs    = body.get("inputs", {})
    expected  = body.get("expected", {})
    if not subp_name:
        return jsonify({"error": "subprogram required"}), 400
    result  = _simulate_execution(subp_name, inputs, expected)
    test_id = str(uuid.uuid4())[:8]
    _test_results[test_id] = {
        "id": test_id, "subprogram": subp_name,
        "inputs": inputs, "expected": expected,
        "timestamp": time.strftime("%H:%M:%S"),
        **result,
    }
    return jsonify({"test_id": test_id, **result})


@app.route("/api/test/results", methods=["GET"])
def get_results():
    subp    = request.args.get("subprogram")
    results = list(_test_results.values())
    if subp:
        results = [r for r in results if r["subprogram"] == subp]
    return jsonify(results)


@app.route("/api/test/clear", methods=["POST"])
def clear_results():
    _test_results.clear()
    return jsonify({"ok": True})


@app.route("/api/export", methods=["GET"])
def export_report():
    return jsonify({
        "project_path": _project_path,
        "analysis":     _analysis_result,
        "test_results": list(_test_results.values()),
        "exported_at":  time.strftime("%Y-%m-%dT%H:%M:%S"),
    })


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "ok":       True,
        "analyzed": bool(_analysis_result),
        "files":    len(_analysis_result.get("file_paths", [])),
        "subprograms": sum(
            len(v) for v in _analysis_result.get("subprogram_index", {}).values()
        ),
    })


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Ada Test Studio API")
    parser.add_argument("--path",  default="", help="Ada project path to analyze on startup")
    parser.add_argument("--port",  type=int, default=5050)
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    if args.path:
        print(f"[INFO] Analyzing on startup: {args.path}")
        _run_analysis(args.path)
    else:
        # auto-analyze the test folder next to this file if it exists
        default = Path(__file__).parent / "testada_caseinsensitive"
        if default.exists():
            print(f"[INFO] Auto-analyzing default test path: {default}")
            _run_analysis(str(default))

    print(f"[INFO] Ada Test Studio API → http://localhost:{args.port}")
    app.run(debug=args.debug, port=args.port)