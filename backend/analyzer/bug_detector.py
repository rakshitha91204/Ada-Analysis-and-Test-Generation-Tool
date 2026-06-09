# bug_detector.py
# Detects common Ada bug patterns using libadalang AST analysis.
import libadalang as lal


class BugDetector:
    """
    Detects common Ada bug patterns:
      - Division by zero (literal 0 on RHS of /)
      - Uninitialized variable use (ObjectDecl with no default, used before assignment)
      - Null dereference patterns (access type dereferenced without null check)
      - Infinite loop candidates (loop with no exit statement)
      - Unreachable code after unconditional return/raise
    """

    def __init__(self, units):
        self.units = units

    @staticmethod
    def _has_null_guard(node) -> bool:
        """Return True if there is an enclosing if-statement that checks for null
        on the same prefix, indicating the dereference is guarded."""
        try:
            prefix_text = node.f_prefix.text.strip().lower() if node.f_prefix else ""
        except Exception:
            return False

        parent = node.parent
        while parent:
            if isinstance(parent, lal.IfStmt):
                try:
                    cond = (parent.f_cond_expr.text or "").lower()
                    # Patterns: "ptr /= null", "ptr != null", "not (ptr = null)"
                    if prefix_text and (
                        f"{prefix_text} /= null" in cond
                        or f"{prefix_text} != null" in cond
                        or f"not ({prefix_text} = null)" in cond
                        or f"{prefix_text} \\= null" in cond
                    ):
                        return True
                except Exception:
                    pass
            parent = parent.parent
        return False

    def detect(self) -> dict:
        result = {
            "division_by_zero": [],
            "uninitialized_variables": [],
            "null_dereference": [],
            "infinite_loops": [],
            "unreachable_code": [],
        }

        for unit in self.units:
            filename = unit.filename

            # ── Division by zero ──────────────────────────────────────────
            for binop in unit.root.findall(lal.BinOp):
                try:
                    if binop.f_op.text == "/":
                        rhs = binop.f_right
                        rhs_text = rhs.text.strip() if rhs and rhs.text else ""
                        if rhs_text in ("0", "0.0", "0.0E0"):
                            result["division_by_zero"].append({
                                "file": filename,
                                "line": binop.sloc_range.start.line,
                                "expression": binop.text.strip()[:80] if binop.text else "",
                            })
                except Exception:
                    pass

            # ── Null dereference (access .all without null check nearby) ──
            for deref in unit.root.findall(lal.ExplicitDeref):
                try:
                    if self._has_null_guard(deref):
                        continue
                    prefix_text = deref.f_prefix.text.strip() if deref.f_prefix and deref.f_prefix.text else ""
                    result["null_dereference"].append({
                        "file": filename,
                        "line": deref.sloc_range.start.line,
                        "expression": f"{prefix_text}.all",
                    })
                except Exception:
                    pass

            # ── Infinite loops (loop with no exit statement) ───────────────
            for loop in unit.root.findall(lal.LoopStmt):
                try:
                    exits = list(loop.findall(lal.ExitStmt))
                    returns = list(loop.findall(lal.ReturnStmt))
                    raises = list(loop.findall(lal.RaiseStmt))
                    if not exits and not returns and not raises:
                        result["infinite_loops"].append({
                            "file": filename,
                            "line": loop.sloc_range.start.line,
                            "note": "Loop has no exit/return/raise — possible infinite loop",
                        })
                except Exception:
                    pass

            # ── Uninitialized variables ───────────────────────────────────────
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = (
                        subp.f_subp_spec.f_subp_name.text
                        if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
                        else "?"
                    )

                    # Collect ObjectDecl vars with no default value at the top
                    # level of the subprogram's declarative region.
                    uninit: dict = {}  # lower-name -> (canonical_name, line)
                    try:
                        decls = list(subp.f_decls.f_decls) if subp.f_decls else []
                    except Exception:
                        decls = []
                    for decl in decls:
                        if not isinstance(decl, lal.ObjectDecl):
                            continue
                        try:
                            # Skip constants (they always have a value)
                            is_const = (
                                decl.f_has_constant.kind_name == "ConstantPresent"
                            )
                            if is_const:
                                continue
                            # Skip if there is a default expression
                            if decl.f_default_expr is not None:
                                continue
                            decl_line = decl.sloc_range.start.line
                            for ident in decl.f_ids:
                                canonical = ident.text
                                uninit[canonical.lower()] = (canonical, decl_line)
                        except Exception:
                            continue

                    if not uninit:
                        continue

                    # Walk the top-level statement list linearly.
                    # Track which names have been assigned; flag a name the
                    # first time it appears in a Name node *before* any
                    # AssignStmt whose LHS matches it.
                    try:
                        stmts = list(subp.f_body.f_stmts) if subp.f_body else []
                    except Exception:
                        stmts = []

                    assigned: set = set()   # lower-case names assigned so far
                    flagged:  set = set()   # already reported — report once

                    for stmt in stmts:
                        # First check if this statement is an AssignStmt
                        if isinstance(stmt, lal.AssignStmt):
                            try:
                                lhs_text = stmt.f_dest.text.strip().lower()
                                if lhs_text in uninit:
                                    assigned.add(lhs_text)
                            except Exception:
                                pass
                            # Still scan the RHS for reads of uninit vars
                            try:
                                rhs = stmt.f_expr
                                for name_node in rhs.findall(lal.Name):
                                    try:
                                        n = name_node.text.strip().lower()
                                        if (
                                            n in uninit
                                            and n not in assigned
                                            and n not in flagged
                                        ):
                                            canonical, _ = uninit[n]
                                            flagged.add(n)
                                            result["uninitialized_variables"].append({
                                                "file":       filename,
                                                "line":       name_node.sloc_range.start.line,
                                                "subprogram": subp_name,
                                                "statement":  canonical,
                                                "note":       "possibly uninitialized",
                                            })
                                    except Exception:
                                        pass
                            except Exception:
                                pass
                        else:
                            # Non-assignment statement — any Name reference to an
                            # uninit var that has not yet been assigned is flagged.
                            for name_node in stmt.findall(lal.Name):
                                try:
                                    n = name_node.text.strip().lower()
                                    if (
                                        n in uninit
                                        and n not in assigned
                                        and n not in flagged
                                    ):
                                        canonical, _ = uninit[n]
                                        flagged.add(n)
                                        result["uninitialized_variables"].append({
                                            "file":       filename,
                                            "line":       name_node.sloc_range.start.line,
                                            "subprogram": subp_name,
                                            "statement":  canonical,
                                            "note":       "possibly uninitialized",
                                        })
                                except Exception:
                                    pass
                except Exception:
                    pass

            # ── Unreachable code after unconditional return/raise ──────────
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    stmts = list(subp.f_body.f_stmts) if subp.f_body else []
                    found_terminal = False
                    for stmt in stmts:
                        if found_terminal:
                            result["unreachable_code"].append({
                                "file": filename,
                                "line": stmt.sloc_range.start.line,
                                "subprogram": subp.f_subp_spec.f_subp_name.text
                                if subp.f_subp_spec and subp.f_subp_spec.f_subp_name else "?",
                                "statement": stmt.text.strip()[:80] if stmt.text else "",
                            })
                        if isinstance(stmt, (lal.ReturnStmt, lal.RaiseStmt)):
                            found_terminal = True
                        else:
                            found_terminal = False
                except Exception:
                    pass

            # ── Uninitialized variable use ────────────────────────────────
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "?"

                # Collect locals with no default value (skip constants)
                no_default: dict = {}
                for obj in subp.findall(lal.ObjectDecl):
                    p = obj.parent
                    nested = False
                    while p and p != subp:
                        if isinstance(p, lal.SubpBody):
                            nested = True
                            break
                        p = p.parent
                    if nested:
                        continue
                    try:
                        is_const = obj.f_has_constant.kind_name == "ConstantPresent"
                    except Exception:
                        is_const = False
                    if is_const:
                        continue
                    has_default = False
                    try:
                        has_default = obj.f_default_expr is not None
                    except Exception:
                        pass
                    if has_default:
                        continue
                    try:
                        decl_line = obj.sloc_range.start.line
                    except Exception:
                        decl_line = 0
                    for ident in obj.f_ids:
                        vname = ident.text
                        no_default[vname.lower()] = {"name": vname, "line": decl_line}

                if not no_default:
                    continue

                # Walk statements; flag vars used before any assignment
                assigned_set: set = set()
                try:
                    stmts = list(subp.f_body.f_stmts)
                except Exception:
                    stmts = []

                reported: set = set()
                for stmt in stmts:
                    if isinstance(stmt, lal.AssignStmt):
                        try:
                            lhs = stmt.f_dest.text.strip().split('.')[0].split('(')[0].strip()
                            assigned_set.add(lhs.lower())
                        except Exception:
                            pass
                    else:
                        for name_node in stmt.findall(lal.Identifier):
                            try:
                                n  = name_node.text.strip()
                                nl = n.lower()
                                if nl in no_default and nl not in assigned_set and nl not in reported:
                                    try:
                                        use_line = name_node.sloc_range.start.line
                                    except Exception:
                                        use_line = no_default[nl]["line"]
                                    result["uninitialized_variables"].append({
                                        "file":       filename,
                                        "line":       use_line,
                                        "subprogram": subp_name,
                                        "statement":  no_default[nl]["name"],
                                        "note":       f"'{no_default[nl]['name']}' may be used before initialization",
                                    })
                                    reported.add(nl)
                            except Exception:
                                pass

        return result
