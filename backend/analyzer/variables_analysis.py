# variables_analysis.py — flat per-variable entries with line numbers,
# scope, mode, initializer, global-usage tracking, and full type expansion.
#
# Type resolution uses a 3-tier approach (from test/test.py):
#   1. Semantic  — lal.p_type (cross-file, most accurate, requires GPR)
#   2. Syntactic — f_type_expr SubtypeIndication parse (always works)
#   3. Raw text  — f_type_expr.text fallback
#
# TypeRegistry recursively expands record / array / enum types into
# nested dicts so the JSON shows structured type information.

from __future__ import annotations
from dataclasses import dataclass, field
import libadalang as lal


# ── AST helpers ───────────────────────────────────────────────────────────────

def _safe_text(node) -> str:
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


def _is_package_level(node) -> bool:
    """True if node is declared directly inside a package (not a subprogram)."""
    p = node.parent
    while p:
        kn = p.kind_name
        if kn in ("SubpBody", "TaskBody", "EntryBody", "ProtectedBody"):
            return False
        if kn in ("PackageBody", "PackageDecl", "GenericPackageDecl",
                  "CompilationUnit"):
            return True
        p = p.parent
    return True


def _enclosing_subp_name(node) -> str:
    """Return the name of the innermost enclosing subprogram body, or ''."""
    p = node.parent
    while p:
        if isinstance(p, lal.SubpBody):
            try:
                return p.f_subp_spec.f_subp_name.text.strip()
            except Exception:
                return "<subprogram>"
        p = p.parent
    return ""


def _fmt_subtype_indication(node) -> str:
    """Format a SubtypeIndication (or any type-expression node) as a compact string."""
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
        try:
            if node.f_type_decl and node.f_type_decl.f_type_def:
                return _fmt_typedef(node.f_type_decl.f_type_def)
        except Exception:
            pass
        return _safe_text(node) or "Unknown"

    return _safe_text(node) or "Unknown"


def _fmt_typedef(tdef) -> str:
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


def _semantic_type_str(node) -> str:
    """Ask LAL for the semantic type — returns '' on failure."""
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
                return f"{base} digits {d}" if d else base
            except Exception:
                return base
        if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
            try:
                d = _safe_text(tdef.f_delta)
                return f"{base} delta {d}" if d else base
            except Exception:
                return base
        return base
    except Exception:
        return ""


def _best_type_str(node) -> str:
    """
    Best-effort type string for an ObjectDecl or ParamSpec node.
    Priority: semantic p_type → syntactic SubtypeIndication → raw text → attribute lookup.
    """
    # 1. Semantic (cross-file, most accurate when GPR is available)
    sem = _semantic_type_str(node)
    if sem and sem not in ("Unknown", ""):
        return sem
    # 2. Syntactic SubtypeIndication parse
    try:
        te = node.f_type_expr
        if te:
            s = _fmt_subtype_indication(te)
            if s and s != "Unknown":
                return s
    except Exception:
        pass
    # 3. Raw text of type expression
    try:
        raw = _safe_text(node.f_type_expr)
        if raw:
            return raw
    except Exception:
        pass
    # 4. For ParamSpec — try f_type_expr directly via text
    try:
        if hasattr(node, 'f_type_expr') and node.f_type_expr:
            t = node.f_type_expr.text.strip()
            if t:
                return t
    except Exception:
        pass
    return "Unknown"


# ── TypeRegistry — recursive record/array/enum type expansion ─────────────────

@dataclass
class _TypeInfo:
    kind: str           # enum|record|integer|modular|array|subtype|float|fixed|other
    name: str
    declared_in: str
    enum_values: list = field(default_factory=list)
    fields: dict = field(default_factory=dict)   # field_name -> _FieldInfo
    range_str: str = ""
    modulus: str = ""
    element_type_name: str = ""
    element_type_str: str = ""
    indices: list = field(default_factory=list)
    base_type: str = ""
    base_type_str: str = ""
    extra: dict = field(default_factory=dict)


@dataclass
class _FieldInfo:
    name: str
    type_name: str      # bare Ada type name (for registry lookup)
    type_str: str       # formatted string e.g. "UINT16 range 0 .. 255"
    declared_in: str


