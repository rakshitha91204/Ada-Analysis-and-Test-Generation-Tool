import os
import libadalang as lal
import networkx as nx
from graphviz import Digraph

PROJECT_PATH = "./"

# -----------------------------------
# 1. LOAD ADA PROJECT
# -----------------------------------

context = lal.AnalysisContext()
units = []

for file in os.listdir(PROJECT_PATH):
    if file.endswith(".adb") or file.endswith(".ads"):
        unit = context.get_from_file(os.path.join(PROJECT_PATH, file))
        units.append(unit)

# -----------------------------------
# 2. EXTRACT SUBPROGRAMS
# -----------------------------------

subprograms = {}
call_graph = nx.DiGraph()

for unit in units:
    for node in unit.root.findall(lal.SubpBody):
        name = node.f_subp_spec.f_subp_name.text
        subprograms[name] = node
        call_graph.add_node(name)

# -----------------------------------
# 3. RESOLVE CALLS
# -----------------------------------

for name, node in subprograms.items():
    for call in node.findall(lal.CallExpr):
        try:
            called = call.f_name.p_referenced_decl()
            if called:
                called_name = called.p_defining_name.text
                call_graph.add_edge(name, called_name)
        except:
            pass

# -----------------------------------
# 4. PRINT EXTRACTED DATA
# -----------------------------------

print("\n=== Subprograms Found ===")
for name in subprograms:
    print(" -", name)

print("\n=== Call Graph Edges ===")
for edge in call_graph.edges():
    print(" ", edge[0], "→", edge[1])

# -----------------------------------
# 5. RECURSION DETECTION
# -----------------------------------

cycles = list(nx.simple_cycles(call_graph))

print("\n=== Recursion Detection ===")
if cycles:
    for cycle in cycles:
        print(" Recursive cycle:", cycle)
else:
    print(" No recursion detected.")

# -----------------------------------
# 6. CALL DEPTH
# -----------------------------------

if nx.is_directed_acyclic_graph(call_graph):
    depth = nx.dag_longest_path_length(call_graph)
else:
    depth = "Graph contains cycles"

print("\n=== Call Depth ===")
print(" Max depth:", depth)

# -----------------------------------
# 7. SIMPLE ARCHITECTURE RULE
# -----------------------------------

# Example rule:
# "Math_Utils" layer must not call "UI"

LAYER_RULES = {
    "Core": ["Add", "Factorial"],
    "UI": []
}

print("\n=== Architecture Check ===")
violations = []

for source, target in call_graph.edges():
    if source in LAYER_RULES["Core"] and target in LAYER_RULES["UI"]:
        violations.append((source, target))

if violations:
    for v in violations:
        print(" Violation:", v)
else:
    print(" No architecture violations.")

# -----------------------------------
# 8. EXPORT GRAPH
# -----------------------------------

dot = Digraph()

for node in call_graph.nodes():
    dot.node(node)

for edge in call_graph.edges():
    dot.edge(edge[0], edge[1])

dot.render("call_graph", format="png", cleanup=True)

print("\nGraph exported as call_graph.png")
