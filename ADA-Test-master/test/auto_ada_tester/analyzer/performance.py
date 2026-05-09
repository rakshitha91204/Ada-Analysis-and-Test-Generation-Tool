import libadalang as lal
class PerformanceAnalyzer:
    def __init__(self, units):
        self.units = units

    def analyze(self):
        warnings = []

        for unit in self.units:
            for loop in unit.root.findall(lal.ForLoopStmt):
                if len(list(loop.findall(lal.CallExpr))) > 5:
                    warnings.append("Heavy function calls inside loop")

        return warnings