class TypeRegistry:
    """
    Single-pass syntactic scan of all units building a cross-file
    type dictionary. Provides recursive field expansion so record types
    are rendered as deeply-nested dicts in the JSON output.
    """
    _MAX_DEPTH = 12

    def __init__(self, units: list):
        self._types: dict[str, _TypeInfo] = {}
        for unit in units:
            if unit.root:
                self._scan_unit(unit)
        self._second_pass_subtypes()

    def _scan_unit(self, unit):
        fname = unit.filename
        try:
            for td in unit.root.findall(lal.TypeDecl):
                if td.f_name:
                    self._register_type(td, fname)
        except Exception:
            pass
        try:
            for st in unit.root.findall(lal.SubtypeDecl):
                if st.f_name:
                    self._register_subtype(st, fname)
        except Exception:
            pass

    def _register_type(self, td, fname: str):
        tname = td.f_name.text.strip()
        tdef  = td.f_type_def
        info  = _TypeInfo(kind="other", name=tname, declared_in=fname)
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
                    info.element_type_str  = _fmt_subtype_indication(te)
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
        """Collect all ComponentDecl fields from a RecordTypeDef into info.fields."""
        try:
            for comp in tdef.findall(lal.ComponentDecl):
                if not comp.f_component_def:
                    continue
                te = comp.f_component_def.f_type_expr
                type_str = _fmt_subtype_indication(te)
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
                        name=fname2, type_name=type_name,
                        type_str=type_str, declared_in=fname,
                    )
        except Exception as e:
            info.extra["field_error"] = str(e)

    def _register_subtype(self, st, fname: str):
        sname    = st.f_name.text.strip()
        raw_node = getattr(st, "f_subtype", None) or getattr(st, "f_type_expr", None)
        base_str = _fmt_subtype_indication(raw_node) if raw_node else "Unknown"
        base_name = base_str.split()[0]
        info = _TypeInfo(
            kind="subtype", name=sname, declared_in=fname,
            base_type=base_name, base_type_str=base_str,
        )
        self._types[sname] = info

    def _second_pass_subtypes(self):
        """Inherit enum values from parent type into subtypes."""
        for info in self._types.values():
            if info.kind == "subtype":
                parent = self._resolve_chain(info.base_type)
                if parent and parent.kind == "enum" and not info.enum_values:
                    info.enum_values = parent.enum_values[:]

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

    def expand_type(self, type_name: str, type_str: str, depth: int = 0):
        """
        Recursively expand type_name:
        - record  → nested dict of fields
        - array   → {ArrayType: expanded_element}
        - scalar  → type_str string
        """
        if depth > self._MAX_DEPTH:
            return type_str or type_name or "Unknown"

        info = self._resolve_chain(type_name)
        if info is None:
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
            return info.base_type_str or type_str or type_name or "Unknown"

        if info.kind == "enum":
            return type_name

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
            out[fname] = self.expand_type(finfo.type_name, finfo.type_str, depth + 1)
        return {info.name: out}

    def _expand_array(self, info: _TypeInfo, depth: int):
        """Expand array element type; returns {ArrayName: expanded_element}."""
        expanded = self.expand_type(
            info.element_type_name, info.element_type_str, depth + 1
        )
        return {info.name: expanded}

    def expand_object(self, type_str: str):
        """Entry point: expand a variable's type string into nested dict or plain string."""
        type_name = type_str.split()[0] if type_str else "Unknown"
        return self.expand_type(type_name, type_str)

    def enum_values(self, type_name: str) -> list:
        """Return enum literal list for a type name, or []."""
        info = self._resolve_chain(type_name)
        return info.enum_values if info and info.enum_values else []

    def to_dict(self) -> dict:
        """Serialise the full registry — stored as __registry__ in the result."""
        out: dict = {"types": {}, "objects": {}}
        for k, v in self._types.items():
            out["types"][k] = {
                "kind":        v.kind,
                "name":        v.name,
                "declared_in": v.declared_in,
                "enum_values": v.enum_values,
                "record_fields": {
                    fn: {"raw_type": fi.type_str,
                         "structured_type": {"type": fi.type_str},
                         "declared_in": fi.declared_in}
                    for fn, fi in v.fields.items()
                },
                "range_str":          v.range_str,
                "modulus":            v.modulus,
                "element_type_name":  v.element_type_name,
                "element_type_str":   v.element_type_str,
                "base_type":          v.base_type,
                "base_type_str":      v.base_type_str,
            }
        return out


# ── Scope classifier ──────────────────────────────────────────────────────────

def _classify_scope(obj_node) -> str:
    """
    Classify an ObjectDecl's scope:
      'constant' — has 'constant' keyword (anywhere)
      'global'   — package-level non-constant
      'local'    — subprogram-level
    """
    try:
        if obj_node.f_has_constant.kind_name == "ConstantPresent":
            return "constant"
    except Exception:
        pass
    if _is_package_level(obj_node):
        return "global"
    return "local"


# ── VariablesExtractor — clean per-file extraction using TypeRegistry ─────────

