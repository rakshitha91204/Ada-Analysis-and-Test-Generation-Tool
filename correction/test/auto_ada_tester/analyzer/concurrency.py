# # concurrency.py
# import libadalang as lal

# class ConcurrencyAnalyzer:
#     def __init__(self, units):
#         self.units = units

#     def detect_tasks(self):
#         tasks = []

#         for unit in self.units:
#             for task in unit.root.findall(lal.TaskBody):
#                 tasks.append(task.f_name.text)
#     # def __init__(self, units):
#     #     self.units = units

#     # def analyze(self):
#     #     return {
#     #         "tasks": [t.f_name.text for u in self.units for t in u.root.findall(lal.TaskBody)],
#     #         "protected_objects": [p.f_name.text for u in self.units for p in u.root.findall(lal.ProtectedBody)]
#     #     }
#         return tasks

import libadalang as lal

class ConcurrencyAnalyzer:
    def __init__(self, units):
        self.units = units

    def detect_tasks(self):
        return [
            t.f_name.text
            for u in self.units
            for t in u.root.findall(lal.TaskBody)
        ]

    def detect_protected_objects(self):
        return [
            p.f_name.text
            for u in self.units
            for p in u.root.findall(lal.ProtectedBody)
        ]

    def analyze(self):
        return {
            "tasks": self.detect_tasks(),
            "protected_objects": self.detect_protected_objects()
        }