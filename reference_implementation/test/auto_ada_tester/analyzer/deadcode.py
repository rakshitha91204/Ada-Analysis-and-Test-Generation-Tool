


# deadcode.py
class DeadCodeDetector:
    def __init__(self, callgraph):
        self.callgraph = callgraph

    def detect_unused_subprograms(self):
        all_called = set()

        for caller in self.callgraph:
            for callee in self.callgraph[caller]:
                all_called.add(callee)

        unused = [subp for subp in self.callgraph if subp not in all_called]
        return unused