class VariablesExtractor:
    """
    Scans all ObjectDecl nodes in every unit and organises them into:
        global_variables  — package-level, non-constant
        global_constants  — package-level, constant
        local_variables   — subprogram-level
    Each variable value is the result of TypeRegistry.expand_object(),
    which produces a nested dict for record/array types or a plain
    type string for scalar types.

    This class mirrors the VariablesExtractor from test/test.py.
    It is used internally by VariablesAnalyzer and can also be used
    standalone when you only need the simple per-file variable dict.
    """

    def __init__(self, units: list, registry: TypeRegistry):
        self.units = units
        self.reg   = registry

    def run(self) -> dict:
        """Return variables_info dict keyed by filename."""
        result: dict = {}
        for unit in self.units:
            if not unit.root:
                continue
            result[unit.filename] = self._extract_file(unit)
        return result

    def _extract_file(self, unit) -> dict:
        global_vars:   dict = {}
        global_consts: dict = {}
        local_vars:    dict = {}

        try:
            for obj in unit.root.findall(lal.ObjectDecl):
                self._process_obj(obj, global_vars, global_consts, local_vars)
        except Exception:
            pass

        return {
            "global_variables": global_vars,
            "global_constants": global_consts,
            "local_variables":  local_vars,
        }

    def _process_obj(self, obj, gv: dict, gc: dict, lv: dict):
        """Process one ObjectDecl into the appropriate bucket."""
        scope    = _classify_scope(obj)
        type_str = _best_type_str(obj)
        expanded = self.reg.expand_object(type_str)

        # Determine owning subprogram name for locals
        subp_name = _enclosing_subp_name(obj) if scope == "local" else ""

        for ident in obj.f_ids:
            vname = ident.text.strip()
            if not vname:
                continue
            value = {
                "type":          type_str,
                "expanded_type": expanded,
            }
            if subp_name:
                value["subprogram"] = subp_name

            if scope == "constant":
                gc[vname] = value
            elif scope == "global":
                gv[vname] = value
            else:
                # Group locals by subprogram name
                bucket = lv.setdefault(subp_name, {})
                bucket[vname] = value


# ── Main analyzer ─────────────────────────────────────────────────────────────

