# loop_analysis.py — detailed loop info with line numbers and nesting depth.
import libadalang as lal


class LoopAnalyzer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _nesting_depth(node) -> int:
        depth = 0
        parent = node.parent
        while parent:
            if isinstance(parent, (lal.ForLoopStmt, lal.WhileLoopStmt, lal.LoopStmt)):
                depth += 1
            parent = parent.parent
        return depth

    def detect(self) -> dict:
        """
        Returns flat dict: { "SubpName": int_loop_count, ... }
        Also adds "loop_details" key per subprogram:
          { "SubpName__loop_details": [{"type": "for"|"while"|"loop", "line": N, "nesting_depth": N}, ...] }

        The flat count keys are preserved for full backward compatibility with
        the frontend which reads loop_info as Record<string, number>.
        The loop_details keys are extra and can be read by any consumer that
        wants richer per-loop information.
        """
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                details: list = []
                seen_ids: set = set()

                for loop_cls, loop_type in [
                    (lal.ForLoopStmt,   "for"),
                    (lal.WhileLoopStmt, "while"),
                    (lal.LoopStmt,      "loop"),
                ]:
                    for loop_node in subp.findall(loop_cls):
                        # Avoid double-counting: ForLoopStmt/WhileLoopStmt are
                        # also matched by findall(LoopStmt) in some lal builds.
                        node_id = id(loop_node)
                        if node_id in seen_ids:
                            continue
                        seen_ids.add(node_id)
                        try:
                            line = loop_node.sloc_range.start.line
                        except Exception:
                            line = 0
                        depth = self._nesting_depth(loop_node)
                        details.append({
                            "type":          loop_type,
                            "line":          line,
                            "nesting_depth": depth,
                        })

                # Sort by line number for readability
                details.sort(key=lambda d: d["line"])

                # Flat count (backward-compatible key)
                result[subp_name] = len(details)
                # Rich per-loop detail (new key, will not clash with int values)
                result[f"{subp_name}__loop_details"] = details

        return result
