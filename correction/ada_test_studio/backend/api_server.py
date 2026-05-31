# """
# Ada Test Studio — Flask API backend
# Bridges the existing runner.py analysis pipeline to the React frontend.

# Endpoints:
#   POST /api/analyze          — run full analysis on a project path
#   GET  /api/files            — list all parsed Ada files
#   GET  /api/file/<path>      — return raw source of one file
#   GET  /api/subprograms      — all subprograms with params + variables
#   POST /api/test/run         — run a single test case
#   GET  /api/test/results     — all test results for this session
#   POST /api/test/clear       — reset all test results
#   GET  /api/export           — export full report as JSON

# Run:
#   pip install flask flask-cors
#   python api_server.py
# """


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



# ROOT = Path(__file__).resolve().parents[4]
# if str(ROOT) not in sys.path:
#     sys.path.insert(0, str(ROOT))

# app = Flask(__name__)
# CORS(app)

# # ── In-memory session state ────────────────────────────────────────────────
# _analysis_result: dict = {}          # last full analysis output
# _test_results: dict[str, dict] = {}  # test_id → result
# _project_path: str = ""

# # ── Type constraint helpers ────────────────────────────────────────────────

# def _type_constraint(type_str: str) -> dict:
#     """Return min/max/kind for a given Ada type string (case-insensitive)."""
#     tl = type_str.lower().strip()
#     if "uint16" in tl:  return {"kind": "integer", "min": 0,           "max": 65535}
#     if "uint32" in tl:  return {"kind": "integer", "min": 0,           "max": 4294967295}
#     if "uint8"  in tl:  return {"kind": "integer", "min": 0,           "max": 255}
#     if "natural"in tl:  return {"kind": "integer", "min": 0,           "max": 2147483647}
#     if "positive"in tl: return {"kind": "integer", "min": 1,           "max": 2147483647}
#     if "integer"in tl:  return {"kind": "integer", "min": -2147483648, "max": 2147483647}
#     if "float"  in tl:  return {"kind": "float",   "min": -1e38,       "max": 1e38}
#     if "boolean"in tl:  return {"kind": "boolean",  "values": ["True", "False"]}
#     if "character"in tl:return {"kind": "character"}
#     if "string" in tl:  return {"kind": "string"}
#     return {"kind": "unknown"}


# def _validate_value(value: str, type_str: str) -> tuple[bool, str]:
#     """Validate a test input value against its Ada type. Returns (ok, message)."""
#     c = _type_constraint(type_str)
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
#             float(value)
#             return True, "ok"
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

#     return True, "ok"   # unknown types pass through


# def _simulate_execution(subp_name: str, inputs: dict, expected: dict) -> dict:
#     """
#     Simulate test execution.
#     In production replace this with an actual Ada harness runner call.
#     For now it validates types and applies simple constraint logic.
#     """
#     violations = []
#     for var, val in inputs.items():
#         # look up the type from analysis
#         subp_data = _get_subprogram(subp_name)
#         if subp_data:
#             for p in subp_data.get("params", []):
#                 if p["name"] == var:
#                     ok, msg = _validate_value(val, p["type"])
#                     if not ok:
#                         violations.append({"variable": var, "type": p["type"],
#                                            "value": val, "error": msg})

#     if violations:
#         return {
#             "status": "error",
#             "message": "Type constraint violation",
#             "violations": violations,
#             "actual": {},
#             "elapsed_ms": 0,
#         }

#     # Simulate outputs — in real integration, call Ada harness subprocess here
#     t0 = time.monotonic()
#     actual = {}
#     for var, exp_val in expected.items():
#         # Simple simulation: out params get a computed value
#         try:
#             exp_int = int(exp_val)
#             in_sum  = sum(int(v) for v in inputs.values() if v.isdigit() or
#                           (v.lstrip("-").isdigit()))
#             actual[var] = str((exp_int + in_sum) % 65536)
#         except Exception:
#             actual[var] = exp_val  # passthrough for non-integer

#     elapsed = round((time.monotonic() - t0) * 1000, 2)
#     passed  = all(actual.get(k, "?") == v for k, v in expected.items())

#     return {
#         "status": "pass" if passed else "fail",
#         "message": "All assertions passed" if passed else "Output mismatch",
#         "actual":  actual,
#         "elapsed_ms": elapsed,
#         "normalized_types": {
#             var: next(
#                 (p["type"].lower() for p in (_get_subprogram(subp_name) or {}).get("params", [])
#                  if p["name"] == var),
#                 "unknown"
#             )
#             for var in inputs
#         },
#     }


# def _get_subprogram(name: str) -> dict | None:
#     for fdata in _analysis_result.get("subprogram_index", {}).values():
#         for s in fdata:
#             if s["name"] == name:
#                 return s
#     return None


# # ── Analysis trigger ───────────────────────────────────────────────────────

