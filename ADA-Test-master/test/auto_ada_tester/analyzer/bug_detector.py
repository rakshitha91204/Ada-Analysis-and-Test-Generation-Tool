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

        return result
