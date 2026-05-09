# variables_analysis.py
import libadalang as lal


class VariablesAnalyzer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _is_global_object(obj):
        """Return True if ObjectDecl is not nested inside a subprogram or block."""
        parent = obj.parent
        while parent:
            if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
                return False
            parent = parent.parent
        return True

    @staticmethod
    def _get_type(obj):
        """Return the declared type text of an ObjectDecl, falling back to 'Unknown'."""
        try:
            if obj.f_type_expr:
                return obj.f_type_expr.text.strip()
        except Exception:
            pass
        return "Unknown"

    def extract(self):
        result = {}

        # Pass 1: collect global variables and constants from .ads files
        global_vars = {}    # name -> {"type": ...}
        global_consts = {}  # name -> {"type": ...}

        for unit in self.units:
            if not unit.filename.endswith(".ads"):
                continue
            for obj in unit.root.findall(lal.ObjectDecl):
                if not self._is_global_object(obj):
                    continue
                type_str = self._get_type(obj)
                is_const = False
                try:
                    is_const = obj.f_has_constant.kind_name == "ConstantPresent"
                except Exception:
                    pass
                for ident in obj.f_ids:
                    name = ident.text
                    if is_const:
                        global_consts[name] = {"type": type_str}
                    else:
                        global_vars[name] = {"type": type_str}

        # Pass 2: per-unit, per-subprogram analysis
        for unit in self.units:
            file_vars = {
                "global_variables": {},
                "global_constants": {},
                "local_variables": {},
            }

            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN_SUBP"

                file_vars["global_variables"][subp_name] = {}
                file_vars["global_constants"][subp_name] = {}
                file_vars["local_variables"][subp_name] = {}

                # Local variables declared inside this subprogram
                for obj in subp.findall(lal.ObjectDecl):
                    type_str = self._get_type(obj)
                    is_const = False
                    try:
                        is_const = obj.f_has_constant.kind_name == "ConstantPresent"
                    except Exception:
                        pass
                    for ident in obj.f_ids:
                        entry = {"type": type_str}
                        if is_const:
                            file_vars["global_constants"][subp_name][ident.text] = entry
                        else:
                            file_vars["local_variables"][subp_name][ident.text] = entry

                # Global variable/constant usage inside this subprogram
                for name_node in subp.findall(lal.Name):
                    try:
                        name = name_node.text
                    except Exception:
                        continue
                    if name in global_vars:
                        file_vars["global_variables"][subp_name][name] = global_vars[name]
                    elif name in global_consts:
                        file_vars["global_constants"][subp_name][name] = global_consts[name]

            result[unit.filename] = file_vars

        return result
