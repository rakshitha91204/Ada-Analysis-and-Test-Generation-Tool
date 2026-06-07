# mock_generator.py — generates correct Ada stubs for both procedures and functions.
import re


class MockStubGenerator:
    def __init__(self, call_graph: dict, subprogram_index=None):
        self.call_graph = call_graph
        self._return_types: dict = {}
        if subprogram_index:
            for subps in subprogram_index.values():
                for sub in subps:
                    name = sub.get("name", "")
                    rt   = sub.get("return_type")
                    if name:
                        self._return_types[name] = rt

    def generate(self) -> dict:
        all_callees: set = set()
        for callees in self.call_graph.values():
            all_callees.update(callees)

        mocks: dict = {}
        for callee in sorted(all_callees):
            rt = self._return_types.get(callee)
            is_function = rt and rt.strip()

            if is_function:
                stub = (
                    f"function {callee} return {rt} is\n"
                    f"begin\n"
                    f"   -- Mock: return a default value\n"
                    f"   return 0;\n"
                    f"end {callee};"
                )
            else:
                stub = (
                    f"procedure {callee} is\n"
                    f"begin\n"
                    f"   -- Mock implementation\n"
                    f"   null;\n"
                    f"end {callee};"
                )
            mocks[callee] = stub

        return mocks
