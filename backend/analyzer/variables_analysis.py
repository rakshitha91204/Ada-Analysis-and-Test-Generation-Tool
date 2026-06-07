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
        try:
            if obj.f_type_expr:
                return obj.f_type_expr.text.strip()
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

    def extract(self):
        # Pass 1: all package-level globals across every unit
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
                            ptype = param.f_type_expr.text.strip()
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

                # Local variables
                for obj in subp.findall(lal.ObjectDecl):
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
                        lhs = assign.f_dest.text.strip()
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

                # Legacy compatibility keys — properly populated for old consumers
                # Build {subp_name: {var_name: {"type": type_str}}} from globals that are used by each subprogram
                legacy_global_vars: dict = {}
                legacy_global_consts: dict = {}
                for subp_n, usage in global_usage.items():
                    gv: dict = {}
                    gc: dict = {}
                    for gname in usage.get("reads", []) + usage.get("writes", []):
                        meta = all_globals.get(gname.lower(), {})
                        entry = {"type": meta.get("type", "Unknown")}
                        if meta.get("is_constant"):
                            gc[gname] = entry
                        else:
                            gv[gname] = entry
                    legacy_global_vars[subp_n] = gv
                    legacy_global_consts[subp_n] = gc

                # Also include subprograms with locals even if no global usage
                all_subp_names = set(v["subprogram"] for v in locals_list)
                for subp_n in all_subp_names:
                    if subp_n not in legacy_global_vars:
                        legacy_global_vars[subp_n] = {}
                        legacy_global_consts[subp_n] = {}

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
                    # Legacy compatibility keys — properly populated
                    "global_variables": legacy_global_vars,
                    "global_constants": legacy_global_consts,
                    "local_variables":  {
                        subp_n: {v["name"]: {"type": v["type"]} for v in locals_list if v["subprogram"] == subp_n}
                        for subp_n in all_subp_names
                    },
                }

        return result
