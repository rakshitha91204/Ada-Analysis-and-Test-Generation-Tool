# import json
# from libadalang import AnalysisContext 
# # from libadalang import Project
# from libadalang import SubpDecl 
# import json

# # with open("../advance_anysis.json") as f:
# #     analysis_data = json.load(f)

# # Use analysis_data to generate tests/mocks automatically
# def analyze_subprogram(subprog):
#     """Extract detailed info per subprogram."""
#     info = {
#         "name": subprog.name,
#         "parameters": [p.definition.name + " : " + str(p.type_decl) for p in subprog.parameters],
#         "return_type": str(subprog.return_type) if subprog.return_type else None,
#         "start_line": subprog.body.start_line,
#         "end_line": subprog.body.end_line,
#         "locals": [],
#         "loops": [],
#         "exceptions": [],
#         "tasks": [],
#         "logic_summary": [],
#         "cyclomatic_complexity": subprog.cyclomatic_complexity,
#         "calls": [call.name for call in subprog.calls],
#     }

#     # Collect local variables
#     for obj in subprog.body.findall("declared_objects"):
#         info["locals"].append({
#             "name": obj.name,
#             "type": str(obj.type_decl),
#             "mode": str(obj.mode)
#         })

#     # Detect loops
#     for loop in subprog.body.findall("loop_statement"):
#         loop_type = loop.loop_kind  # "for", "while", or simple loop
#         info["loops"].append({"type": loop_type, "start_line": loop.start_line, "end_line": loop.end_line})

#     # Detect exceptions
#     for exc in subprog.body.findall("exception_handler"):
#         info["exceptions"].append({
#             "exception_names": [e.name for e in exc.names] if exc.names else ["others"],
#             "start_line": exc.start_line,
#             "end_line": exc.end_line
#         })

#     # Detect tasks & protected objects
#     for task in subprog.body.findall("task_declaration"):
#         info["tasks"].append({"name": task.name, "type": "task"})
#     for prot in subprog.body.findall("protected_type_declaration"):
#         info["tasks"].append({"name": prot.name, "type": "protected"})

#     # Logic summary (high-level)
#     for stmt in subprog.body.findall("statement"):
#         info["logic_summary"].append(str(stmt).strip())

#     return info

# def run_advanced_analysis(project_path, source_files):
#     ctx = AnalysisContext()
    
#     all_data = {"file_paths": source_files, "subprogram_index": {}, "call_graph": {}, "globals": {}}

#     for file_path in source_files:
#         unit = ctx.get_from_file(file_path)
#         file_subprograms = []

#         # for subprog in unit.subprograms:
#         #     detailed_info = analyze_subprogram(subprog)
#         for subprog in unit.root.findall(SubpDecl):
#             detailed_info = analyze_subprogram(subprog)
#             file_subprograms.append(detailed_info)

#             # Build call graph
#             all_data["call_graph"][subprog.name] = detailed_info["calls"]

#         all_data["subprogram_index"][file_path] = file_subprograms

#         # Track global objects read/write usage
#         globals_info = {"read": [], "write": []}
#         for obj in unit.findall("declared_objects"):
#             if obj.is_global:
#                 globals_info["read"].append(obj.name)  # could expand with access tracking
#                 globals_info["write"].append(obj.name)
#         all_data["globals"][file_path] = globals_info

#     return all_data

# if __name__ == "__main__":
#     source_files = ["/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/meta-analyzer.adb"]
#     project_path = "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/"
#     result = run_advanced_analysis(project_path, source_files)

#     with open("advanced_analysis.json", "w") as f:
#         json.dump(result, f, indent=4)

#     print("Advanced analysis JSON generated successfully!")



import json
from logging import info
from platform import node
from libadalang import AnalysisContext

from ast_test import run_advanced_analysis
from ast_test import run_advanced_analysis
# def analyze_subprogram(subprog):
#     """Extract detailed info per subprogram."""
#     info = {
#         "name": getattr(subprog, "name", "unknown"),
#         "parameters": [f"{getattr(p, 'name', '')} : {getattr(p, 'type_', 'Unknown')}" for p in getattr(subprog, "parameters", [])],
#         "return_type": str(getattr(subprog, "return_type", None)) if getattr(subprog, "return_type", None) else None,
#         "start_line": getattr(subprog, "start_line", None),
#         "end_line": getattr(subprog, "end_line", None),
#         "locals": [],
#         "loops": [],
#         "exceptions": [],
#         "tasks": [],
#         "logic_summary": [],
#         "cyclomatic_complexity": getattr(subprog, "cyclomatic_complexity", 0),
#         "calls": [getattr(call, "name", "") for call in getattr(subprog, "calls", [])],
#     }

#     # Local variables
#     for obj in subprog.findall(lambda node: getattr(node, "kind", "") == "object_declaration"):
#         info["locals"].append({
#             "name": getattr(obj, "name", "unknown"),
#             "type": str(getattr(obj, "type_", "unknown")),
#             "mode": str(getattr(obj, "mode", "unknown"))
#         })

#     # Loops
#     for loop in subprog.findall(lambda node: getattr(node, "kind", "") == "loop_statement"):
#         info["loops"].append({
#             "type": getattr(loop, "loop_kind", "loop"),
#             "start_line": getattr(loop, "start_line", None),
#             "end_line": getattr(loop, "end_line", None)
#         })

#     # Exceptions
#     for exc in subprog.findall(lambda node: getattr(node, "kind", "") == "exception_handler"):
#         info["exceptions"].append({
#             "exception_names": [e.name for e in getattr(exc, "names", [])] if getattr(exc, "names", None) else ["others"],
#             "start_line": getattr(exc, "start_line", None),
#             "end_line": getattr(exc, "end_line", None)
#         })

