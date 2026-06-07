# callgraph.py
import libadalang as lal

# Ada built-in types, keywords, and attribute names to exclude
_ADA_EXCLUDE = {
    "integer", "natural", "positive", "float", "boolean", "character",
    "string", "duration", "long_integer", "long_float", "short_integer",
    "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32", "int64",
    "wide_character", "wide_string", "standard",
    "true", "false", "null", "others",
    # Ada attributes (after ')
    "first", "last", "length", "range", "size", "pos", "val",
    "image", "value", "succ", "pred", "min", "max", "abs",
    # Common type conversion functions that aren't user subprograms
    "integer", "float", "natural", "positive",
}


class CallGraphBuilder:
    def __init__(self, units):
        self.units = units

    def build(self) -> dict:
        """
        Build a call graph: { caller_name: [callee_name, ...] }
        Only includes actual subprogram calls, not variable/record accesses.
        """
        # Collect ALL known subprogram names for precise filtering
        known_subprograms: set[str] = set()
        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    known_subprograms.add(subp.f_subp_spec.f_subp_name.text)
                except Exception:
                    pass
            for decl in unit.root.findall(lal.SubpDecl):
                try:
                    known_subprograms.add(decl.f_subp_spec.f_subp_name.text)
                except Exception:
                    pass
        known_lower = {n.lower() for n in known_subprograms}

        graph: dict = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    caller = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    continue

                callees: list[str] = []
                seen: set[str] = set()

                for call in subp.findall(lal.CallExpr):
                    try:
                        raw_name = call.f_name.text.strip()
                    except Exception:
                        continue

                    # Skip empty or already seen
                    if not raw_name or raw_name in seen:
                        continue

                    # Skip if it contains a dot (record access: Buffer.Set_Source)
                    # These are prefix calls — keep the full dotted name only if
                    # it looks like a method call (e.g. Buffer.Set_Pixel is valid)
                    if '.' in raw_name:
                        # Keep dotted calls (obj.Method) but skip plain record fields
                        # Heuristic: if the part after the dot looks like a call
                        # (starts with capital, not an attribute like .all .first)
                        parts = raw_name.split('.')
                        suffix = parts[-1].strip()
                        if not suffix or suffix.lower() in _ADA_EXCLUDE:
                            continue
                        # Include dotted calls as-is (they're method calls)
                        seen.add(raw_name)
                        callees.append(raw_name)
                        continue

                    name_lower = raw_name.lower()

                    # Skip known builtins / keywords
                    if name_lower in _ADA_EXCLUDE:
                        continue

                    # Skip standalone type names (CamelCase type conversion)
                    # These appear as CallExpr but are really type conversions
                    # Heuristic: all-uppercase single word with no '_' → likely a type
                    if raw_name == raw_name.upper() and '_' not in raw_name and len(raw_name) > 2:
                        if raw_name.lower() not in known_lower:
                            continue

                    seen.add(raw_name)
                    callees.append(raw_name)

                graph[caller] = callees

        return graph