class VariablesAnalyzer:
    def __init__(self, units):
        self.units = units

    @staticmethod
    def _is_global_object(obj):
        return _is_package_level(obj)

    @staticmethod
    def _get_default(obj):
        try:
            if obj.f_default_expr:
                return obj.f_default_expr.text.strip()
        except Exception:
            pass
        return None

    @staticmethod
    def _is_constant(obj):
        try:
            return obj.f_has_constant.kind_name == "ConstantPresent"
        except Exception:
            return False

    @staticmethod
    def _get_mode(param):
        try:
            mode = param.f_mode.text.strip()
            return mode if mode else "in"
        except Exception:
            return "in"

    def extract(self) -> dict:
        # Build type registry across ALL units first
        registry = TypeRegistry(self.units)

        # Pass 1: collect ALL package-level globals across every unit
        all_globals: dict = {}
        for unit in self.units:
            for obj in unit.root.findall(lal.ObjectDecl):
                if not self._is_global_object(obj):
                    continue
                type_str = _best_type_str(obj)
                is_const = self._is_constant(obj)
                default  = self._get_default(obj)
                try:
                    line = obj.sloc_range.start.line
                except Exception:
                    line = 0
                for ident in obj.f_ids:
                    name = ident.text
                    all_globals[name.lower()] = {
                        "name": name, "type": type_str,
                        "expanded_type": registry.expand_object(type_str),
                        "is_constant": is_const, "default": default,
                        "line": line, "file": unit.filename,
                    }

        # Pass 2: per-unit detailed extraction
        result: dict = {}
        for unit in self.units:
            filename = unit.filename
            globals_list:    list = []
            locals_list:     list = []
            parameters_list: list = []
            global_usage:    dict = {}

            # Package-level globals declared in THIS file
            for obj in unit.root.findall(lal.ObjectDecl):
                if not self._is_global_object(obj):
                    continue
                type_str = _best_type_str(obj)
                is_const = self._is_constant(obj)
                default  = self._get_default(obj)
                try:
                    line = obj.sloc_range.start.line
                except Exception:
                    line = 0
                for ident in obj.f_ids:
                    globals_list.append({
                        "name": ident.text,
                        "type": type_str,
                        "expanded_type": registry.expand_object(type_str),
                        "is_constant": is_const,
                        "default": default,
                        "line": line,
                    })

            # Per-subprogram: locals, parameters, global usage
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                # Parameters
                try:
                    for param in subp.f_subp_spec.f_subp_params.f_params:
                        ptype = "Unknown"
                        try:
                            ptype = _best_type_str(param) or "Unknown"
                            # Double-fallback: try raw text if semantic resolution failed
                            if ptype == "Unknown":
                                try:
                                    ptype = param.f_type_expr.text.strip() or "Unknown"
                                except Exception:
                                    pass
                        except Exception as e:
                            # Log but don't swallow — try raw text as last resort
                            try:
                                ptype = param.f_type_expr.text.strip() or "Unknown"
                            except Exception:
                                pass
                        mode = self._get_mode(param)
                        try:
                            pline = param.sloc_range.start.line
                        except Exception:
                            pline = 0
                        for pident in param.f_ids:
                            parameters_list.append({
                                "name": pident.text,
                                "type": ptype,
                                "expanded_type": registry.expand_object(ptype),
                                "mode": mode,
                                "line": pline,
                                "subprogram": subp_name,
                            })
                except Exception:
                    pass

                # Local variables (skip nested subprogram bodies)
                for obj in subp.findall(lal.ObjectDecl):
                    parent = obj.parent
                    in_nested = False
                    while parent and parent != subp:
                        if isinstance(parent, lal.SubpBody):
                            in_nested = True
                            break
                        parent = parent.parent
                    if in_nested:
                        continue
                    type_str = _best_type_str(obj)
                    is_const = self._is_constant(obj)
                    default  = self._get_default(obj)
                    try:
                        line = obj.sloc_range.start.line
                    except Exception:
                        line = 0
                    for ident in obj.f_ids:
                        locals_list.append({
                            "name": ident.text,
                            "type": type_str,
                            "expanded_type": registry.expand_object(type_str),
                            "is_constant": is_const,
                            "default": default,
                            "line": line,
                            "subprogram": subp_name,
                        })

                # Global reads / writes
                reads:  set = set()
                writes: set = set()
                for assign in subp.findall(lal.AssignStmt):
                    try:
                        lhs = assign.f_dest.text.strip().split('.')[0].split('(')[0].strip()
                        if lhs.lower() in all_globals:
                            writes.add(all_globals[lhs.lower()]["name"])
                    except Exception:
                        pass
                for name_node in subp.findall(lal.Name):
                    try:
                        n = name_node.text.strip()
                        if n.lower() in all_globals:
                            canonical = all_globals[n.lower()]["name"]
                            if canonical not in writes:
                                reads.add(canonical)
                    except Exception:
                        pass
                if reads or writes:
                    global_usage[subp_name] = {
                        "reads": sorted(reads),
                        "writes": sorted(writes),
                    }

            # ── Build legacy compat keys ───────────────────────────────────
            all_subp_names = set(v["subprogram"] for v in locals_list)
            for v in parameters_list:
                all_subp_names.add(v["subprogram"])
            for subp_n in global_usage:
                all_subp_names.add(subp_n)

            legacy_global_vars: dict   = {s: {} for s in all_subp_names}
            legacy_global_consts: dict = {s: {} for s in all_subp_names}

            for subp_n, usage in global_usage.items():
                for gname in usage.get("reads", []) + usage.get("writes", []):
                    meta = all_globals.get(gname.lower(), {})
                    entry = {
                        "type": meta.get("type", "Unknown"),
                        "expanded_type": meta.get("expanded_type", meta.get("type", "Unknown")),
                    }
                    if meta.get("is_constant"):
                        legacy_global_consts.setdefault(subp_n, {})[gname] = entry
                    else:
                        legacy_global_vars.setdefault(subp_n, {})[gname] = entry

            legacy_local_vars = {
                subp_n: {
                    v["name"]: {
                        "type": v["type"],
                        "expanded_type": v.get("expanded_type", v["type"]),
                    }
                    for v in locals_list if v["subprogram"] == subp_n
                }
                for subp_n in all_subp_names
            }

            # ── VariablesExtractor simple dict (from test/test.py pattern) ──
            extractor_result = VariablesExtractor([unit], registry)._extract_file(unit)

            result[filename] = {
                "globals":      globals_list,
                "locals":       locals_list,
                "parameters":   parameters_list,
                "global_usage": global_usage,
                "summary": {
                    "total_globals":   len(globals_list),
                    "total_constants": sum(1 for g in globals_list if g["is_constant"]),
                    "total_locals":    len(locals_list),
                    "total_params":    len(parameters_list),
                },
                # Legacy compatibility keys (used by control_flow_extractor + server.py)
                "global_variables": legacy_global_vars,
                "global_constants": legacy_global_consts,
                "local_variables":  legacy_local_vars,
                # Structured extractor output (subprogram-grouped, with expanded_type)
                "variables_by_scope": extractor_result,
                # Type registry for cross-file field type resolution
                "__registry__": registry.to_dict(),
            }

        return result

    # Alias so callers can use either .extract() or .run()
    def run(self) -> dict:
        """Alias for extract() — matches test/test.py VariablesAnalyzer.run() API."""
        return self.extract()
