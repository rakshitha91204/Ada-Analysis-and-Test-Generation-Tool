"""
variables_analysis.py
=====================
Full Ada variables extractor using:
  - GPR-based UnitProvider (lal.UnitProvider.for_project) for accurate
    cross-file semantic resolution
  - Extended TypeRegistry that recursively expands record fields
  - Output structure:
      {
        "variables_info": {
          "<file.ads>": {
            "global_variables": { ... },
            "global_constants": { ... },
            "local_variables":  { ... }
          },
          "<file.adb>": { ... }
        }
      }

Usage
-----
    python variables_analysis.py /path/to/project.gpr [output.json]

If you pass a DIRECTORY instead of a .gpr file, the tool falls back to
UnitProvider.auto so it still works without a project file.
"""

from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass, field

import libadalang as lal


# ══════════════════════════════════════════════════════════════════
#  SECTION 1 — PROJECT LOADER
# ══════════════════════════════════════════════════════════════════

def collect_ada_files(directory: str) -> list[str]:
    """Recursively collect all .adb / .ads files under *directory*."""
    result: list[str] = []
    for root, _, files in os.walk(directory):
        for f in files:
            if f.endswith((".adb", ".ads")):
                result.append(os.path.join(root, f))
    return result


def load_units_from_gpr(gpr_path: str) -> tuple[lal.AnalysisContext, list]:
    """
    Load every Ada unit in the project via the GPR project file.

    Returns (context, units) so the caller can keep the context alive
    (LAL nodes become invalid once the context is garbage-collected).
    """
    provider = lal.UnitProvider.for_project(gpr_path)
    ctx = lal.AnalysisContext(unit_provider=provider)

    # Collect source files listed in the project
    gpr_dir = os.path.dirname(os.path.abspath(gpr_path))
    ada_files = collect_ada_files(gpr_dir)

    units: list = []
    for f in ada_files:
        try:
            unit = ctx.get_from_file(f)
            if unit.root:
                units.append(unit)
            for d in unit.diagnostics:
                print(f"[DIAG] {f}: {d}", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] Could not load {f}: {e}", file=sys.stderr)

    print(f"[INFO] Loaded {len(units)} units from GPR project: {gpr_path}",
          file=sys.stderr)
    return ctx, units


def load_units_auto(directory: str) -> tuple[lal.AnalysisContext, list]:
    """
    Fallback: auto-provider from a plain directory (no GPR file).
    Cross-file semantic resolution is less reliable in this mode.
    """
    ctx = lal.AnalysisContext(
        unit_provider=lal.UnitProvider.auto([directory])
    )
    ada_files = collect_ada_files(directory)
    units: list = []
    for f in ada_files:
        try:
            unit = ctx.get_from_file(f)
            if unit.root:
                units.append(unit)
            for d in unit.diagnostics:
                print(f"[DIAG] {f}: {d}", file=sys.stderr)
        except Exception as e:
            print(f"[WARN] Could not load {f}: {e}", file=sys.stderr)

    print(f"[INFO] Loaded {len(units)} units (auto mode) from: {directory}",
          file=sys.stderr)
    return ctx, units


def load_project(path: str) -> tuple[lal.AnalysisContext, list]:
    """
    Smart loader:
      - path ends with .gpr  → GPR provider
      - path is a directory   → auto provider
      - path is a single file → auto provider on its directory
    """
    if path.endswith(".gpr"):
        return load_units_from_gpr(path)
    if os.path.isdir(path):
        return load_units_auto(path)
    if os.path.isfile(path) and path.endswith((".adb", ".ads")):
        return load_units_auto(os.path.dirname(path))
    raise FileNotFoundError(f"Cannot load project from: {path!r}")


# ══════════════════════════════════════════════════════════════════
#  SECTION 2 — LOW-LEVEL AST HELPERS
# ══════════════════════════════════════════════════════════════════

def _safe_text(node) -> str:
    """Safely extract .text from any LAL node."""
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


