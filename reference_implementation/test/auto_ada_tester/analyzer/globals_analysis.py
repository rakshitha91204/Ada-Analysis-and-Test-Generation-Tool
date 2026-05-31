# globals_analysis.py
import libadalang as lal

class GlobalRWDetector:
    def __init__(self, units):
        self.units = units

    def detect(self):
        result = {}

        for unit in self.units:
            globals_rw = {"read": [], "write": []}

            for obj in unit.root.findall(lal.ObjectDecl):
                if obj.f_mode is None:  # likely global
                    globals_rw["write"].append()

            result[unit.filename] = globals_rw

        return result