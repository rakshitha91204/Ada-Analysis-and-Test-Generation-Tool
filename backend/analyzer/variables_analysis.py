# variables_analysis.py — flat per-variable entries with line numbers,
# scope, mode, initializer, and global-usage tracking.
import libadalang as lal


class VariablesAnalyzer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _is_global_object(obj):
        parent = obj.parent
        while parent:
            if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
                return False
            parent = parent.parent
        return True

    @staticmethod
    def _get_type(obj):
        """Get the declared type string — try multiple strategies."""
        # Strategy 1: f_type_expr.text (most reliable)
        try:
            if obj.f_type_expr:
                t = obj.f_type_expr.text.strip()
                if t:
                    return t
        except Exception:
            pass

        # Strategy 2: p_type semantic resolution
        try:
            resolved = obj.p_type
            if resolved and hasattr(resolved, 'text') and resolved.text:
                return resolved.text.strip()
        except Exception:
            pass

        return "Unknown"

    @staticmethod
    def _get_default(obj):
        try:
            if obj.f_default_expr:
                return obj.f_default_expr.text.strip()
        except Exception:
            pass
        return None

    @staticmethod
    def _is_constant(obj):
        try:
            return obj.f_has_constant.kind_name == "ConstantPresent"
        except Exception:
            return False

    @staticmethod
    def _get_mode(param):
        try:
            mode = param.f_mode.text.strip()
            return mode if mode else "in"
        except Exception:
            return "in"

    def extract(self) -> dict:
        # Pass 1: collect ALL package-level globals across every unit
        all_globals: dict = {}
        for unit in self.units:
            for obj in unit.root.findall(lal.ObjectDecl):
                if not self._is_global_object(obj):
                    continue
                type_str = self._get_type(obj)
                is_const = self._is_constant(obj)
                default  = self._get_default(obj)
                try:
                    line = obj.sloc_range.start.line
                except Exception:
                    line = 0
                for ident in obj.f_ids:
                    name = ident.text
                    all_globals[name.lower()] = {
                        "name": name, "type": type_str,
                        "is_constant": is_const, "default": default,
                        "line": line, "file": unit.filename,
                    }

        # Pass 2: per-unit detailed extraction
        result: dict = {}
        for unit in self.units:
            filename = unit.filename
            globals_list:    list = []
            locals_list:     list = []
            parameters_list: list = []
            global_usage:    dict = {}

            # Package-level globals declared in THIS file
            for obj in unit.root.findall(lal.ObjectDecl):
                if not self._is_global_object(obj):
                    continue
                type_str = self._get_type(obj)
                is_const = self._is_constant(obj)
                default  = self._get_default(obj)
                try:
                    line = obj.sloc_range.start.line
                except Exception:
                    line = 0
                for ident in obj.f_ids:
                    globals_list.append({
                        "name": ident.text, "type": type_str,
                        "is_constant": is_const, "default": default, "line": line,
                    })

            # Per-subprogram: locals, parameters, global usage
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                # Parameters
                try:
                    for param in subp.f_subp_spec.f_subp_params.f_params:
                        ptype = "Unknown"
                        try:
                            if param.f_type_expr:
                                ptype = param.f_type_expr.text.strip() or "Unknown"
                        except Exception:
                            pass
                        mode = self._get_mode(param)
                        try:
                            pline = param.sloc_range.start.line
                        except Exception:
                            pline = 0
                        for pident in param.f_ids:
                            parameters_list.append({
                                "name": pident.text, "type": ptype,
                                "mode": mode, "line": pline, "subprogram": subp_name,
                            })
                except Exception:
                    pass

                # Local variables (skip nested subprogram bodies)
                for obj in subp.findall(lal.ObjectDecl):
                    parent = obj.parent
                    in_nested = False
                    while parent and parent != subp:
                        if isinstance(parent, lal.SubpBody):
                            in_nested = True
                            break
                        parent = parent.parent
                    if in_nested:
                        continue
                    type_str = self._get_type(obj)
                    is_const = self._is_constant(obj)
                    default  = self._get_default(obj)
                    try:
                        line = obj.sloc_range.start.line
                    except Exception:
                        line = 0
                    for ident in obj.f_ids:
                        locals_list.append({
                            "name": ident.text, "type": type_str,
                            "is_constant": is_const, "default": default,
                            "line": line, "subprogram": subp_name,
                        })

                # Global reads / writes
                reads:  set = set()
                writes: set = set()
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = assign.f_dest.text.strip().split('.')[0].split('(')[0].strip()
                        if lhs.lower() in all_globals:
                            writes.add(all_globals[lhs.lower()]["name"])
                    except Exception:
                        pass
                for name_node in subp.findall(lal.Name):
                    try:
                        n = name_node.text.strip()
                        if n.lower() in all_globals:
                            canonical = all_globals[n.lower()]["name"]
                            if canonical not in writes:
                                reads.add(canonical)
                    except Exception:
                        pass
                if reads or writes:
                    global_usage[subp_name] = {
                        "reads": sorted(reads),
                        "writes": sorted(writes),
                    }

            # ── Build legacy compat keys AFTER processing all subprograms ──
            all_subp_names = set(v["subprogram"] for v in locals_list)
            # Add subprogram names from params and global_usage too
            for v in parameters_list:
                all_subp_names.add(v["subprogram"])
            for subp_n in global_usage:
                all_subp_names.add(subp_n)

            legacy_global_vars: dict = {s: {} for s in all_subp_names}
            legacy_global_consts: dict = {s: {} for s in all_subp_names}

            for subp_n, usage in global_usage.items():
                for gname in usage.get("reads", []) + usage.get("writes", []):
                    meta = all_globals.get(gname.lower(), {})
                    entry = {"type": meta.get("type", "Unknown")}
                    if meta.get("is_constant"):
                        legacy_global_consts.setdefault(subp_n, {})[gname] = entry
                    else:
                        legacy_global_vars.setdefault(subp_n, {})[gname] = entry

            legacy_local_vars = {
                subp_n: {
                    v["name"]: {"type": v["type"]}
                    for v in locals_list if v["subprogram"] == subp_n
                }
                for subp_n in all_subp_names
            }

            result[filename] = {
                "globals":      globals_list,
                "locals":       locals_list,
                "parameters":   parameters_list,
                "global_usage": global_usage,
                "summary": {
                    "total_globals":   len(globals_list),
                    "total_constants": sum(1 for g in globals_list if g["is_constant"]),
                    "total_locals":    len(locals_list),
                    "total_params":    len(parameters_list),
                },
                # Legacy compatibility keys
                "global_variables": legacy_global_vars,
                "global_constants": legacy_global_consts,
                "local_variables":  legacy_local_vars,
            }

        return result
