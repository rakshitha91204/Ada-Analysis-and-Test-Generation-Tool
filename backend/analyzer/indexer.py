# indexer.py
import libadalang as lal


class SubprogramIndexer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _extract_params(spec) -> list:
        """Extract clean per-param strings from a SubpSpec node."""
        params = []
        try:
            if spec.f_subp_params:
                for param_decl in spec.f_subp_params.f_params:
                    raw = " ".join(param_decl.text.split())
                    params.append(raw)
        except Exception:
            pass
        return params

    @staticmethod
    def _return_type(spec):
        """Return the return type text or None."""
        try:
            if spec.f_subp_returns:
                return spec.f_subp_returns.text
        except Exception:
            pass
        return None

    def index(self) -> dict:
        """
        Index subprograms from both .adb (SubpBody) and .ads (SubpDecl) files.
        Bodies take priority over declarations.
        Deduplicates GLOBALLY across all units so Get_Glyph never appears twice.

        Returns: { filename: [{"name", "parameters", "return_type",
                                "start_line", "end_line", "is_declaration"}, ...] }
        """
        # Global dedup: name -> (filepath, entry)
        # If a body is found, it overrides any declaration
        global_bodies: dict = {}    # name_lower -> (filepath, entry)
        global_decls:  dict = {}    # name_lower -> (filepath, entry)

        for unit in self.units:
            # Pass 1: collect SubpBody (implementations) from .adb
            for node in unit.root.findall(lal.SubpBody):
                try:
                    spec = node.f_subp_spec
                    name = spec.f_subp_name.text
                    key  = name.lower()
                    entry = {
                        "name":           name,
                        "parameters":     self._extract_params(spec),
                        "return_type":    self._return_type(spec),
                        "start_line":     node.sloc_range.start.line,
                        "end_line":       node.sloc_range.end.line,
                        "is_declaration": False,
                    }
                    # Keep the first body found (overload resolution not supported)
                    if key not in global_bodies:
                        global_bodies[key] = (unit.filename, entry)
                    # Update params if the existing entry has none but this one does
                    elif not global_bodies[key][1]["parameters"] and entry["parameters"]:
                        global_bodies[key] = (unit.filename, entry)
                except Exception:
                    pass

            # Pass 2: collect SubpDecl (specs) from .ads
            for node in unit.root.findall(lal.SubpDecl):
                try:
                    spec = node.f_subp_spec
                    name = spec.f_subp_name.text
                    key  = name.lower()
                    entry = {
                        "name":           name,
                        "parameters":     self._extract_params(spec),
                        "return_type":    self._return_type(spec),
                        "start_line":     node.sloc_range.start.line,
                        "end_line":       node.sloc_range.end.line,
                        "is_declaration": True,
                    }
                    if key not in global_decls:
                        global_decls[key] = (unit.filename, entry)
                except Exception:
                    pass

        # Merge: body takes priority over declaration
        # Group by file
        per_file: dict = {}
        seen_globally: set = set()

        # Add all bodies first
        for key, (filepath, entry) in global_bodies.items():
            per_file.setdefault(filepath, []).append(entry)
            seen_globally.add(key)

        # Add declarations only if no body exists for that name
        for key, (filepath, entry) in global_decls.items():
            if key not in seen_globally:
                per_file.setdefault(filepath, []).append(entry)
                seen_globally.add(key)

        # Ensure every unit has an entry (even if empty)
        for unit in self.units:
            if unit.filename not in per_file:
                per_file[unit.filename] = []

        return per_file