def _is_package_level(node) -> bool:
    """
    Return True if *node* is declared directly inside a package
    (not inside a subprogram body).
    """
    p = node.parent
    while p:
        kn = p.kind_name
        if kn in ("SubpBody", "TaskBody", "EntryBody", "ProtectedBody"):
            return False
        if kn in ("PackageBody", "PackageDecl", "GenericPackageDecl",
                  "CompilationUnit"):
            return True
        p = p.parent
    return True   # top-level → treat as global


def _enclosing_subp_name(node) -> str:
    """Return the name of the innermost enclosing subprogram, or ''."""
    p = node.parent
    while p:
        if isinstance(p, lal.SubpBody):
            try:
                return p.f_subp_spec.f_subp_name.text.strip()
            except Exception:
                return "<subprogram>"
        p = p.parent
    return ""


# ══════════════════════════════════════════════════════════════════
#  SECTION 3 — TYPE STRING FORMATTER
#  Converts LAL type/subtype nodes → human-readable strings like
#  "UINT16 range 0 .. 255"  or  "Boolean"
# ══════════════════════════════════════════════════════════════════

def _fmt_subtype_indication(node) -> str:
    """
    Format a SubtypeIndication (or any type-expression node) as a
    compact string:
        base_name [range lo .. hi] [digits N] [delta D] [mod M]
    """
    if node is None:
        return "Unknown"

    if isinstance(node, lal.SubtypeIndication):
        base = _safe_text(node.f_name) if node.f_name else _safe_text(node)
        c = node.f_constraint
        if c is None:
            return base or "Unknown"

        if isinstance(c, lal.RangeConstraint):
            r = _safe_text(c.f_range)
            if r.lower().startswith("range "):
                r = r[6:].strip()
            return f"{base} range {r}" if r else base

        if isinstance(c, lal.DigitsConstraint):
            d = _safe_text(c.f_digits)
            s = f"{base} digits {d}" if d else base
            if c.f_range:
                r = _safe_text(c.f_range)
                if r.lower().startswith("range "):
                    r = r[6:].strip()
                s += f" range {r}"
            return s

        if isinstance(c, lal.DeltaConstraint):
            d = _safe_text(c.f_delta)
            s = f"{base} delta {d}" if d else base
            if c.f_range:
                r = _safe_text(c.f_range)
                if r.lower().startswith("range "):
                    r = r[6:].strip()
                s += f" range {r}"
            return s

        if isinstance(c, lal.IndexConstraint):
            idxs = ", ".join(_safe_text(x) for x in c.f_list if x)
            return f"{base} ({idxs})"

        return base or "Unknown"

    if isinstance(node, lal.AnonymousType):
        if node.f_type_decl and node.f_type_decl.f_type_def:
            return _fmt_typedef(node.f_type_decl.f_type_def)
        return _safe_text(node) or "Unknown"

    raw = _safe_text(node)
    return raw or "Unknown"


def _fmt_typedef(tdef) -> str:
    """Format a raw TypeDef node (used for anonymous types)."""
    if tdef is None:
        return "Unknown"
    if isinstance(tdef, lal.ArrayTypeDef):
        try:
            elem = _fmt_subtype_indication(tdef.f_component_type.f_type_expr)
        except Exception:
            elem = "Unknown"
        try:
            idxs = ", ".join(_safe_text(i) for i in tdef.f_indices.f_list)
        except Exception:
            idxs = ""
        return f"array ({idxs}) of {elem}" if idxs else f"array of {elem}"
    if isinstance(tdef, lal.RecordTypeDef):
        return "record"
    return _safe_text(tdef) or "Unknown"


# ══════════════════════════════════════════════════════════════════
#  SECTION 4 — SEMANTIC TYPE RESOLUTION
#  Uses LAL's p_type to cross file boundaries (requires GPR provider)
# ══════════════════════════════════════════════════════════════════

