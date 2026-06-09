# # runner.py
# import sys
# from analyzer.project_loader import ProjectLoader
# from analyzer.indexer import SubprogramIndexer
# from analyzer.callgraph import CallGraphBuilder
# from analyzer.globals_analysis import GlobalRWDetector
# from analyzer.complexity import ComplexityAnalyzer
# from analyzer.deadcode import DeadCodeDetector
# from output_writer import OutputWriter
# # ROOT = Path(__file__).resolve().parents[2]
# # if str(ROOT) not in sys.path:
# #     sys.path.insert(0, str(ROOT))
# def run_analysis(files):

#     loader = ProjectLoader(files)
#     units = loader.load_units()

#     indexer = SubprogramIndexer(units)
#     subprograms = indexer.index()

#     callgraph = CallGraphBuilder(units).build()
#     globals_rw = GlobalRWDetector(units).detect()
#     complexity = ComplexityAnalyzer(units).compute()

#     deadcode = DeadCodeDetector(callgraph).detect_unused_subprograms()

#     output = {
#         "subprogram_index": subprograms,
#         "call_graph": callgraph,
#         "global_read_write": globals_rw,
#         "cyclomatic_complexity": complexity,
#         "dead_code": deadcode
#     }

#     OutputWriter().write(output)



#*****************************************************
# parse and generate real value
#*****************************************************




# runner.py

import os
import sys
import libadalang as lal
from pathlib import Path
from analyzer.project_loader import ProjectLoader
from analyzer.indexer import SubprogramIndexer
from analyzer.callgraph import CallGraphBuilder
from analyzer.globals_analysis import GlobalRWDetector
from analyzer.complexity import ComplexityAnalyzer
from analyzer.deadcode import DeadCodeDetector
from output_writer import OutputWriter
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from analyzer.variables_analysis import VariablesAnalyzer
from analyzer.loop_analysis import LoopAnalyzer
from analyzer.exception_analysis import ExceptionAnalyzer
from analyzer.concurrency import ConcurrencyAnalyzer
from analyzer.logical_error import LogicalErrorDetector
from analyzer.performance import PerformanceAnalyzer

from generators.harness_generator import TestHarnessGenerator
from generators.mock_generator import MockStubGenerator

# # ==============================
# # 🔥 GIVE YOUR ADA PATH HERE
# # ==============================
# path = "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/"   # <-- CHANGE THIS

# path = "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/attachments"
path = "/home/ssss/Desktop/Libada_test_project/Rakshitha/src"

# def collect_ada_files(path):
#     ada_files = []

#     if os.path.isfile(path):
#         ada_files.append(path)

#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))

#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")

#     return ada_files

# def is_global_object(obj):
#   parent = obj.parent
#   while parent:
#     if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#         return False
#     parent = parent.parent

#   return True  


# if __name__ == "__main__":

#     ada_files = collect_ada_files(path)

#     print(f"Found {len(ada_files)} Ada files.")
#   #  run_analysis(ada_files)

# #    provider = lal.UnitProvider.from_files(ada_files)

#     ctx = lal.AnalysisContext(
#         unit_provider=lal.UnitProvider.auto([path])
#        # unit_provider= lal._unit_provider.from_address
#     )

#     ads_files = [f for f in ada_files if f.endswith(".ads")]
#     adb_files = [f for f in ada_files if f.endswith(".adb")]

#     units = []
#     for f in ads_files:
#        u = ctx.get_from_file(f)
#        units.append(u)

#     for f in adb_files:
#         u = ctx.get_from_file(f)    
#         units.append(u)

#     for u in units:
#         _ = u.root 

#     global_nodes = set()

#     global_nodes_constant = set()
#     for unit in units:
#         if not unit.filename.endswith(".ads"):
#             continue

#         root = unit.root

