# control_flow_extractor.py
# Extracts control flow with RESOLVED variable types from scope.
import libadalang as lal


def _safe_text(node) -> str:
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


def _infer_from_rhs(rhs: str) -> str:
    """Infer Ada type from RHS expression or literal."""
    t = rhs.strip()
    # Type attribute: Integer_8'Min(...) -> Integer_8
    if "'" in t:
        candidate = t.split("'")[0].strip()
        if candidate and candidate[0].isupper() and not candidate[0].isdigit():
            return candidate
    if t.lstrip("-").isdigit():             return "Integer"
    try: float(t); return "Float"
    except ValueError: pass
    if t.lower() in ("true", "false"):      return "Boolean"
    if t.startswith('"') and t.endswith('"'): return "String"
    if len(t) == 3 and t[0] == "'" and t[2] == "'": return "Character"
    if t.startswith("16#"):                 return "Integer"
    return "Unknown"


def _build_scope(subp: lal.SubpBody, variables_info: dict, subp_name: str) -> dict:
    """
    Build a complete type-lookup scope for a subprogram by merging:
    1. Parameters from AST spec
    2. Local ObjectDecl from AST (skipping nested bodies)
    3. For-loop iterators from AST
    4. variables_info: local_variables, global_variables, global_constants
    Returns { var_name_lower: {"canonical": str, "type": str} }
    """
    scope: dict = {}  # lower_name -> {canonical, type}

    def _add(name: str, type_str: str):
        if name:
            scope[name.lower()] = {"canonical": name, "type": type_str}

    # 1. Parameters
    try:
        spec = subp.f_subp_spec
        if spec.f_subp_params:
            for param_decl in spec.f_subp_params.f_params:
                try:
                    ptype = param_decl.f_type_expr.text.strip() if param_decl.f_type_expr else "Unknown"
                    for ident in param_decl.f_ids:
                        _add(ident.text, ptype)
                except Exception:
                    pass
    except Exception:
        pass

    # 2. Local ObjectDecl (skip nested bodies)
    for obj in subp.findall(lal.ObjectDecl):
        parent = obj.parent
        nested = False
        while parent and parent != subp:
            if isinstance(parent, lal.SubpBody):
                nested = True
                break
            parent = parent.parent
        if nested:
            continue
        try:
            t = obj.f_type_expr.text.strip() if obj.f_type_expr else "Unknown"
            for ident in obj.f_ids:
                _add(ident.text, t)
        except Exception:
            pass

    # 3. For-loop iterators
    for for_loop in subp.findall(lal.ForLoopStmt):
        try:
            vd = for_loop.f_var_decl
            iter_name = vd.f_id.text
            iter_type = vd.f_id_type.text.strip() if vd.f_id_type else "Integer"
            _add(iter_name, iter_type)
        except Exception:
            pass

    # 4. Merge from variables_info (fills gaps: loop vars, nested vars)
    vi = variables_info or {}
    for scope_key in ("local_variables", "global_variables", "global_constants"):
        for vname, vinfo in vi.get(scope_key, {}).get(subp_name, {}).items():
            if vname.lower() not in scope:
                t = vinfo.get("type", "Unknown") if isinstance(vinfo, dict) else str(vinfo)
                _add(vname, t)

    return scope


def _resolve(name: str, scope: dict) -> str:
    """Resolve a variable name to its type using case-insensitive scope lookup."""
    # Strip record/array access: G.X -> G, Arr(I) -> Arr
    base = name.split('.')[0].split('(')[0].strip()
    entry = scope.get(base.lower())
    if entry:
        return entry["type"]
    return "Unknown"


