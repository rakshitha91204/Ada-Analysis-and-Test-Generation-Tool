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
                params = []
                if node.f_subp_spec.f_subp_params:
                    # Iterate individual ParamDecl nodes for clean per-param strings
                    for param_decl in node.f_subp_spec.f_subp_params.f_params:
                        # param_decl.text gives e.g. "Orida_In : in UINT16"
                        # Normalise whitespace so the frontend parser works reliably
                        raw = " ".join(param_decl.text.split())
                        params.append(raw)

                subprograms.append({
                    "name": node.f_subp_spec.f_subp_name.text,
                    "parameters": params,
                    "return_type": (
                        node.f_subp_spec.f_subp_returns.text
                        if node.f_subp_spec.f_subp_returns else None
                    ),
                    "start_line": node.sloc_range.start.line,
                    "end_line": node.sloc_range.end.line,
                })

            result[unit.filename] = subprograms

        return result
