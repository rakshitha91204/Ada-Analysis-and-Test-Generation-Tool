# protected_analysis.py
import libadalang as lal

class ProtectedAccessDetector:
    def __init__(self, units):
        self.units = units

    def detect(self):
        protected_usage = []

        for unit in self.units:
            for node in unit.root.findall(lal.ProtectedBody):
                protected_usage.append(node.f_name.text)

        return protected_usage