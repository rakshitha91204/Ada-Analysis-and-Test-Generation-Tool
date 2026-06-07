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
        Returns: { filename: [{"name", "parameters", "return_type",
                                "start_line", "end_line", "is_declaration"}, ...] }
        """
        result = {}

        for unit in self.units:
            subprograms = []
            seen_names: set = set()

            # 1. Subprogram bodies (.adb) — highest priority
            for node in unit.root.findall(lal.SubpBody):
                try:
                    spec = node.f_subp_spec
                    name = spec.f_subp_name.text
                    seen_names.add(name.lower())
                    subprograms.append({
                        "name":           name,
                        "parameters":     self._extract_params(spec),
                        "return_type":    self._return_type(spec),
                        "start_line":     node.sloc_range.start.line,
                        "end_line":       node.sloc_range.end.line,
                        "is_declaration": False,
                    })
                except Exception:
                    pass

            # 2. Subprogram declarations (.ads) — include if no body already indexed
            for node in unit.root.findall(lal.SubpDecl):
                try:
                    spec = node.f_subp_spec
                    name = spec.f_subp_name.text
                    # Don't duplicate if body already added
                    if name.lower() in seen_names:
                        continue
                    seen_names.add(name.lower())
                    subprograms.append({
                        "name":           name,
                        "parameters":     self._extract_params(spec),
                        "return_type":    self._return_type(spec),
                        "start_line":     node.sloc_range.start.line,
                        "end_line":       node.sloc_range.end.line,
                        "is_declaration": True,
                    })
                except Exception:
                    pass

            result[unit.filename] = subprograms

        return result
