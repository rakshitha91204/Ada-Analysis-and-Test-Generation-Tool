# complexity.py — complete McCabe cyclomatic complexity per subprogram.
import libadalang as lal


class ComplexityAnalyzer:
    def __init__(self, units):
        self.units = units

    def compute(self) -> dict:
        """
        Returns a flat dict: { "SubpName": int_score, ... }
        The flat int-keyed format is what the frontend expects.
        """
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
                except Exception:
                    name = "UNKNOWN"

                # Only store flat int — the frontend renders this directly
                result[name] = complexity

        return result
