# control_flow_extractor.py
# Extracts control flow with RESOLVED variable types from scope.
import libadalang as lal


def _safe_text(node) -> str:
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


def _infer_from_rhs(rhs: str, scope: dict = None) -> str:
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
    # Arithmetic with known variable: e.g. "Ret + 1" -> use type of Ret
    if scope:
        for op in ("+", "-", "*", "/"):
            if op in t:
                first_token = t.split(op)[0].strip().split("(")[0].split(".")[0].strip()
                if first_token and first_token[0].isalpha():
                    resolved = scope.get(first_token.lower(), {}).get("type", "Unknown")
                    if resolved != "Unknown":
                        return resolved
    # Type conversion call: Natural(...), Integer_8(...)
    if "(" in t:
        func_name = t.split("(")[0].strip()
        if func_name and func_name[0].isupper() and " " not in func_name and "." not in func_name:
            return func_name
    return "Unknown"


def _build_scope(subp: lal.SubpBody, variables_info: dict, subp_name: str,
                  all_units_vars: dict = None) -> dict:
    """
    Build a complete type-lookup scope for a subprogram by merging:
    1. Parameters from AST spec
    2. Local ObjectDecl from AST (skipping nested bodies)
    3. For-loop iterators from AST
    4. variables_info for THIS file (locals, globals, parameters)
    5. variables_info from ALL files (cross-file globals from .ads specs)
    Returns { var_name_lower: {"canonical": str, "type": str} }
    """
    scope: dict = {}  # lower_name -> {canonical, type}

    def _add(name: str, type_str: str):
        if name and type_str and type_str not in ("Unknown", ""):
            scope[name.lower()] = {"canonical": name, "type": type_str}
        elif name and name.lower() not in scope:
            scope[name.lower()] = {"canonical": name, "type": type_str or "Unknown"}

    # 1. Parameters from AST
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

    # 2. Local ObjectDecl from AST (skip nested bodies)
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

    # 3. For-loop iterators from AST
    for for_loop in subp.findall(lal.ForLoopStmt):
        try:
            spec = for_loop.f_spec
            vd = spec.f_var_decl
            iter_name = vd.f_id.text
            iter_type = "Integer"
            try:
                if vd.f_id_type and vd.f_id_type.text.strip():
                    iter_type = vd.f_id_type.text.strip()
            except Exception:
                pass
            _add(iter_name, iter_type)
        except Exception:
            try:
                vd = for_loop.f_var_decl
                iter_name = vd.f_id.text
                _add(iter_name, "Integer")
            except Exception:
                pass

    # 4. Merge from THIS file's variables_info
    vi = variables_info or {}

    # Flat-list schema: locals and parameters tagged with subprogram name
    for v in vi.get("locals", []):
        if v.get("subprogram") == subp_name and v.get("name"):
            t = v.get("type", "Unknown")
            if t and t != "Unknown":
                _add(v["name"], t)
            elif v.get("name", "").lower() not in scope:
                _add(v["name"], t)

    for v in vi.get("parameters", []):
        if v.get("subprogram") == subp_name and v.get("name"):
            t = v.get("type", "Unknown")
            _add(v["name"], t)

    # ALL globals from this file
    for v in vi.get("globals", []):
        if v.get("name"):
            _add(v["name"], v.get("type", "Unknown"))

    # Legacy nested-dict schema
    for scope_key in ("local_variables", "global_variables", "global_constants"):
        subp_vars = vi.get(scope_key, {})
        # Try exact match first, then case-insensitive
        vars_for_subp = subp_vars.get(subp_name, {})
        if not vars_for_subp:
            for k, v in subp_vars.items():
                if k.lower() == subp_name.lower():
                    vars_for_subp = v
                    break
        for vname, vinfo in vars_for_subp.items():
            if vname.lower() not in scope:
                t = vinfo.get("type", "Unknown") if isinstance(vinfo, dict) else str(vinfo)
                _add(vname, t)

    # Also add ALL legacy local vars from ALL subprograms (for cross-reference)
    for other_subp, var_dict in vi.get("local_variables", {}).items():
        for vname, vinfo in var_dict.items():
            if vname.lower() not in scope:
                t = vinfo.get("type", "Unknown") if isinstance(vinfo, dict) else str(vinfo)
                if t and t != "Unknown":
                    _add(vname, t)

    # 5. Cross-file globals: merge globals from ALL other files (e.g. .ads specs)
    if all_units_vars:
        for fname, fvi in all_units_vars.items():
            if fvi is vi:
                continue  # skip current file — already processed above
            for v in fvi.get("globals", []):
                if v.get("name") and v["name"].lower() not in scope:
                    t = v.get("type", "Unknown")
                    if t and t != "Unknown":
                        _add(v["name"], t)
            # Also legacy global_variables from other files
            for subp_vars in fvi.get("global_variables", {}).values():
                for vname, vinfo in subp_vars.items():
                    if vname.lower() not in scope:
                        t = vinfo.get("type", "Unknown") if isinstance(vinfo, dict) else str(vinfo)
                        if t and t != "Unknown":
                            _add(vname, t)
            for vname, vinfo in fvi.get("global_constants", {}).items() if isinstance(fvi.get("global_constants"), dict) else []:
                if vname.lower() not in scope:
                    t = vinfo.get("type", "Unknown") if isinstance(vinfo, dict) else str(vinfo)
                    if t and t != "Unknown":
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
            # Also try basename key
            if not file_vi:
                base = unit.filename.split("/")[-1].split("\\")[-1]
                file_vi = vi_map.get(base, {})

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

                # Pass ALL files' variables_info so cross-file globals are resolved
                scope = _build_scope(subp, file_vi, subp_name, all_units_vars=vi_map)

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

                # assignments — resolve types from scope
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = _safe_text(assign.f_dest)
                        rhs = _safe_text(assign.f_expr)
                        lhs_base = lhs.split('.')[0].split('(')[0].strip()
                        if not lhs_base or lhs_base.lower() in (
                            "begin","end","is","then","else","loop","return","raise","null","when","others"
                        ):
                            continue
                        # 1. Scope lookup
                        resolved = _resolve(lhs_base, scope)
                        if resolved == "Unknown":
                            # 2. RHS inference
                            resolved = _infer_from_rhs(rhs, scope)
                        if resolved == "Unknown":
                            # 3. Scan locals list
                            lhs_lower = lhs_base.lower()
                            for v in file_vi.get("locals", []):
                                if v.get("name", "").lower() == lhs_lower:
                                    t = v.get("type", "Unknown")
                                    if t and t != "Unknown":
                                        resolved = t
                                        scope[lhs_lower] = {"canonical": lhs_base, "type": t}
                                        break
                            # 4. Also scan cross-file globals
                            if resolved == "Unknown":
                                for fname, fvi in vi_map.items():
                                    for g in fvi.get("globals", []):
                                        if g.get("name", "").lower() == lhs_lower:
                                            t = g.get("type", "Unknown")
                                            if t and t != "Unknown":
                                                resolved = t
                                                scope[lhs_lower] = {"canonical": lhs_base, "type": t}
                                                break
                                    if resolved != "Unknown":
                                        break
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
                        # 1. Scope lookup (fastest, most accurate)
                        resolved = _resolve(lhs_base, scope)
                        if resolved == "Unknown":
                            # 2. Try RHS inference with scope context
                            resolved = _infer_from_rhs(rhs, scope)
                        if resolved == "Unknown":
                            # 3. Last resort: scan locals list directly by name
                            lhs_lower = lhs_base.lower()
                            for v in file_vi.get("locals", []):
                                if v.get("name", "").lower() == lhs_lower:
                                    resolved = v.get("type", "Unknown")
                                    if resolved != "Unknown":
                                        _add(lhs_base, resolved)  # cache in scope
                                        break
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
        try:
            for ident in cond_node.findall(lal.Identifier):
                name = _safe_text(ident)
                if not name or name.lower() in keywords:
                    continue
                # Skip record field suffixes
                try:
                    p = ident.parent
                    if p and hasattr(p, 'f_suffix') and p.f_suffix == ident:
                        continue
                except Exception:
                    pass
                # Skip function call names
                try:
                    p = ident.parent
                    if p and isinstance(p, lal.CallExpr) and p.f_name == ident:
                        continue
                    if p and isinstance(p, lal.DottedName):
                        gp = p.parent
                        if gp and isinstance(gp, lal.CallExpr) and gp.f_name == p:
                            continue
                except Exception:
                    pass
                base = name.split('.')[0].split('(')[0].strip()
                base_lower = base.lower()
                if base_lower in found:
                    continue

                if base_lower in scope:
                    t = scope[base_lower]["type"]
                    canonical = scope[base_lower]["canonical"]
                    found[canonical] = {
                        "kind": "resolved",
                        "data_type": {"type": t},
                    }
                else:
                    # Not in scope — infer from name patterns
                    nl = base_lower
                    inferred = "Unknown"
                    if any(p in nl for p in ("count","index","idx","num","size","len","pos",
                                             "ret","val","n","i","j","k","vert","line","col",
                                             "width","height","offset","x","y","row","col",
                                             "max_width","max_height","char_width","char_height",
                                             "current_x","current_y")):
                        inferred = "Natural"
                    elif any(p in nl for p in ("flag","is_","has_","enabled","init",
                                               "valid","done","ready","bool","initialized",
                                               "bold","outline","first")):
                        inferred = "Boolean"
                    elif any(p in nl for p in ("ratio","rate","factor","scale","float")):
                        inferred = "Float"
                    elif any(p in nl for p in ("char","letter","symbol")) and len(nl) <= 4:
                        inferred = "Character"
                    elif any(p in nl for p in ("font","current_font")):
                        inferred = "BMP_Font"
                    elif any(p in nl for p in ("color","colour")):
                        inferred = "Bitmap_Color"
                    elif any(p in nl for p in ("point","coord","current","start","pos")):
                        inferred = "Point"

                    # Only include in output if we could infer a type
                    if inferred != "Unknown":
                        found[base] = {
                            "kind": "inferred",
                            "data_type": {"type": inferred},
                        }
                    # Skip completely unknown — don't pollute JSON with unresolved entries
        except Exception:
            pass
        return found
