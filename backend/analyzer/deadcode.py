# deadcode.py — dead code detection that excludes entry points and public specs.

class DeadCodeDetector:
    def __init__(self, callgraph: dict, public_subprograms=None):
        self.callgraph = callgraph
        self.public_subprograms: set = public_subprograms or set()

    def detect_unused_subprograms(self) -> list:
        all_called: set = set()
        for callees in self.callgraph.values():
            all_called.update(callees)

        unused = []
        for subp in self.callgraph:
            if subp in all_called:
                continue
            if subp.lower() in {p.lower() for p in self.public_subprograms}:
                continue
            unused.append(subp)

        return unused
