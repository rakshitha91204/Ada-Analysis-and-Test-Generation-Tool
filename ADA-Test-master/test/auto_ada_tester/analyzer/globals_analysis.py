# globals_analysis.py
import libadalang as lal

class GlobalRWDetector:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _is_global(obj):
        """Return True if the ObjectDecl is not nested inside a subprogram or block."""
        parent = obj.parent
        while parent:
            if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
                return False
            parent = parent.parent
        return True

    def detect(self):
        result = {}

        for unit in self.units:
            globals_rw = {"read": set(), "write": set()}

            # Collect global variable names from this unit
            global_names = set()
            for obj in unit.root.findall(lal.ObjectDecl):
                if self._is_global(obj):
                    for ident in obj.f_ids:
                        global_names.add(ident.text)

            # Scan subprogram bodies for reads and writes of those globals
            for subp in unit.root.findall(lal.SubpBody):
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = assign.f_dest.text
                        if lhs in global_names:
                            globals_rw["write"].add(lhs)
                    except Exception:
                        pass

                for name_node in subp.findall(lal.Name):
                    try:
                        name = name_node.text
                        if name in global_names and name not in globals_rw["write"]:
                            globals_rw["read"].add(name)
                    except Exception:
                        pass

            result[unit.filename] = {
                "read": list(globals_rw["read"]),
                "write": list(globals_rw["write"]),
            }

        return result