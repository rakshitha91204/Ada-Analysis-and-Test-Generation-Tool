import json
from libadalang import Project, AnalysisContext

def analyze_subprogram(subprog):
    """Extract detailed info per subprogram."""
    info = {
        "name": subprog.name,
        "parameters": [p.definition.name + " : " + str(p.type_decl) for p in subprog.parameters],
        "return_type": str(subprog.return_type) if subprog.return_type else None,
        "start_line": subprog.body.start_line,
        "end_line": subprog.body.end_line,
        "locals": [],
        "loops": [],
        "exceptions": [],
        "tasks": [],
        "logic_summary": [],
        "cyclomatic_complexity": subprog.cyclomatic_complexity,
        "calls": [call.name for call in subprog.calls],
    }

    # Collect local variables
    for obj in subprog.body.findall("declared_objects"):
        info["locals"].append({
            "name": obj.name,
            "type": str(obj.type_decl),
            "mode": str(obj.mode)
        })

    # Detect loops
    for loop in subprog.body.findall("loop_statement"):
        loop_type = loop.loop_kind  # "for", "while", or simple loop
        info["loops"].append({"type": loop_type, "start_line": loop.start_line, "end_line": loop.end_line})

    # Detect exceptions
    for exc in subprog.body.findall("exception_handler"):
        info["exceptions"].append({
            "exception_names": [e.name for e in exc.names] if exc.names else ["others"],
            "start_line": exc.start_line,
            "end_line": exc.end_line
        })

    # Detect tasks & protected objects
    for task in subprog.body.findall("task_declaration"):
        info["tasks"].append({"name": task.name, "type": "task"})
    for prot in subprog.body.findall("protected_type_declaration"):
        info["tasks"].append({"name": prot.name, "type": "protected"})

    # Logic summary (high-level)
    for stmt in subprog.body.findall("statement"):
        info["logic_summary"].append(str(stmt).strip())

    return info

def run_advanced_analysis(project_path, source_files):
    project = Project(root=project_path, context=AnalysisContext())
    all_data = {"file_paths": source_files, "subprogram_index": {}, "call_graph": {}, "globals": {}}

    for file_path in source_files:
        unit = project.get_unit(file_path)
        file_subprograms = []

        for subprog in unit.subprograms:
            detailed_info = analyze_subprogram(subprog)
            file_subprograms.append(detailed_info)

            # Build call graph
            all_data["call_graph"][subprog.name] = detailed_info["calls"]

        all_data["subprogram_index"][file_path] = file_subprograms

        # Track global objects read/write usage
        globals_info = {"read": [], "write": []}
        for obj in unit.findall("declared_objects"):
            if obj.is_global:
                globals_info["read"].append(obj.name)  # could expand with access tracking
                globals_info["write"].append(obj.name)
        all_data["globals"][file_path] = globals_info

    return all_data

if __name__ == "__main__":
    source_files = ["/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/meta-analyzer.adb"]
    project_path = "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/"
    result = run_advanced_analysis(project_path, source_files)

    with open("advanced_analysis.json", "w") as f:
        json.dump(result, f, indent=4)

    print("Advanced analysis JSON generated successfully!")