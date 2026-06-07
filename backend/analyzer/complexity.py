# complexity.py — complete McCabe cyclomatic complexity per subprogram.
import libadalang as lal


class ComplexityAnalyzer:
    def __init__(self, units):
        self.units = units

    def compute(self) -> dict:
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                complexity = 1  # base path

                complexity += len(list(subp.findall(lal.IfStmt)))
                complexity += len(list(subp.findall(lal.ElsifStmtPart)))
                complexity += len(list(subp.findall(lal.ForLoopStmt)))
                complexity += len(list(subp.findall(lal.WhileLoopStmt)))
                complexity += len(list(subp.findall(lal.LoopStmt)))
                complexity += len(list(subp.findall(lal.ExceptionHandler)))
                complexity += len(list(subp.findall(lal.CaseStmtAlternative)))

                for binop in subp.findall(lal.BinOp):
                    try:
                        op = binop.f_op.text.strip().lower()
                        if op in ("and then", "or else"):
                            complexity += 1
                    except Exception:
                        pass

                complexity += len(list(subp.findall(lal.SelectStmt)))
                complexity += len(list(subp.findall(lal.AcceptStmt)))

                try:
                    name = subp.f_subp_spec.f_subp_name.text
                    line = subp.sloc_range.start.line
                except Exception:
                    name = "UNKNOWN"
                    line = 0

                risk = "low" if complexity <= 5 else "medium" if complexity <= 10 else "high"
                # Keep legacy flat dict key for backward compat
                result[name] = complexity
                # Also store enriched key
                result[f"{unit.filename}::{name}"] = {
                    "score": complexity, "name": name,
                    "file": unit.filename, "line": line, "risk": risk,
                }

        return result
