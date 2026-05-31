# mock_generator.py

class MockStubGenerator:
    def __init__(self, call_graph):
        """
        call_graph expected format:
        {
            "Caller1": ["CalleeA", "CalleeB"],
            "Caller2": ["CalleeC"]
        }
        """
        self.call_graph = call_graph

    def generate(self):
        mocks = {}

        # Collect all unique callees
        all_callees = set()

        for caller, callees in self.call_graph.items():
            for callee in callees:
                all_callees.add(callee)

        # Generate simple stub for each callee
        for callee in all_callees:
            stub_code = f"""
procedure {callee} is
begin
    -- Mock implementation
    null;
end {callee};
"""
            mocks[callee] = stub_code.strip()

        return mocks