def _semantic_type_str(node) -> str:
    """
    Ask LAL for the semantic type of *node* and format it as a string.
    Returns '' on failure so callers can fall back to syntactic parse.
    """
    try:
        typ = node.p_type
        if typ is None:
            return ""
        base = ""
        try:
            base = typ.p_defining_name.text.strip()
        except Exception:
            return ""
        if not base:
            return ""

        tdef = getattr(typ, "f_type_def", None)
        if tdef is None:
            return base

        if isinstance(tdef, lal.SignedIntTypeDef):
            try:
                r = _safe_text(tdef.f_range.f_range)
                if r.lower().startswith("range "):
                    r = r[6:].strip()
                return f"{base} range {r}" if r else base
            except Exception:
                return base

        if isinstance(tdef, lal.ModIntTypeDef):
            try:
                m = _safe_text(tdef.f_expr)
                return f"{base} mod {m}" if m else base
            except Exception:
                return base

        if isinstance(tdef, lal.FloatingPointDef):
            try:
                d = _safe_text(tdef.f_num_digits)
                s = f"{base} digits {d}" if d else base
                if tdef.f_range:
                    r = _safe_text(tdef.f_range.f_range)
                    if r.lower().startswith("range "):
                        r = r[6:].strip()
                    s += f" range {r}"
                return s
            except Exception:
                return base

        if isinstance(tdef, (lal.OrdinaryFixedPointDef,
                              lal.DecimalFixedPointDef)):
            try:
                d = _safe_text(tdef.f_delta)
                s = f"{base} delta {d}" if d else base
                if tdef.f_range:
                    r = _safe_text(tdef.f_range.f_range)
                    if r.lower().startswith("range "):
                        r = r[6:].strip()
                    s += f" range {r}"
                return s
            except Exception:
                return base

        if isinstance(tdef, lal.EnumTypeDef):
            return base

        return base
    except Exception:
        return ""


def _best_type_str(node) -> str:
    """
    Best-effort type string for an ObjectDecl or ComponentDecl node.
    Priority: semantic p_type → syntactic SubtypeIndication → raw text.
    """
    # 1. Semantic (cross-file, most accurate)
    sem = _semantic_type_str(node)
    if sem and sem not in ("Unknown", ""):
        return sem

    # 2. Syntactic
    try:
        te = node.f_type_expr
        if te:
            s = _fmt_subtype_indication(te)
            if s and s != "Unknown":
                return s
    except Exception:
        pass

    # 3. Raw text fallback
    try:
        raw = _safe_text(node.f_type_expr)
        if raw:
            return raw
    except Exception:
        pass

    return "Unknown"


# ══════════════════════════════════════════════════════════════════
#  SECTION 5 — TYPE REGISTRY  (extended with recursive record expand)
# ══════════════════════════════════════════════════════════════════

@dataclass
class _TypeInfo:
    kind: str           # enum|record|integer|modular|array|subtype|float|fixed|other
    name: str
    declared_in: str
    # enum
    enum_values: list[str] = field(default_factory=list)
    # record
    fields: dict[str, "_FieldInfo"] = field(default_factory=dict)
    # integer / modular
    range_str: str = ""
    modulus: str = ""
    # array
    element_type_name: str = ""
    element_type_str: str = ""
    indices: list[str] = field(default_factory=list)
    # subtype
    base_type: str = ""
    base_type_str: str = ""
    # float/fixed extra
    extra: dict = field(default_factory=dict)


@dataclass
class _FieldInfo:
    name: str
    type_name: str      # bare Ada type name (used for lookup)
    type_str: str       # formatted "UINT16 range 0 .. 255"
    declared_in: str


