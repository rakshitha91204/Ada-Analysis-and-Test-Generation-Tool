# logical_error.py — detects always-true/false conditions and float div-by-zero.
import libadalang as lal

_ZERO_LITERALS = {"0", "0.0", "0.0e0", "0.0e+0"}


class LogicalErrorDetector:
    def __init__(self, units):
        self.units = units

    def detect(self) -> list:
        issues = []

        for unit in self.units:
            filename = unit.filename

            # Float division-by-zero
            for binop in unit.root.findall(lal.BinOp):
                try:
                    if binop.f_op.text.strip() != "/":
                        continue
                    rhs = (binop.f_right.text or "").strip().lower()
                    if rhs in _ZERO_LITERALS:
                        issues.append(
                            f"Division by zero at {filename}:{binop.sloc_range.start.line}: "
                            f"{binop.text.strip()[:80]}"
                        )
                except Exception:
                    pass

            # Always-true / always-false literal conditions
            for if_stmt in unit.root.findall(lal.IfStmt):
                try:
                    cond = (if_stmt.f_cond_expr.text or "").strip().lower()
                    if cond in ("true", "false"):
                        issues.append(
                            f"Constant condition at {filename}:{if_stmt.sloc_range.start.line}: "
                            f"condition is always {cond.upper()}"
                        )
                except Exception:
                    pass

        return issues
