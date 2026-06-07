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
        """
        Returns flat dict: { "SubpName": int_loop_count, ... }
        The frontend reads loop_info as Record<string, number>.
        """
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                count = 0
                for loop_cls in [lal.ForLoopStmt, lal.WhileLoopStmt, lal.LoopStmt]:
                    count += len(list(subp.findall(loop_cls)))

                result[subp_name] = count

        return result