class TypeRegistry:
    """
    Single-pass syntactic scan of all units building a cross-file
    type dictionary.  Provides recursive field expansion so that a
    record type can be rendered as a deeply-nested dict.
    """

    _MAX_DEPTH = 12     # guard against circular types

    def __init__(self, units: list):
        self._types: dict[str, _TypeInfo] = {}
        for unit in units:
            if unit.root:
                self._scan_unit(unit)
        self._second_pass_subtypes()

    # ── scan ──────────────────────────────────────────────────────

    def _scan_unit(self, unit):
        fname = unit.filename
        try:
            for td in unit.root.findall(lal.TypeDecl):
                if td.f_name:
                    self._register_type(td, fname)
        except Exception as e:
            print(f"[WARN] type scan {fname}: {e}", file=sys.stderr)

        try:
            for st in unit.root.findall(lal.SubtypeDecl):
                if st.f_name:
                    self._register_subtype(st, fname)
        except Exception as e:
            print(f"[WARN] subtype scan {fname}: {e}", file=sys.stderr)

    def _register_type(self, td, fname: str):
        tname = td.f_name.text.strip()
        tdef = td.f_type_def
        info = _TypeInfo(kind="other", name=tname, declared_in=fname)

        try:
            if isinstance(tdef, lal.EnumTypeDef):
                info.kind = "enum"
                for lit in tdef.f_enum_literals:
                    info.enum_values.append(_safe_text(lit))

            elif isinstance(tdef, lal.RecordTypeDef):
                info.kind = "record"
                self._collect_record_fields(tdef, info, fname)

            elif isinstance(tdef, lal.SignedIntTypeDef):
                info.kind = "integer"
                try:
                    r = _safe_text(tdef.f_range.f_range)
                    if r.lower().startswith("range "):
                        r = r[6:].strip()
                    info.range_str = r
                except Exception:
                    pass

            elif isinstance(tdef, lal.ModIntTypeDef):
                info.kind = "modular"
                try:
                    info.modulus = _safe_text(tdef.f_expr)
                except Exception:
                    pass

            elif isinstance(tdef, lal.ArrayTypeDef):
                info.kind = "array"
                try:
                    te = tdef.f_component_type.f_type_expr
                    info.element_type_str = _fmt_subtype_indication(te)
                    info.element_type_name = (
                        te.f_name.text.strip()
                        if isinstance(te, lal.SubtypeIndication) and te.f_name
                        else info.element_type_str.split()[0]
                    )
                except Exception:
                    info.element_type_str = "Unknown"
                try:
                    info.indices = [_safe_text(i) for i in tdef.f_indices.f_list]
                except Exception:
                    pass

            elif isinstance(tdef, lal.FloatingPointDef):
                info.kind = "float"
                try:
                    info.extra["digits"] = _safe_text(tdef.f_num_digits)
                except Exception:
                    pass

            elif isinstance(tdef, (lal.OrdinaryFixedPointDef,
                                    lal.DecimalFixedPointDef)):
                info.kind = "fixed"
                try:
                    info.extra["delta"] = _safe_text(tdef.f_delta)
                except Exception:
                    pass

        except Exception as e:
            info.extra["error"] = str(e)

        self._types[tname] = info

    def _collect_record_fields(self, tdef, info: _TypeInfo, fname: str):
        """Collect all ComponentDecl fields from a RecordTypeDef."""
        try:
            for comp in tdef.findall(lal.ComponentDecl):
                if not comp.f_component_def:
                    continue
                te = comp.f_component_def.f_type_expr
                type_str = _fmt_subtype_indication(te)

                # bare name for registry lookup
                type_name = "Unknown"
                try:
                    if isinstance(te, lal.SubtypeIndication) and te.f_name:
                        type_name = te.f_name.text.strip()
                    elif isinstance(te, lal.AnonymousType):
                        type_name = type_str.split()[0]
                    else:
                        type_name = type_str.split()[0]
                except Exception:
                    pass

                for ident in comp.f_ids:
                    fname2 = ident.text.strip()
                    info.fields[fname2] = _FieldInfo(
                        name=fname2,
                        type_name=type_name,
                        type_str=type_str,
                        declared_in=fname,
                    )
        except Exception as e:
            info.extra["field_error"] = str(e)

    def _register_subtype(self, st, fname: str):
        sname = st.f_name.text.strip()
        raw_node = getattr(st, "f_subtype", None) or getattr(st, "f_type_expr", None)
        base_str = _fmt_subtype_indication(raw_node) if raw_node else "Unknown"
        base_name = base_str.split()[0]
        info = _TypeInfo(
            kind="subtype", name=sname, declared_in=fname,
            base_type=base_name, base_type_str=base_str,
        )
        self._types[sname] = info

    def _second_pass_subtypes(self):
        """Inherit enum values / range from parent type into subtypes."""
        for info in self._types.values():
            if info.kind == "subtype":
                parent = self._resolve_chain(info.base_type)
                if parent and parent.kind == "enum" and not info.enum_values:
                    info.enum_values = parent.enum_values[:]

    # ── public API ────────────────────────────────────────────────

    def lookup(self, name: str) -> _TypeInfo | None:
        return self._resolve_chain(name)

    def _resolve_chain(self, name: str, depth: int = 0) -> _TypeInfo | None:
        if not name or depth > self._MAX_DEPTH:
            return None
        info = self._types.get(name)
        if info is None:
            return None
        if info.kind == "subtype" and info.base_type and info.base_type != name:
            parent = self._resolve_chain(info.base_type, depth + 1)
            if parent:
                return parent
        return info

    # ── recursive field value expansion ───────────────────────────

    def expand_type(self, type_name: str, type_str: str,
                    depth: int = 0) -> "str | dict":
        """
        Recursively expand *type_name* into a nested dict if it is a
        record or array-of-records, or return the formatted *type_str*
        string for scalar / enum / unknown types.

        This is the key method that produces the deeply-nested JSON.
        """
        if depth > self._MAX_DEPTH:
            return type_str or type_name or "Unknown"

        info = self._resolve_chain(type_name)
        if info is None:
            # Not found in registry — return plain string
            return type_str or type_name or "Unknown"

        if info.kind == "record":
            return self._expand_record(info, depth)

        if info.kind == "array":
            return self._expand_array(info, depth)

        if info.kind == "subtype":
            parent = self._resolve_chain(info.base_type)
            if parent and parent.kind == "record":
                return self._expand_record(parent, depth)
            if parent and parent.kind == "array":
                return self._expand_array(parent, depth)
            # scalar subtype — use the base_type_str for range info
            return info.base_type_str or type_str or type_name or "Unknown"

        if info.kind == "enum":
            return type_name   # just the type name, not the whole enum listing

        if info.kind == "integer":
            s = type_name
            if info.range_str:
                s += f" range {info.range_str}"
            return s

        if info.kind == "modular":
            s = type_name
            if info.modulus:
                s += f" mod {info.modulus}"
            return s

        if info.kind == "float":
            s = type_name
            if info.extra.get("digits"):
                s += f" digits {info.extra['digits']}"
            return s

        if info.kind == "fixed":
            s = type_name
            if info.extra.get("delta"):
                s += f" delta {info.extra['delta']}"
            return s

        return type_str or type_name or "Unknown"

    def _expand_record(self, info: _TypeInfo, depth: int) -> dict:
        """Return a dict mapping field_name → expanded type."""
        out: dict = {}
        for fname, finfo in info.fields.items():
            out[fname] = self.expand_type(finfo.type_name, finfo.type_str,
                                          depth + 1)
        return {info.name: out}

    def _expand_array(self, info: _TypeInfo, depth: int) -> dict:
        """
        For an array type, expand the element type.
        Returns { ArrayTypeName: { ElementTypeName: expanded } }
        """
        elem_name = info.element_type_name
        elem_str  = info.element_type_str
        expanded  = self.expand_type(elem_name, elem_str, depth + 1)
        return {info.name: expanded}

    def expand_object(self, type_str: str) -> "str | dict":
        """
        Entry point: given the formatted type string of an ObjectDecl,
        expand it into a nested dict (record/array) or leave as string.
        """
        type_name = type_str.split()[0]
        return self.expand_type(type_name, type_str)