#     # Tasks & protected objects
#     for task in subprog.findall(lambda node: getattr(node, "kind", "") in ["task_declaration", "protected_type_declaration"]):
#         info["tasks"].append({
#             "name": getattr(task, "name", "unknown"),
#             "type": "task" if node.kind == "task_declaration" else "protected"
#         })

#     # Logic summary
#     for stmt in subprog.findall(lambda node: getattr(node, "kind", "") == "statement"):
#         info["logic_summary"].append(str(stmt).strip())

#     return info

# def run_advanced_analysis(source_files):
#     # --- Performance indicators ---
#     # Count nested loops and function call depth
#     info["performance"] = {
#         "nested_loops": sum(1 for _ in subprog.findall(lambda n: getattr(n, "kind","") == "loop_statement")),
#         "function_call_depth": len(info["calls"])  # simple depth estimation
#     }
    
#     # --- Logical errors placeholder ---
#     # You can add rules for uninitialized variables or unreachable code
#     info["logical_errors"] = []
    
#     # --- Bug detection / metrics ---
#     # Example: flag if function has no return but is expected to return
#     if getattr(subprog, "return_type", None) and "return" not in info["logic_summary"]:
#         info["logical_errors"].append("Missing return statement")
#     ctx = AnalysisContext()
#     all_data = {
#         "file_paths": source_files,
#         "subprogram_index": {},
#         "call_graph": {},
#         "globals": {}
#     }

#     for file_path in source_files:
#         unit = ctx.get_from_file(file_path)
#         file_subprograms = []

#         # Subprograms
#         for subprog in unit.root.findall(lambda node: getattr(node, "kind", "") == "subprogram_declaration"):
#             detailed_info = analyze_subprogram(subprog)
#             file_subprograms.append(detailed_info)
#             all_data["call_graph"][getattr(subprog, "name", "unknown")] = detailed_info["calls"]

#         all_data["subprogram_index"][file_path] = file_subprograms

#         # Global variables
#         globals_info = {"read": [], "write": []}
#         for obj in unit.root.findall(lambda node: getattr(node, "kind", "") == "object_declaration" and getattr(node, "is_global", False)):
#             globals_info["read"].append(getattr(obj, "name", "unknown"))
#             globals_info["write"].append(getattr(obj, "name", "unknown"))

#         all_data["globals"][file_path] = globals_info

#     return all_data

def analyze_subprogram(subprog):
    """Extract detailed info per subprogram."""
    info = {
        "name": getattr(subprog, "name", "unknown"),
        "parameters": [f"{getattr(p, 'name', '')} : {getattr(p, 'type_', 'Unknown')}" for p in getattr(subprog, "parameters", [])],
        "return_type": str(getattr(subprog, "return_type", None)) if getattr(subprog, "return_type", None) else None,
        "start_line": getattr(subprog, "start_line", None),
        "end_line": getattr(subprog, "end_line", None),
        "locals": [],
        "loops": [],
        "exceptions": [],
        "tasks": [],
        "logic_summary": [],
        "cyclomatic_complexity": getattr(subprog, "cyclomatic_complexity", 0),
        "calls": [getattr(call, "name", "") for call in getattr(subprog, "calls", [])],
        "performance": {},
        "logical_errors": []
    }

    # Local variables
    for obj in subprog.findall(lambda node: getattr(node, "kind", "") == "object_declaration"):
        info["locals"].append({
            "name": getattr(obj, "name", "unknown"),
            "type": str(getattr(obj, "type_", "unknown")),
            "mode": str(getattr(obj, "mode", "unknown"))
        })

    # Loops
    loops = list(subprog.findall(lambda node: getattr(node, "kind", "") == "loop_statement"))
    for loop in loops:
        info["loops"].append({
            "type": getattr(loop, "loop_kind", "loop"),
            "start_line": getattr(loop, "start_line", None),
            "end_line": getattr(loop, "end_line", None)
        })

    # Exceptions
    for exc in subprog.findall(lambda node: getattr(node, "kind", "") == "exception_handler"):
        info["exceptions"].append({
            "exception_names": [e.name for e in getattr(exc, "names", [])] if getattr(exc, "names", None) else ["others"],
            "start_line": getattr(exc, "start_line", None),
            "end_line": getattr(exc, "end_line", None)
        })

    # Tasks / protected objects
    for task in subprog.findall(lambda node: getattr(node, "kind", "") in ["task_declaration", "protected_type_declaration"]):
        info["tasks"].append({
            "name": getattr(task, "name", "unknown"),
            "type": "task" if getattr(task, "kind", "") == "task_declaration" else "protected"
        })

    # Logic summary
    for stmt in subprog.findall(lambda node: getattr(node, "kind", "") == "statement"):
        info["logic_summary"].append(str(stmt).strip())

    # --- Performance indicators ---
    info["performance"] = {
        "nested_loops": len(loops),
        "function_call_depth": len(info["calls"])
    }

    # --- Logical errors placeholder ---
    if getattr(subprog, "return_type", None) and "return" not in "".join(info["logic_summary"]):
        info["logical_errors"].append("Missing return statement")

    return info

    

if __name__ == "__main__":
    source_files = [
        "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/meta-analyzer.adb"
    ]
    result = run_advanced_analysis(source_files)

    with open("advanced_analysis.json", "w") as f:
        json.dump(result, f, indent=4)

    print("Advanced analysis JSON generated successfully!")