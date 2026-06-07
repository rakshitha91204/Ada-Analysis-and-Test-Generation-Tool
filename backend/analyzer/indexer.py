# indexer.py
import libadalang as lal


class SubprogramIndexer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _is_top_level(node) -> bool:
        """
        Return True if this subprogram is NOT nested inside another SubpBody.
        Ada allows nested subprograms; we only want the outermost ones.
        """
        parent = node.parent
        while parent:
            if isinstance(parent, lal.SubpBody):
                return False
            parent = parent.parent
        return True

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
                t = spec.f_subp_returns.text
                if t and t.strip():
                    return t.strip()
        except Exception:
            pass
        return None

    @staticmethod
    def _is_function(spec) -> bool:
        """True if this spec is a function (has return type or kind=SubpKindFunction)."""
        # Primary: check for return type
        try:
            if spec.f_subp_returns and spec.f_subp_returns.text.strip():
                return True
        except Exception:
            pass
        # Secondary: check subp_kind node
        try:
            kind = spec.f_subp_kind
            if kind and "function" in kind.text.lower():
                return True
        except Exception:
            pass
        return False

    def index(self) -> dict:
        """
        Index TOP-LEVEL subprograms only (not nested helpers).
        Includes bodies from .adb and declarations from .ads.
        Bodies take priority over declarations.
        Deduplicates globally so no name appears twice.
        """
        global_bodies: dict = {}   # name_lower -> (filepath, entry)
        global_decls:  dict = {}   # name_lower -> (filepath, entry)

        for unit in self.units:
            # Pass 1: top-level SubpBody from .adb
            for node in unit.root.findall(lal.SubpBody):
                # Skip nested subprograms (local helpers inside another body)
                if not self._is_top_level(node):
                    continue
                try:
                    spec = node.f_subp_spec
                    name = spec.f_subp_name.text
                    key  = name.lower()
                    entry = {
                        "name":           name,
                        "parameters":     self._extract_params(spec),
                        "return_type":    self._return_type(spec),
                        "is_function":    self._is_function(spec),
                        "start_line":     node.sloc_range.start.line,
                        "end_line":       node.sloc_range.end.line,
                        "is_declaration": False,
                    }
                    # Body with params wins over body without params
                    if key not in global_bodies:
                        global_bodies[key] = (unit.filename, entry)
                    elif not global_bodies[key][1]["parameters"] and entry["parameters"]:
                        global_bodies[key] = (unit.filename, entry)
                except Exception:
                    pass

            # Pass 2: SubpDecl from .ads specs
            for node in unit.root.findall(lal.SubpDecl):
                if not self._is_top_level(node):
                    continue
                try:
                    spec = node.f_subp_spec
                    name = spec.f_subp_name.text
                    key  = name.lower()
                    entry = {
                        "name":           name,
                        "parameters":     self._extract_params(spec),
                        "return_type":    self._return_type(spec),
                        "is_function":    self._is_function(spec),
                        "start_line":     node.sloc_range.start.line,
                        "end_line":       node.sloc_range.end.line,
                        "is_declaration": True,
                    }
                    if key not in global_decls:
                        global_decls[key] = (unit.filename, entry)
                except Exception:
                    pass

        # Merge: bodies take priority, group by file
        per_file: dict = {}
        seen_globally: set = set()

        for key, (filepath, entry) in global_bodies.items():
            per_file.setdefault(filepath, []).append(entry)
            seen_globally.add(key)

        for key, (filepath, entry) in global_decls.items():
            if key not in seen_globally:
                per_file.setdefault(filepath, []).append(entry)
                seen_globally.add(key)

        for unit in self.units:
            if unit.filename not in per_file:
                per_file[unit.filename] = []

        return per_file
