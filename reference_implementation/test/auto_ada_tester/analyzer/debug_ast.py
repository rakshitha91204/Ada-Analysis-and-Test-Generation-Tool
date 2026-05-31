"""
debug_ast.py  —  run this FIRST on your .adb file
Usage:  python debug_ast.py /path/to/starsensormode.adb
"""
import sys
import libadalang as lal

def print_tree(node, indent=0, max_depth=5):
    if node is None or indent > max_depth:
        return
    try:
        txt = repr(node.text[:60]) if node.text else ""
    except Exception:
        txt = ""
    print("  " * indent + f"[{node.kind_name}] {txt}")
    try:
        for child in node.children:
            print_tree(child, indent + 1, max_depth)
    except Exception:
        pass

def probe(subp):
    name = "?"
    try:
        name = subp.f_subp_spec.f_subp_name.text
    except Exception:
        pass
    print(f"\n{'='*60}\nSubpBody: {name}\n{'='*60}")

    print("\n[A] subp direct children kinds:")
    try:
        for i, c in enumerate(subp.children):
            print(f"  {i}: {c.kind_name if c else 'None'}")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n[B] subp.f_body:")
    try:
        b = subp.f_body
        print(f"  kind: {b.kind_name if b else 'None'}")
        if b:
            print_tree(b, indent=2, max_depth=3)
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n[C] subp.f_body.f_stmts:")
    try:
        stmts = list(subp.f_body.f_stmts)
        print(f"  count: {len(stmts)}")
        for i, s in enumerate(stmts[:5]):
            print(f"  [{i}] {s.kind_name} | {repr(s.text[:60]) if s.text else ''}")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n[D] findall(HandledStmts):")
    try:
        for hs in subp.findall(lal.HandledStmts):
            stmts = list(hs.f_stmts)
            print(f"  HandledStmts → {len(stmts)} stmts")
            for i, s in enumerate(stmts[:5]):
                print(f"    [{i}] {s.kind_name} | {repr(s.text[:60]) if s.text else ''}")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n[E] findall(IfStmt):")
    try:
        ifs = subp.findall(lal.IfStmt)
        print(f"  {len(ifs)} found")
        for n in ifs[:2]:
            print(f"  cond: {repr(n.f_cond_expr.text[:60]) if n.f_cond_expr else 'None'}")
    except Exception as e:
        print(f"  ERROR: {e}")

    print("\n[F] findall(AssignStmt):")
    try:
        assigns = subp.findall(lal.AssignStmt)
        print(f"  {len(assigns)} found")
        for a in assigns[:3]:
            print(f"  {repr(a.text[:60]) if a.text else ''}")
    except Exception as e:
        print(f"  ERROR: {e}")

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/your/file.adb"
    ctx  = lal.AnalysisContext()
    unit = ctx.get_from_file(path)
    if unit.diagnostics:
        print("DIAGNOSTICS:")
        for d in unit.diagnostics:
            print(f"  {d}")
    if not unit.root:
        print("No root — parse failed")
        return
    subps = unit.root.findall(lal.SubpBody)
    print(f"Found {len(subps)} SubpBody nodes")
    for subp in subps[:3]:
        probe(subp)

if __name__ == "__main__":
    main()