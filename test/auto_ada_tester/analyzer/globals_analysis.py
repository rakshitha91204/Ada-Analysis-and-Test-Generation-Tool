# globals_analysis.py — per-subprogram R/W tracking with types and line numbers.
import libadalang as lal


class GlobalRWDetector:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _is_global(obj):
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
    def _is_constant(obj):
        try:
            return obj.f_has_constant.kind_name == "ConstantPresent"
        except Exception:
            return False

    def detect(self):
        # Step 1: collect all globals across all units
        all_globals: dict = {}
        for unit in self.units:
            for obj in unit.root.findall(lal.ObjectDecl):
                if not self._is_global(obj):
                    continue
                type_str = self._get_type(obj)
                is_const = self._is_constant(obj)
                try:
                    decl_line = obj.sloc_range.start.line
                except Exception:
                    decl_line = 0
                for ident in obj.f_ids:
                    name = ident.text
                    all_globals[name.lower()] = {
                        "name": name, "type": type_str,
                        "is_constant": is_const,
                        "declared_line": decl_line,
                        "declared_file": unit.filename,
                    }

        # Step 2: per-unit RW analysis
        result: dict = {}
        for unit in self.units:
            filename  = unit.filename
            read_by:  dict = {}
            write_by: dict = {}

            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                written_here: set = set()
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = assign.f_dest.text.strip()
                        key = lhs.lower()
                        if key in all_globals:
                            canonical = all_globals[key]["name"]
                            write_by.setdefault(canonical, [])
                            if subp_name not in write_by[canonical]:
                                write_by[canonical].append(subp_name)
                            written_here.add(canonical)
                    except Exception:
                        pass

                for name_node in subp.findall(lal.Name):
                    try:
                        n   = name_node.text.strip()
                        key = n.lower()
                        if key in all_globals:
                            canonical = all_globals[key]["name"]
                            if canonical not in written_here:
                                read_by.setdefault(canonical, [])
                                if subp_name not in read_by[canonical]:
                                    read_by[canonical].append(subp_name)
                    except Exception:
                        pass

            file_globals = {
                meta["name"]: {
                    "type": meta["type"],
                    "is_constant": meta["is_constant"],
                    "declared_line": meta["declared_line"],
                    "declared_file": meta["declared_file"],
                }
                for meta in all_globals.values()
                if meta["declared_file"] == filename
            }

            result[filename] = {
                "globals":  file_globals,
                "read_by":  read_by,
                "write_by": write_by,
                "read":     sorted(read_by.keys()),
                "write":    sorted(write_by.keys()),
            }

        return result
