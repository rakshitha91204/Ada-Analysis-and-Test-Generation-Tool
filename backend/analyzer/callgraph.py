# callgraph.py
import libadalang as lal

class CallGraphBuilder:
    def __init__(self, units):
        self.units = units

    def build(self):
        graph = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                caller = subp.f_subp_spec.f_subp_name.text
                graph[caller] = []

                for call in subp.findall(lal.CallExpr):
                    graph[caller].append(call.f_name.text)

        return graph