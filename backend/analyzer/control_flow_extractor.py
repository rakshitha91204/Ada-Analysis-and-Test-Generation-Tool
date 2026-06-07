# control_flow_extractor.py
import libadalang as lal


def _safe_text(node) -> str:
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


def _infer_type_from_text(text: str) -> str:
    """Infer Ada type from a literal or simple expression."""
    t = text.strip()
    if not t:
        return "Unknown"
    # Integer literal
    if t.lstrip("-").isdigit():
        return "Integer"
    # Float literal
    try:
        float(t)
        return "Float"
    except ValueError:
        pass
    # Boolean literal
    if t.lower() in ("true", "false"):
        return "Boolean"
    # String literal
    if t.startswith('"') and t.endswith('"'):
        return "String"
    # Character literal
    if len(t) == 3 and t.startswith("'") and t.endswith("'"):
        return "Character"
    # Hex literal
    if t.startswith("16#") or t.startswith("0x"):
        return "Integer"
    return "Unknown"


def _resolve_type_from_scope(name: str, scope_vars: dict) -> str:
    """Look up a variable's type from the collected scope variables."""
    # Direct lookup (case-insensitive)
    name_lower = name.lower()
    for var_name, var_info in scope_vars.items():
        if var_name.lower() == name_lower:
            if isinstance(var_info, dict):
                return var_info.get("type", "Unknown")
            return str(var_info)
    return "Unknown"


def _collect_scope_vars(subp: lal.SubpBody) -> dict:
    """
    Collect all declared variables in a subprogram scope:
    - Parameters (with types from spec)
    - Local ObjectDecl nodes
    Returns { var_name: {"type": type_str} }
    """
    scope: dict = {}

    # Parameters from spec
    try:
        spec = subp.f_subp_spec
        if spec.f_subp_params:
            for param_decl in spec.f_subp_params.f_params:
                try:
                    ptype = param_decl.f_type_expr.text.strip() if param_decl.f_type_expr else "Unknown"
                    for ident in param_decl.f_ids:
                        scope[ident.text] = {"type": ptype}
                except Exception:
                    pass
    except Exception:
        pass

    # Local variables (only direct children, not nested subprograms)
    for obj in subp.findall(lal.ObjectDecl):
        # Skip if inside a nested SubpBody
        parent = obj.parent
        in_nested = False
        while parent and parent != subp:
            if isinstance(parent, lal.SubpBody):
                in_nested = True
                break
            parent = parent.parent
        if in_nested:
            continue
        try:
            type_text = obj.f_type_expr.text.strip() if obj.f_type_expr else "Unknown"
            for ident in obj.f_ids:
                scope[ident.text] = {"type": type_text}
        except Exception:
            pass

    return scope


class ControlFlowExtractor:
    def __init__(self, units):
        self.units = units

    def run(self):
        result = {}

        for unit in self.units:
            file_result = {}

            for subp in unit.root.findall(lal.SubpBody):
                # Skip nested subprograms
                parent = subp.parent
                in_nested = False
                while parent:
                    if isinstance(parent, lal.SubpBody):
                        in_nested = True
                        break
                    parent = parent.parent
                if in_nested:
                    continue

                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN_SUBP"

                # Collect scope variables for type resolution
                scope_vars = _collect_scope_vars(subp)

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
                                "variables": self._extract_cond_vars(
                                    if_stmt.f_cond_expr, scope_vars
                                ),
                            })
                    except Exception:
                        pass

                    try:
                        for alt in if_stmt.f_alternatives:
                            try:
                                cond_text = _safe_text(alt.f_cond_expr)
                                if cond_text:
                                    if_conditions.append({
                                        "condition_text": cond_text,
                                        "branch_type": "elsif",
                                        "nesting_depth": 0,
                                        "variables": self._extract_cond_vars(
                                            alt.f_cond_expr, scope_vars
                                        ),
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

                # ── assignments ────────────────────────────────────────
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = _safe_text(assign.f_dest)
                        rhs = _safe_text(assign.f_expr)
                        if lhs and lhs.lower() not in (
                            "begin", "end", "is", "then", "else", "loop",
                            "return", "raise", "null", "when", "others",
                        ):
                            # Try scope lookup first, then literal inference
                            resolved = _resolve_type_from_scope(lhs, scope_vars)
                            if resolved == "Unknown":
                                resolved = _infer_type_from_text(rhs)
                            branch_body_variables[lhs] = {
                                "kind": "assignment",
                                "data_type": {"type": resolved},
                                "used_in_branch": "",
                                "assigned_from": rhs,
                            }
                    except Exception:
                        pass

                # ── procedure calls ────────────────────────────────────
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
    def _extract_cond_vars(cond_node, scope_vars: dict = None) -> dict:
        """
        Extract identifiers from a condition and resolve their types
        from the subprogram's scope variables.
        Only includes identifiers that are actually in scope (params/locals).
        """
        vars_found = {}
        if cond_node is None:
            return vars_found
        if scope_vars is None:
            scope_vars = {}

        # Build a fast case-insensitive lookup
        scope_lower = {k.lower(): (k, v) for k, v in scope_vars.items()}

        _KEYWORDS = frozenset({
            "and", "or", "not", "in", "out", "if", "then", "else", "elsif",
            "when", "true", "false", "null", "integer", "float", "boolean",
            "natural", "positive", "character", "string", "others",
            "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32",
            "pos", "chr", "ord", "succ", "pred", "val", "image", "value",
            "first", "last", "length", "range", "size", "address",
        })

        try:
            for ident in cond_node.findall(lal.Identifier):
                name = _safe_text(ident)
                if not name or name.lower() in _KEYWORDS:
                    continue
                if name in vars_found:
                    continue

                # Only include if the variable is actually in scope
                name_lower = name.lower()
                if name_lower in scope_lower:
                    canonical_name, var_info = scope_lower[name_lower]
                    type_str = var_info.get("type", "Unknown") if isinstance(var_info, dict) else str(var_info)
                    vars_found[canonical_name] = {
                        "kind": "resolved",
                        "data_type": {"type": type_str},
                    }
                # Skip identifiers not in scope (type names, package names, etc.)
        except Exception:
            pass

        return vars_found
