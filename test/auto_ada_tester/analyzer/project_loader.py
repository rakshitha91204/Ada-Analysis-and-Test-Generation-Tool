# project_loader.py
import libadalang as lal

class ProjectLoader:
    def __init__(self, file_paths):
        self.file_paths = file_paths
        self.context = lal.AnalysisContext()
        self.units = []

    def load_units(self):
        for path in self.file_paths:
            unit = self.context.get_from_file(path)
            if unit.diagnostics:
                print(f"Diagnostics in {path}:")
                for d in unit.diagnostics:
                    print(d)
            self.units.append(unit)
        return self.units