class ControlFlowExtractor:
    def __init__(self, units):
        self.units = units

    def run(self, variables_info: dict = None) -> dict:
        """
        Run control flow extraction.
        variables_info: { filename: {local_variables, global_variables, global_constants} }
        """
        result = {}
        vi_map = variables_info or {}

        _KEYWORDS = frozenset({
            "and", "or", "not", "in", "out", "if", "then", "else", "elsif",
            "when", "true", "false", "null", "integer", "float", "boolean",
            "natural", "positive", "character", "string", "others",
            "uint8", "uint16", "uint32", "uint64", "int8", "int16", "int32",
            "pos", "chr", "ord", "succ", "pred", "val", "image", "value",
            "first", "last", "length", "range", "size", "address", "min", "max",
        })

        for unit in self.units:
            file_result = {}
            file_vi = vi_map.get(unit.filename, {})

            for subp in unit.root.findall(lal.SubpBody):
                # Skip nested
                parent = subp.parent
                nested = False
                while parent:
                    if isinstance(parent, lal.SubpBody):
                        nested = True
                        break
                    parent = parent.parent
                if nested:
                    continue

                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                scope = _build_scope(subp, file_vi, subp_name)

                if_conditions = []
                branch_body_vars = {}
                procedure_calls = []
                seen_calls: set = set()

                # if / elsif conditions
                for if_stmt in subp.findall(lal.IfStmt):
                    try:
                        cond = _safe_text(if_stmt.f_cond_expr)
                        if cond:
                            if_conditions.append({
                                "condition_text": cond,
                                "branch_type": "if",
                                "nesting_depth": 0,
                                "variables": self._cond_vars(if_stmt.f_cond_expr, scope, _KEYWORDS),
                            })
                    except Exception:
                        pass
                    try:
                        for alt in if_stmt.f_alternatives:
                            cond = _safe_text(alt.f_cond_expr)
                            if cond:
                                if_conditions.append({
                                    "condition_text": cond,
                                    "branch_type": "elsif",
                                    "nesting_depth": 0,
                                    "variables": self._cond_vars(alt.f_cond_expr, scope, _KEYWORDS),
                                })
                    except Exception:
                        pass

                # case / when
                for case_stmt in subp.findall(lal.CaseStmt):
                    try:
                        for alt in case_stmt.f_alternatives:
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

                # assignments
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = _safe_text(assign.f_dest)
                        rhs = _safe_text(assign.f_expr)
                        lhs_base = lhs.split('.')[0].split('(')[0].strip()
                        if not lhs_base or lhs_base.lower() in (
                            "begin","end","is","then","else","loop","return","raise","null","when","others"
                        ):
                            continue
                        # Scope lookup first
                        resolved = _resolve(lhs_base, scope)
                        if resolved == "Unknown":
                            resolved = _infer_from_rhs(rhs)
                        branch_body_vars[lhs] = {
                            "kind": "assignment",
                            "data_type": {"type": resolved},
                            "used_in_branch": "",
                            "assigned_from": rhs,
                        }
                    except Exception:
                        pass

                # calls
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
                    "branch_body_variables": branch_body_vars,
                    "procedure_calls": procedure_calls,
                }

            result[unit.filename] = file_result
        return result

    @staticmethod
    def _cond_vars(cond_node, scope: dict, keywords: frozenset) -> dict:
        """Extract identifiers from condition, resolving types from scope."""
        found = {}
        if cond_node is None:
            return found
        # Build reverse lookup: lower -> canonical
        scope_lower = {k: v for k, v in scope.items()}
        try:
            for ident in cond_node.findall(lal.Identifier):
                name = _safe_text(ident)
                if not name or name.lower() in keywords:
                    continue
                base = name.split('.')[0].split('(')[0].strip()
                base_lower = base.lower()
                if base_lower in found:
                    continue
                if base_lower in scope_lower:
                    t = scope_lower[base_lower]["type"]
                    found[scope_lower[base_lower]["canonical"]] = {
                        "kind": "resolved",
                        "data_type": {"type": t},
                    }
                # Skip identifiers not in scope (type names, pkg qualifiers, etc.)
        except Exception:
            pass
        return found
