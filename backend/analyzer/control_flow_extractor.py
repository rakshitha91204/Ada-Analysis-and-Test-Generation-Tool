# control_flow_extractor.py
import libadalang as lal


def _safe_text(node) -> str:
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


def _infer_type(rhs_text: str) -> str:
    t = rhs_text.strip()
    if t.lstrip("-").isdigit():
        return "Integer"
    try:
        float(t)
        return "Float"
    except ValueError:
        pass
    if t.lower() in ("true", "false"):
        return "Boolean"
    if t.startswith('"'):
        return "String"
    if len(t) == 3 and t.startswith("'") and t.endswith("'"):
        return "Character"
    return "Unknown"


class ControlFlowExtractor:
    def __init__(self, units):
        self.units = units

    def run(self):
        result = {}

        for unit in self.units:
            file_result = {}

            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN_SUBP"

                if_conditions = []
                branch_body_variables = {}
                procedure_calls = []
                seen_calls = set()

                # ── if / elsif conditions ──────────────────────────────
                for if_stmt in subp.findall(lal.IfStmt):
                    try:
                        cond_text = _safe_text(if_stmt.f_cond_expr)
                        if cond_text:
                            if_conditions.append({
                                "condition_text": cond_text,
                                "branch_type": "if",
                                "nesting_depth": 0,
                                "variables": self._extract_cond_vars(if_stmt.f_cond_expr),
                            })
                    except Exception:
                        pass

                    # elsif alternatives
                    try:
                        for alt in if_stmt.f_alternatives:
                            try:
                                cond_text = _safe_text(alt.f_cond_expr)
                                if cond_text:
                                    if_conditions.append({
                                        "condition_text": cond_text,
                                        "branch_type": "elsif",
                                        "nesting_depth": 0,
                                        "variables": self._extract_cond_vars(alt.f_cond_expr),
                                    })
                            except Exception:
                                pass
                    except Exception:
                        pass

                # ── case / when ────────────────────────────────────────
                for case_stmt in subp.findall(lal.CaseStmt):
                    try:
                        for alt in case_stmt.f_alternatives:
                            try:
                                choices = _safe_text(alt.f_choices)
                                if choices:
                                    if_conditions.append({
                                        "condition_text": choices,
                                        "branch_type": "when",
                                        "nesting_depth": 0,
                                        "variables": {},
                                    })
                            except Exception:
                                pass
                    except Exception:
                        pass

                # ── assignments inside subprogram ──────────────────────
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = _safe_text(assign.f_dest)
                        rhs = _safe_text(assign.f_expr)
                        if lhs and not lhs.lower() in (
                            "begin", "end", "is", "then", "else", "loop",
                            "return", "raise", "null", "when", "others",
                        ):
                            branch_body_variables[lhs] = {
                                "kind": "assignment",
                                "data_type": {"type": _infer_type(rhs)},
                                "used_in_branch": "",
                                "assigned_from": rhs,
                            }
                    except Exception:
                        pass

                # ── procedure / function calls ─────────────────────────
                for call in subp.findall(lal.CallExpr):
                    try:
                        name = _safe_text(call.f_name)
                        if name and name not in seen_calls:
                            seen_calls.add(name)
                            procedure_calls.append(name)
                    except Exception:
                        pass

                file_result[subp_name] = {
                    "if_conditions": if_conditions,
                    "branch_body_variables": branch_body_variables,
                    "procedure_calls": procedure_calls,
                }

            result[unit.filename] = file_result

        return result

    @staticmethod
    def _extract_cond_vars(cond_node) -> dict:
        """Extract identifiers from a condition expression node."""
        vars_found = {}
        if cond_node is None:
            return vars_found

        _KEYWORDS = frozenset({
            "and", "or", "not", "in", "out", "if", "then", "else", "elsif",
            "when", "true", "false", "null", "integer", "float", "boolean",
            "natural", "positive", "others",
        })

        try:
            for ident in cond_node.findall(lal.Identifier):
                name = _safe_text(ident)
                if name and name.lower() not in _KEYWORDS and name not in vars_found:
                    vars_found[name] = {
                        "kind": "unresolved",
                        "data_type": {"type": "Unknown"},
                    }
        except Exception:
            pass

        return vars_found