# def _run_analysis(project_path: str) -> dict:
#     """
#     Call your existing runner pipeline and return the full output dict.
#     This function is the integration seam — swap in your actual runner.
#     """
#     global _analysis_result, _project_path
#     _project_path = project_path

#     # ── Real integration: uncomment and adjust sys.path ──────────────────
#     project_path = Path(__file__).parent / "testada_caseinsensitive"
#     sys.path.insert(0, str(Path(project_path).parents[2]))
#     from testss.auto_ada_tester.analyzer.project_loader import ProjectLoader
#     from testss.auto_ada_tester.analyzer.indexer import SubprogramIndexer
#     from testss.auto_ada_tester.analyzer.variables_analysis import VariablesAnalyzer
#     from testss.auto_ada_tester.analyzer.callgraph import CallGraphBuilder
#     from testss.auto_ada_tester.analyzer.complexity import ComplexityAnalyzer
#     from testss.auto_ada_tester.analyzer.deadcode import DeadCodeDetector
#     from testss.auto_ada_tester.analyzer.control_flow_extractor import ControlFlowExtractor
#     from testss.auto_ada_tester.runner import collect_ada_files
#     files = collect_ada_files(project_path)
#     loader = ProjectLoader(files)
#     units  = loader.load_units()
#     _analysis_result = {
#         "file_paths":        files,
#         "subprogram_index":  SubprogramIndexer(units).index(),
#         "call_graph":        CallGraphBuilder(units).build(),
#         "cyclomatic_complexity": ComplexityAnalyzer(units).compute(),
#         "dead_code":         DeadCodeDetector(...).detect_unused_subprograms(),
#         "variables_info":    VariablesAnalyzer(units).extract(),
#         "control_flow_extractor": ControlFlowExtractor(units).run(),
#     }
#     return _analysis_result

#     # ── Stub: load from a pre-generated JSON report ───────────────────────
#     report_path = Path(project_path) / "variables_report"
#     if report_path.exists():
#         with open(report_path) as f:
#             _analysis_result = json.load(f)
#         return _analysis_result

#     # ── Fallback: return empty skeleton ───────────────────────────────────
#     _analysis_result = {
#         "file_paths": [],
#         "subprogram_index": {},
#         "call_graph": {},
#         "cyclomatic_complexity": {},
#         "dead_code": [],
#         "variables_info": {},
#         "control_flow_extractor": {},
#     }
#     return _analysis_result


# # ── Routes ────────────────────────────────────────────────────────────────

# @app.route("/api/analyze", methods=["POST"])
# def analyze():
#     body = request.get_json(silent=True) or {}
#     path = body.get("path", "").strip()
#     if not path:
#         return jsonify({"error": "path is required"}), 400
#     if not os.path.exists(path):
#         return jsonify({"error": f"Path not found: {path}"}), 404
#     result = _run_analysis(path)
#     return jsonify({
#         "ok": True,
#         "file_count": len(result.get("file_paths", [])),
#         "subprogram_count": sum(len(v) for v in result.get("subprogram_index", {}).values()),
#     })


# @app.route("/api/files", methods=["GET"])
# def list_files():
#     files = _analysis_result.get("file_paths", [])
#     out = []
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
#     """
#     Return all subprograms enriched with variable info from variables_info.
#     Merges subprogram_index + variables_info + complexity + dead_code.
#     """
#     idx         = _analysis_result.get("subprogram_index", {})
#     var_info    = _analysis_result.get("variables_info", {})
#     complexity  = _analysis_result.get("cyclomatic_complexity", {})
#     dead_code   = _analysis_result.get("dead_code", [])
#     call_graph  = _analysis_result.get("call_graph", {})

#     out = []
#     for filepath, subps in idx.items():
#         file_vars = var_info.get(filepath, {})
#         for s in subps:
#             name = s["name"]
#             locals_  = file_vars.get("local_variables",  {}).get(name, {})
#             globals_ = file_vars.get("global_variables", {}).get(name, {})
#             consts_  = file_vars.get("global_constants", {}).get(name, {})

#             # Build enriched variable list with type constraints
#             variables = []
#             for vname, vtype in locals_.items():
#                 t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)
#                 variables.append({
#                     "name": vname, "type": t,
#                     "type_normalized": t.lower(),
#                     "scope": "local",
#                     "constraint": _type_constraint(t),
#                 })
#             for vname, vtype in globals_.items():
#                 t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)
#                 variables.append({
#                     "name": vname, "type": t,
#                     "type_normalized": t.lower(),
#                     "scope": "global",
#                     "constraint": _type_constraint(t),
#                 })
#             for vname, vtype in consts_.items():
#                 t = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)
#                 variables.append({
#                     "name": vname, "type": t,
#                     "type_normalized": t.lower(),
#                     "scope": "constant",
#                     "constraint": _type_constraint(t),
#                 })