#         for obj in root.findall(lal.ObjectDecl):
#             if is_global_object(obj):
#                 for name in obj.f_ids:
#                   n = name.text
#                   if obj.f_has_constant.kind_name == "ConstantPresent":
#                     global_nodes_constant.add(n)  
#                   else:
#                     global_nodes.add(n)


#     global_set = set(global_nodes)     
#     for unit in units:
#         if not unit.filename.endswith(".adb"):
#             continue
   
#         for subp in unit.root.findall(lal.SubpBody):
#             print("\nSubprogram:", subp.f_subp_spec.f_subp_name.text)     
                    
#             for name in subp.findall(lal.Name):
#                text = name.text

#                if text in global_nodes:
#                  print("Uses global variable:", text)
#                elif text in global_nodes_constant:
#                  print("Uses global constant:", text)

                 ##local
                 ##right side of the assignment operator but not local and global are your global calls.
    





# ************************************
#   TEST for data type
# ************************************

# import libadalang as lal
# import os

# def analyze_file(context, filepath):
#     unit = context.get_from_file(filepath)

#     if unit.diagnostics:
#         print(f"Errors in {filepath}:")
#         for diag in unit.diagnostics:
#             print(diag)
#         return

#     print(f"\nProcessing: {filepath}")

#     def explore(node, scope="global"):
#         # Detect subprograms (procedures/functions) to track local scope
#         # if isinstance(node, lal.SubpBody) or isinstance(node, lal.SubpSpec):
#             # scope = f"subprogram: {node.f_subp_name.text}"
#         if isinstance(node, lal.SubpBody):
#             scope = f"subprogram: {node.f_subp_spec.f_subp_name.text}"
#         elif isinstance(node, lal.SubpSpec):
#             scope = f"subprogram: {node.f_subp_name.text}"

#         # Detect variable declarations
#         if isinstance(node, lal.ObjectDecl):
#             # Variable names
#             names = [n.text for n in node.f_ids]

#             # Declared type (syntactic)
#             type_expr = node.f_type_expr.text if node.f_type_expr else "Unknown"

#             # Semantic type (resolved)
#             try:
#                 resolved_type = node.p_type
#                 resolved_type_name = resolved_type.name.text if resolved_type else "Unknown"
#             except:
#                 resolved_type_name = "Resolution failed"

#             print(f"\nScope: {scope}")
#             print(f"Variables: {', '.join(names)}")
#             print(f"Declared Type: {type_expr}")
#             print(f"Resolved Type: {resolved_type_name}")

#         # Recurse
#         for child in node.children:
#             if child:
#                 explore(child, scope)

#     explore(unit.root)


# def analyze_path(path):
#     context = lal.AnalysisContext()

#     if os.path.isfile(path):
#         analyze_file(context, path)
#     else:
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith(".adb") or file.endswith(".ads"):
#                     analyze_file(context, os.path.join(root, file))


# # 🔹 Provide your folder or file path here
# analyze_path("/home/ssss/Desktop/Libada_test_project/Rakshitha/src") 


















# Practice***************************

import libadalang as lal
import os 

# collect ada file
def collect_ada_file(path):
    ada_files= []
    for root, _, files in os.walk(path):
        for file in files:
            if file.endswith((".adb", ".ads")):
                ada_files.append(os.path.join(root,file))
        return ada_files
    
# extract full datted name
def get_full_name(node):
    if isinstance(node,lal.DottedName):
        return f"{get_full_name(node.f_prefix)}.{node.f_suffix.text}"
    elif isinstance(node, lal.Identifier):
        return node.text
    return " "

# Build type registry
def build_type_registry(units):
    type_registry = {}

    for unit in units:
        root=unit.root

        for type_decl in root.findall(lal.TypeDecl):
            type_name= type_decl.f_name #.text
            #  only handl record tpyes
            if isinstance(type_decl.f_type_def, lal.RecordTypeDef):
                field = {}

            for comp in type_decl.findall(lal.ComponentDecl):
                field_type=comp.f_component_def.f_type_expr.text
                for name in comp.f_ids:
                    field[name.text]= field_type
            type_registry[type_name]=field
    return type_registry