# ══════════════════════════════════════════════════════════════════
#  SECTION 6 — SCOPE CLASSIFIER
# ══════════════════════════════════════════════════════════════════

def _classify_scope(obj_node) -> str:
    """
    Returns 'global', 'constant', or 'local'.
    - constant  : ObjectDecl with 'constant' keyword (anywhere)
    - global    : package-level non-constant
    - local     : subprogram-level
    """
    # Check constant first
    try:
        if obj_node.f_has_constant.kind_name == "ConstantPresent":
            return "constant"
    except Exception:
        pass

    if _is_package_level(obj_node):
        return "global"
    return "local"


# ══════════════════════════════════════════════════════════════════
#  SECTION 7 — PER-FILE VARIABLE EXTRACTOR
# ══════════════════════════════════════════════════════════════════

class VariablesExtractor:
    """
    Scans all ObjectDecl nodes in every unit and organises them into:
        global_variables  — package-level, non-constant
        global_constants  — package-level, constant
        local_variables   — subprogram-level (any)
    Each variable value is the result of TypeRegistry.expand_object(),
    which produces a nested dict for record/array types or a plain
    "TYPE range lo .. hi" string for scalar types.
    """

    def __init__(self, units: list, registry: TypeRegistry):
        self.units = units
        self.reg = registry

    def run(self) -> dict:
        """Return the full variables_info dict keyed by filename."""
        result: dict = {}
        for unit in self.units:
            if not unit.root:
                continue
            fname = unit.filename
            entry = self._extract_file(unit)
            result[fname] = entry
        return result

    def _extract_file(self, unit) -> dict:
        global_vars: dict = {}
        global_consts: dict = {}
        local_vars: dict = {}

        try:
            for obj in unit.root.findall(lal.ObjectDecl):
                self._process_obj(obj, global_vars, global_consts, local_vars)
        except Exception as e:
            print(f"[WARN] extract {unit.filename}: {e}", file=sys.stderr)

        return {
            "global_variables": global_vars,
            "global_constants": global_consts,
            "local_variables":  local_vars,
        }

    def _process_obj(self, obj, gv: dict, gc: dict, lv: dict):
        scope = _classify_scope(obj)

        # Get the best type string (semantic first, then syntactic)
        type_str = _best_type_str(obj)

        # Expand into nested dict (or keep as plain string)
        expanded = self.reg.expand_object(type_str)

        # Collect all identifiers declared in this ObjectDecl
        for ident in obj.f_ids:
            vname = ident.text.strip()
            if not vname:
                continue

            value = expanded
            # If multiple identifiers share same ObjectDecl, each gets same type
            if scope == "constant":
                gc[vname] = value
            elif scope == "global":
                gv[vname] = value
            else:
                lv[vname] = value


