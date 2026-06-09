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

        # ── Transitive pass (max 5 iterations) ─────────────────────────────
        # If subp A is dead and subp B is only called by dead subprograms,
        # then B is also dead. Repeat until no new dead code is found.
        dead_set: set = set(unused)
        for _ in range(5):
            new_dead: list = []
            for subp in self.callgraph:
                if subp in dead_set:
                    continue
                if subp.lower() in {p.lower() for p in self.public_subprograms}:
                    continue
                # Find all callers of this subp
                callers = [
                    caller
                    for caller, callees in self.callgraph.items()
                    if subp in callees
                ]
                if callers and all(c in dead_set for c in callers):
                    new_dead.append(subp)
            if not new_dead:
                break
            dead_set.update(new_dead)
            unused.extend(new_dead)

        return unused
