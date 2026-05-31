import libadalang as lal

class ExceptionAnalyzer:
    def __init__(self, units):
        self.units = units

    def detect(self):
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                name = subp.f_subp_spec.f_subp_name.text
                handlers = len(list(subp.findall(lal.ExceptionHandler)))
                result[name] = handlers

        return result