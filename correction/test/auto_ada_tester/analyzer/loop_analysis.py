import libadalang as lal

class LoopAnalyzer:
    def __init__(self, units):
        self.units = units

    def detect(self):
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                name = subp.f_subp_spec.f_subp_name.text
                loops = len(list(subp.findall(lal.ForLoopStmt))) + \
                        len(list(subp.findall(lal.WhileLoopStmt)))

                result[name] = loops

        return result