# dinter = lal._type_expr_p_type_name
#  analyze assignment

# test*****************
def build_variable_registry(units):
    var_registry={}
    for unit in units:
        for obj in unit.root.findall(lal.ObjectDecl):
            type_expr= obj.f_type_expr.text if obj.f_type_expr else None
            for name in obj.f_ids:
                var_registry[name.txt]=type_expr
    return var_registry

def get_full_name(node):
    if isinstance(node, lal.DottedName):
        return f"{get_full_name(node.f_prefix)}.{node.f_suffix.text}"
    elif isinstance(None,lal.Identifier):
        return node.text
    return ""
def resolve_rhs_type(rhs,var_registry):
    text= rhs.text
    if text.isupper():
        return text
    if text in var_registry:
        return var_registry[text]
    if isinstance(rhs,lal.DottedName):
        base = rhs.f_prefix.text
        if base in var_registry:
            return var_registry[base]
    return text

def analyze_assigments(units, type_registry, var_registry):
    results = {}

    for unit in units:
        # root = unit.root
        for assign in unit.root.findall(lal.AssignStmt):
            lhs = get_full_name(assign.f_dest)
            rhs= assign.f_expr
            rhs_type = resolve_rhs_type(assign.f_expr, var_registry)
            full_name = get_full_name(lhs)
            if not lhs:
                continue
            # try:
            #    rhs_type=rhs.text
            #    rhs_type=rhs.p_type.name.text
            # except:
                # rhs_type=rhs.text
            if rhs_type in type_registry:
                results[lhs]={rhs_type:type_registry[rhs_type]}
            else:
                results[lhs]=rhs_type
    return results

def analyze_path(path):

    ctx = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([path]))
    ada_files= collect_ada_file(path)
    units=[] 
    for f in ada_files:
         u = ctx.get_from_file(f)
         units.append(u)

    for u in units:
        _ = u.root
    type_registry = build_type_registry(units)
    var_registry = build_type_registry(units)
    print("\n TYPE REGISTRY")
    for k, v in type_registry.items():
        print(k,"=>",v)

    print("\n VARIABLE REGISTRY")
    for k, v in var_registry.items():
        print(k, "=>", v)
    results = analyze_assigments(units,type_registry, var_registry)
    print("\n FINAL OUTPUT: \n")
    for k,v in results.items():
        print(f"{k}:{v}")
#test******************


# def analyze_assigments(units, type_registry):
#     results = {}

#     for unit in units:
#         root = unit.root
#         for assign in root.findall(lal.AssignStmt):
#             lhs = assign.f_dest
#             rhs= assign.f_expr
#             full_name = get_full_name(lhs)
#             if not full_name:
#                 continue
#             try:
#             #    rhs_type=rhs.text
#                rhs_type=rhs.p_type.name.text
#             except:
#                 rhs_type=rhs.text
#             if rhs_type in type_registry:
#                 results[full_name] = {rhs_type:type_registry[rhs_type]}
#             else:
#                 results[full_name]=rhs_type
#     return results

# Main
# def analyze_path(path):

#     ctx = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([path]))
#     ada_files= collect_ada_file(path)
#     units=[] 
#     for f in ada_files:
#          u = ctx.get_from_file(f)
#          units.append(u)

#     for u in units:
#         _ = u.root
#     type_registry = build_type_registry(units)
#     print("\n TYPE REGISTRY")
#     for k, v in type_registry.items():
#         print(k,"=>",v)
#     results = analyze_assigments(units,type_registry)
#     print("\n FINAL OUTPUT: \n")
#     for k,v in results.items():
#         print(f"{k}:{v}")
    
analyze_path("/home/ssss/Desktop/Libada_test_project/Rakshitha/src") 
