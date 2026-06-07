import libadalang as lal
class TestHarnessGenerator:
    def __init__(self, subprograms):
        self.subprograms = subprograms

    def generate(self):
        harness = {}

        for file, subs in self.subprograms.items():
            harness[file] = []

            for sub in subs:
                harness[file].append({
                    "test_name": f"test_{sub['name']}",
                    "template": f"procedure test_{sub['name']} is begin null; end;"
                })

        return harness