# ══════════════════════════════════════════════════════════════════
#  SECTION 8 — MAIN EXTRACTOR  (top-level entry point)
# ══════════════════════════════════════════════════════════════════

class VariablesAnalyzer:
    """
    Main entry point for the variables analysis.

    Example
    -------
        ctx, units = load_project("/path/to/project.gpr")
        analyzer   = VariablesAnalyzer(units)
        report     = analyzer.run()
        print(json.dumps(report, indent=4))
    """

    def __init__(self, units: list):
        self.units = units

    def run(self) -> dict:
        print("[INFO] Building type registry …", file=sys.stderr)
        registry = TypeRegistry(self.units)

        print("[INFO] Extracting variables …", file=sys.stderr)
        extractor = VariablesExtractor(self.units, registry)
        variables_info = extractor.run()

        return {"variables_info": variables_info}


# ══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(
            "Usage: python variables_analysis.py <project.gpr | src_dir> [output.json]",
            file=sys.stderr,
        )
        sys.exit(1)

    project_path = sys.argv[1]
    output_path  = sys.argv[2] if len(sys.argv) > 2 else None

    # Load all units (GPR-based or auto)
    _ctx, units = load_project(project_path)

    # Run analysis
    analyzer = VariablesAnalyzer(units)
    report   = analyzer.run()

    # Serialise
    json_str = json.dumps(report, indent=4, default=str)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as fh:
            fh.write(json_str)
        print(f"[INFO] Report written to: {output_path}", file=sys.stderr)
    else:
        print(json_str)