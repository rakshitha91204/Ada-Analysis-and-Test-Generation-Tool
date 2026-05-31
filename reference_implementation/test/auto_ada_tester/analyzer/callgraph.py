# callgraph.py
import libadalang as lal

# Ada built-in types and keywords to exclude from call graph
_ADA_BUILTINS = {
    "integer", "natural", "positive", "float", "boolean", "character",
    "string", "duration", "long_integer", "long_float", "short_integer",
    "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64",
    "wide_character", "wide_string", "standard",
    "true", "false", "null", "others",
}

class CallGraphBuilder:
    def __init__(self, units):
        self.units = units

    def build(self):
        graph = {}

        # Collect all known subprogram names across all units for filtering
        known_subprograms: set[str] = set()
        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                known_subprograms.add(subp.f_subp_spec.f_subp_name.text)
            for decl in unit.root.findall(lal.SubpDecl):
                try:
                    known_subprograms.add(decl.f_subp_spec.f_subp_name.text)
                except Exception:
                    pass

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                caller = subp.f_subp_spec.f_subp_name.text
                callees: list[str] = []
                seen: set[str] = set()

                for call in subp.findall(lal.CallExpr):
                    try:
                        name = call.f_name.text
                    except Exception:
                        continue

                    # Skip if it looks like a type name (all-caps or known builtin)
                    if name.lower() in _ADA_BUILTINS:
                        continue

                    # Skip if it's the caller itself (recursion is fine but
                    # we still want to record it — just deduplicate)
                    if name in seen:
                        continue

                    seen.add(name)
                    callees.append(name)

                graph[caller] = callees

        return graph