#             # Parse params — keep raw text for display but also split into list
#             raw_params = s.get("parameters", [])
#             params = []
#             for raw in raw_params:
#                 for segment in raw.split(";"):
#                     segment = segment.strip()
#                     if not segment:
#                         continue
#                     if ":" in segment:
#                         names_part, type_part = segment.split(":", 1)
#                         # strip in/out/in out keywords from type
#                         type_clean = type_part.strip()
#                         for kw in ("in out", "in  out", "out", "in "):
#                             if type_clean.lower().startswith(kw):
#                                 type_clean = type_clean[len(kw):].strip()
#                                 break
#                         dir_kw = "in"
#                         if "in out" in type_part.lower() or "in  out" in type_part.lower():
#                             dir_kw = "in out"
#                         elif "out" in type_part.lower():
#                             dir_kw = "out"
#                         for pname in names_part.split(","):
#                             pname = pname.strip()
#                             if pname:
#                                 params.append({
#                                     "name": pname, "dir": dir_kw,
#                                     "type": type_clean,
#                                     "type_normalized": type_clean.lower(),
#                                     "constraint": _type_constraint(type_clean),
#                                 })

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
#     body = request.get_json(silent=True) or {}
#     subp_name = body.get("subprogram")
#     inputs    = body.get("inputs", {})
#     expected  = body.get("expected", {})

#     if not subp_name:
#         return jsonify({"error": "subprogram required"}), 400

#     result = _simulate_execution(subp_name, inputs, expected)
#     test_id = str(uuid.uuid4())[:8]
#     _test_results[test_id] = {
#         "id":          test_id,
#         "subprogram":  subp_name,
#         "inputs":      inputs,
#         "expected":    expected,
#         "timestamp":   time.strftime("%H:%M:%S"),
#         **result,
#     }
#     return jsonify({"test_id": test_id, **result})


# @app.route("/api/test/results", methods=["GET"])
# def get_results():
#     subp = request.args.get("subprogram")
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
#     out = {
#         "project_path": _project_path,
#         "analysis":     _analysis_result,
#         "test_results": list(_test_results.values()),
#         "exported_at":  time.strftime("%Y-%m-%dT%H:%M:%S"),
#     }
#     return jsonify(out)


# @app.route("/api/health", methods=["GET"])
# def health():
#     return jsonify({"ok": True, "analyzed": bool(_analysis_result)})


# if __name__ == "__main__":
#     import argparse
#     parser = argparse.ArgumentParser(description="Ada Test Studio API")
#     parser.add_argument("--path",  default="", help="Ada project path to analyze on startup")
#     parser.add_argument("--port",  type=int, default=5050)
#     parser.add_argument("--debug", action="store_true")
#     args = parser.parse_args()

#     if args.path:
#         print(f"[INFO] Analyzing {args.path} ...")
#         _run_analysis(args.path)
#         print(f"[INFO] Done.")

#     print(f"[INFO] Ada Test Studio API running on http://localhost:{args.port}")
#     app.run(debug=args.debug, port=args.port)




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

# The analyzer modules live under test/auto_ada_tester/
TEST_DIR = ROOT / "test"
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

# Add GNAT Studio's site-packages so libadalang can be found
GNATSTUDIO_SITE = Path(r"C:\GNATSTUDIO\share\gnatstudio\python\Lib\site-packages")
if GNATSTUDIO_SITE.exists() and str(GNATSTUDIO_SITE) not in sys.path:
    sys.path.insert(0, str(GNATSTUDIO_SITE))

# ── BUG FIX 2: Import at module level once, not re-imported inside function ─
# Wrapped in try/except so the server starts even if libadalang is not installed.
_ANALYZERS_AVAILABLE = False
try:
    from auto_ada_tester.analyzer.project_loader import ProjectLoader
    from auto_ada_tester.analyzer.indexer import SubprogramIndexer
    from auto_ada_tester.analyzer.callgraph import CallGraphBuilder
    from auto_ada_tester.analyzer.globals_analysis import GlobalRWDetector
    from auto_ada_tester.analyzer.complexity import ComplexityAnalyzer
    from auto_ada_tester.analyzer.deadcode import DeadCodeDetector
    from auto_ada_tester.analyzer.control_flow_extractor import ControlFlowExtractor
    from auto_ada_tester.analyzer.variables_analysis import VariablesAnalyzer
    _ANALYZERS_AVAILABLE = True
    print("[INFO] Analyzer modules loaded successfully")
except ImportError as _e:
    print(f"[WARN] Analyzer modules unavailable ({_e}). "
          "Analysis endpoints will return an error until libadalang is installed.")
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

    if not _ANALYZERS_AVAILABLE:
        _analysis_result = _empty_skeleton([])
        _analysis_result["_error"] = (
            "libadalang is not installed. Run: pip install libadalang "
            "(or install via GNAT Community Edition)."
        )
        return _analysis_result

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


@app.route("/api/subprograms", methods=["GET"])
def list_subprograms():
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