
class MockStubGenerator:
    def __init__(self, callgraph):
        self.callgraph = callgraph

    def generate(self):
        mocks = {}

        for caller, callees in self.callgraph.items():
            for callee in callees:
                mocks[callee] = f"procedure {callee} is begin null; end;"

        return mocks