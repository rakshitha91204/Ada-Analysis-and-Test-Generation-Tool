# complexity.py
import libadalang as lal

class ComplexityAnalyzer:
    def __init__(self, units):
        self.units = units

    def compute(self):
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                complexity = 1

                complexity += len(list(subp.findall(lal.IfStmt)))
                complexity += len(list(subp.findall(lal.ForLoopStmt)))
                complexity += len(list(subp.findall(lal.WhileLoopStmt)))
                complexity += len(list(subp.findall(lal.CaseStmt)))
                complexity += len(list(subp.findall(lal.ExceptionHandler)))

                result[subp.f_subp_spec.f_subp_name.text] = complexity

        return result