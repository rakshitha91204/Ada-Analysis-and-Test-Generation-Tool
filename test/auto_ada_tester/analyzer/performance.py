# performance.py — performance analysis with location info and configurable threshold.
import libadalang as lal

CALL_THRESHOLD = 5


class PerformanceAnalyzer:
    def __init__(self, units, call_threshold: int = CALL_THRESHOLD):
        self.units = units
        self.call_threshold = call_threshold

    def analyze(self) -> list:
        warnings = []

        for unit in self.units:
            filename = unit.filename

            for loop_cls, loop_type in [
                (lal.ForLoopStmt,   "for"),
                (lal.WhileLoopStmt, "while"),
                (lal.LoopStmt,      "loop"),
            ]:
                for loop in unit.root.findall(loop_cls):
                    self._check_loop(loop, filename, loop_type, warnings)

        return warnings

    def _check_loop(self, loop, filename: str, loop_type: str, warnings: list):
        calls = list(loop.findall(lal.CallExpr))
        if len(calls) > self.call_threshold:
            subp_name = "?"
            parent = loop.parent
            while parent:
                if isinstance(parent, lal.SubpBody):
                    try:
                        subp_name = parent.f_subp_spec.f_subp_name.text
                    except Exception:
                        pass
                    break
                parent = parent.parent

            try:
                line = loop.sloc_range.start.line
            except Exception:
                line = 0

            warnings.append(
                f"Heavy function calls inside {loop_type} loop in '{subp_name}' "
                f"({len(calls)} calls) at {filename}:{line}"
            )
