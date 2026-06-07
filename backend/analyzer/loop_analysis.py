# loop_analysis.py — detailed loop info with line numbers and nesting depth.
import libadalang as lal


class LoopAnalyzer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _nesting_depth(node) -> int:
        depth = 0
        parent = node.parent
        while parent:
            if isinstance(parent, (lal.ForLoopStmt, lal.WhileLoopStmt, lal.LoopStmt)):
                depth += 1
            parent = parent.parent
        return depth

    def detect(self) -> dict:
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                loops = []
                for loop_cls, kind in [
                    (lal.ForLoopStmt,   "for"),
                    (lal.WhileLoopStmt, "while"),
                    (lal.LoopStmt,      "loop"),
                ]:
                    for loop in subp.findall(loop_cls):
                        try:
                            line = loop.sloc_range.start.line
                        except Exception:
                            line = 0
                        has_exit = bool(
                            list(loop.findall(lal.ExitStmt)) or
                            list(loop.findall(lal.ReturnStmt)) or
                            list(loop.findall(lal.RaiseStmt))
                        )
                        loops.append({
                            "kind":          kind,
                            "line":          line,
                            "nesting_depth": self._nesting_depth(loop),
                            "has_exit":      has_exit,
                        })

                # Legacy compat: also store flat count keyed by subp name
                result[subp_name] = len(loops)
                if loops:
                    result[f"{unit.filename}::{subp_name}"] = {
                        "subprogram": subp_name,
                        "file":       unit.filename,
                        "loops":      loops,
                    }

        return result
