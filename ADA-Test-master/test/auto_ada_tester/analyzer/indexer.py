# indexer.py
import libadalang as lal

class SubprogramIndexer:
    def __init__(self, units):
        self.units = units

    def index(self):
        result = {}

        for unit in self.units:
            subprograms = []

            for node in unit.root.findall(lal.SubpBody):
                subprograms.append({
                    "name": node.f_subp_spec.f_subp_name.text,
                    "parameters": [p.text for p in node.f_subp_spec.f_subp_params] if node.f_subp_spec.f_subp_params else [],
                    "return_type": node.f_subp_spec.f_subp_returns.text if node.f_subp_spec.f_subp_returns else None,
                    "start_line": node.sloc_range.start.line,
                    "end_line": node.sloc_range.end.line
                })

            result[unit.filename] = subprograms

        return result