# Ada Global Variable Analyzer (Libadalang + GPR Project)
# Python script:

import libadalang as lal
import sys


# -------------------------------------------------------------
# Extract identifiers from a declaration
# Example:  A, B : Integer;
# -------------------------------------------------------------
def get_decl_ids(decl):

    ids = []

    if hasattr(decl, "f_ids") and decl.f_ids:
        for ident in decl.f_ids:
            ids.append(ident.text)

    return ids


# -------------------------------------------------------------
# Get parameters of a subprogram
# -------------------------------------------------------------
def get_parameters(subp):

    params = set()

    spec = subp.f_subp_spec

    if spec and spec.f_subp_params:

        for param in spec.f_subp_params.f_params:

            for ident in param.f_ids:
                params.add(ident.text)

    return params


# -------------------------------------------------------------
# Get local variables declared inside subprogram
# -------------------------------------------------------------
def get_local_variables(subp):

    locals_set = set()

    for decl in subp.findall(lal.ObjectDecl):

        if subp.is_ancestor_of(decl):

            for name in get_decl_ids(decl):
                locals_set.add(name)

    return locals_set


# -------------------------------------------------------------
# Detect read/write usage of variables
# -------------------------------------------------------------
def analyze_variable_usage(subp):

    globals_read = {}
    globals_written = {}

    params = get_parameters(subp)
    locals_set = get_local_variables(subp)

    for name in subp.findall(lal.Name):

        decl = name.p_referenced_decl()

        if decl is None:
            continue

        if decl.kind_name != "ObjectDecl":
            continue

        var_name = name.text

        if var_name in params or var_name in locals_set:
            continue

        if not subp.is_ancestor_of(decl):

            file_declared = decl.unit.filename

            parent = name.parent

            # Write detection
            if isinstance(parent, lal.AssignStmt) and parent.f_dest == name:

                globals_written[var_name] = file_declared

            else:

                globals_read[var_name] = file_declared

    return globals_read, globals_written


# -------------------------------------------------------------
# Analyze a subprogram
# -------------------------------------------------------------
def analyze_subprogram(subp):

    subp_name = subp.f_subp_spec.f_subp_name.text

    print("\n--------------------------------")
    print("Subprogram:", subp_name)

    params = get_parameters(subp)
    locals_set = get_local_variables(subp)

    globals_read, globals_written = analyze_variable_usage(subp)

    print("\nParameters:")
    for p in params:
        print("  ", p)

    print("\nLocal variables:")
    for l in locals_set:
        print("  ", l)

    print("\nGlobal variables READ:")
    for g, file in globals_read.items():
        print("  ", g, "declared in", file)

    print("\nGlobal variables WRITTEN:")
    for g, file in globals_written.items():
        print("  ", g, "declared in", file)


# -------------------------------------------------------------
# Analyze all units in project
# -------------------------------------------------------------
def analyze_project(gpr_file):

    print("Loading project:", gpr_file)

    # Load project context
    ctx = lal.AnalysisContext()
    project = lal.Project(gpr_file)

    files = project.source_files()

    # Iterate through all units in project
    for filename in project.source_files():

        unit = ctx.get_from_file(filename)

        if unit.root is None:
            continue

        print("\n================================")
        print("Analyzing file:",filename)

        for subp in unit.root.findall(lal.SubpBody):
            analyze_subprogram(subp)


# -------------------------------------------------------------
# Main
# -------------------------------------------------------------
if __name__ == "__main__":

    # if len(sys.argv) < 2:
    #     print("Usage: python analyzer.py project.gpr")
    #     sys.exit(1)

    # gpr_file = sys.argv[1]
    gpr_file = "/aux2/users/ssss/UnitLevelTest/Rakshitha/leos_ult.gpr"
    analyze_project(gpr_file)
