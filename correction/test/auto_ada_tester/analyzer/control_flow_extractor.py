# """
# control_flow_extractor.py
# =========================
# Purpose  : Extract every variable, field access, enum literal, and
#            constant that appears inside if / elsif / else / case /
#            while / for / loop statements — with full data-type
#            resolution traced back across all Ada source files.

# Usage
# -----
#     from control_flow_extractor import ControlFlowExtractor

#     extractor = ControlFlowExtractor("/path/to/ada/project")
#     report    = extractor.run()

#     import json
#     print(json.dumps(report, indent=4))

# Output shape (per subprogram)
# ------------------------------
# {
#   "file.adb": {
#     "SubprogramName": {
#       "if_conditions": [          # one entry per if/elsif condition
#         {
#           "condition_text": "Odata.QuatStatus = QCOMPUTED_AND_OK",
#           "branch": "if | elsif | while | for | case",
#           "nesting_depth": 1,
#           "variables": {
#             "Odata": {
#               "kind": "variable | field | enum_literal | constant",
#               "data_type": "ODATA_STRUCT",
#               "declared_in": "types.ads",
#               "possible_values": [...],   # if enum
#               "value_count": 3
#             },
#             "QuatStatus": {
#               "kind": "field",
#               "parent_object": "Odata",
#               "data_type": "QUAT_STATUS_TYPE",
#               "declared_in": "types.ads",
#               "possible_values": [
#                 {"value": "QCOMPUTED_AND_OK", "position": 0},
#                 {"value": "QNOT_COMPUTED",    "position": 1}
#               ],
#               "value_count": 2
#             },
#             "QCOMPUTED_AND_OK": {
#               "kind": "enum_literal",
#               "data_type": "QUAT_STATUS_TYPE",
#               "parent_type": "QUAT_STATUS_TYPE",
#               "position": 0,
#               "declared_in": "types.ads"
#             }
#           }
#         }
#       ],
#       "branch_body_variables": {  # variables used inside then/else bodies
#         "LatestQuaternion": {
#           "kind": "variable",
#           "data_type": "QUATERNION_TYPE",
#           "used_in_branch": "then",
#           "assigned_from": "Odata.Quaternion"
#         }
#       },
#       "procedure_calls": [        # calls inside control-flow bodies
#         {"name": "DeriveRateAndAcceleration", "args": [], "data_type": "void"}
#       ]
#     }
#   }
# }
# """

# from __future__ import annotations

# import os
# import json
# from dataclasses import dataclass, field
# from typing import Any

# import libadalang as lal


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 1 — FILE COLLECTION
# # ══════════════════════════════════════════════════════════════════

# def collect_ada_files(path: str) -> list[str]:
#     """Return all .adb / .ads files under *path* (file or directory)."""
#     ada_files: list[str] = []
#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for f in files:
#                 if f.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, f))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")
#     return ada_files


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 2 — LOW-LEVEL TYPE HELPERS
# # ══════════════════════════════════════════════════════════════════

# def _safe_text(node) -> str:
#     try:
#         return node.text.strip() if node and node.text else ""
#     except Exception:
#         return ""


# def _semantic_type(node) -> dict:
#     """
#     Ask libadalang for the semantic type of *node*.
#     Returns {"type": "<name>", ...} or {"type": "Unknown"}.
#     """
#     try:
#         typ = node.p_type
#         if typ is None:
#             return {"type": "Unknown"}

#         base = _safe_text(typ.p_defining_name)
#         if not base:
#             return {"type": "Unknown"}

#         tdef = getattr(typ, "f_type_def", None)
#         if tdef is None:
#             return {"type": base}

#         # Integer with range
#         if isinstance(tdef, lal.SignedIntTypeDef):
#             try:
#                 r = _safe_text(tdef.f_range.f_range)
#                 if r.lower().startswith("range "):
#                     r = r[6:].strip()
#                 return {"type": base, "range": r} if r else {"type": base}
#             except Exception:
#                 return {"type": base}

#         # Modular integer
#         if isinstance(tdef, lal.ModIntTypeDef):
#             try:
#                 return {"type": base, "modulus": _safe_text(tdef.f_expr)}
#             except Exception:
#                 return {"type": base}

#         # Floating point
#         if isinstance(tdef, lal.FloatingPointDef):
#             try:
#                 result = {"type": base, "digits": _safe_text(tdef.f_num_digits)}
#                 if tdef.f_range:
#                     result["range"] = _safe_text(tdef.f_range.f_range)
#                 return result
#             except Exception:
#                 return {"type": base}

#         # Fixed point
#         if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#             try:
#                 result = {"type": base, "delta": _safe_text(tdef.f_delta)}
#                 if tdef.f_range:
#                     result["range"] = _safe_text(tdef.f_range.f_range)
#                 return result
#             except Exception:
#                 return {"type": base}

#         return {"type": base}

#     except Exception:
#         return {"type": "Unknown"}


# def _parse_subtype_indication(node) -> dict:
#     """
#     Syntactically parse a SubtypeIndication node into a structured dict,
#     e.g. 'UINT16 range 0 .. 255' → {"type": "UINT16", "range": "0 .. 255"}.
#     """
#     if node is None:
#         return {"type": "Unknown"}

#     if not isinstance(node, lal.SubtypeIndication):
#         return {"type": _safe_text(node) or "Unknown"}

#     base = _safe_text(node.f_name)
#     c = node.f_constraint
#     if c is None:
#         return {"type": base}

#     if isinstance(c, lal.RangeConstraint):
#         r = _safe_text(c.f_range)
#         if r.lower().startswith("range "):
#             r = r[6:].strip()
#         return {"type": base, "range": r}

#     if isinstance(c, lal.DigitsConstraint):
#         result = {"type": base, "digits": _safe_text(c.f_digits)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             result["range"] = r
#         return result

#     if isinstance(c, lal.DeltaConstraint):
#         result = {"type": base, "delta": _safe_text(c.f_delta)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             result["range"] = r
#         return result

#     if isinstance(c, lal.IndexConstraint):
#         return {"type": base, "index_constraint": [_safe_text(x) for x in c.f_list]}

#     return {"type": base}


# def _best_type(node) -> dict:
#     """
#     Try semantic resolution first, fall back to syntactic parse,
#     fall back to raw text. Never returns Unknown if avoidable.
#     """
#     sem = _semantic_type(node)
#     if sem.get("type") not in ("Unknown", "", None):
#         return sem

#     try:
#         te = node.f_type_expr
#         if te:
#             parsed = _parse_subtype_indication(te)
#             if parsed.get("type") not in ("Unknown", "", None):
#                 return parsed
#     except Exception:
#         pass

#     try:
#         raw = _safe_text(node.f_type_expr)
#         if raw:
#             return {"type": raw}
#     except Exception:
#         pass

#     return {"type": "Unknown"}


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 3 — CROSS-FILE TYPE & VALUE REGISTRY
# #  Scans ALL units once and builds lookup tables.
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class TypeEntry:
#     name: str
#     kind: str                        # enum | record | integer | modular | array | subtype | float | fixed | other
#     declared_in: str
#     # enum
#     enum_values: list[dict] = field(default_factory=list)
#     # record
#     record_fields: dict[str, dict] = field(default_factory=dict)
#     # integer / modular
#     range_str: str = ""
#     modulus: str = ""
#     # array
#     element_type: dict = field(default_factory=dict)
#     indices: list[str] = field(default_factory=list)
#     # subtype
#     base_type: str = ""
#     structured: dict = field(default_factory=dict)
#     # extra
#     extra: dict = field(default_factory=dict)


# @dataclass
# class ObjectEntry:
#     name: str
#     kind: str                        # variable | constant
#     data_type: dict
#     initial_value: str
#     declared_in: str
#     scope: str                       # global | <subprogram name>
#     possible_values: list[dict] = field(default_factory=list)
#     value_count: int = 0
#     range_str: str = ""


# class TypeRegistry:
#     """
#     Single-pass registry built from all compilation units.
#     Public API:
#         resolve(name)              → ObjectEntry | None
#         resolve_type(name)         → TypeEntry | None
#         enum_literal(name)         → dict | None
#         field_info(obj, field)     → dict
#     """

#     def __init__(self, units: list):
#         self._types:    dict[str, TypeEntry]  = {}   # type/subtype name → TypeEntry
#         self._objects:  dict[str, ObjectEntry] = {}  # variable/const name → ObjectEntry
#         self._literals: dict[str, dict]       = {}   # enum literal name → info

#         for unit in units:
#             if unit.root:
#                 self._scan_unit(unit)

#         # Second pass: enrich objects with enum values from their type
#         for obj in self._objects.values():
#             self._enrich_object(obj)

#     # ── scan one compilation unit ──────────────────────────────

#     def _scan_unit(self, unit):
#         fname = unit.filename

#         # TYPE DECLARATIONS
#         for td in unit.root.findall(lal.TypeDecl):
#             if not td or not td.f_name:
#                 continue
#             self._register_type_decl(td, fname)

#         # SUBTYPE DECLARATIONS
#         for st in unit.root.findall(lal.SubtypeDecl):
#             if not st.f_name:
#                 continue
#             self._register_subtype_decl(st, fname)

#         # OBJECT DECLARATIONS
#         for obj in unit.root.findall(lal.ObjectDecl):
#             self._register_object_decl(obj, fname)

#     # ── type declarations ──────────────────────────────────────

#     def _register_type_decl(self, td, fname: str):
#         tname = td.f_name.text.strip()
#         tdef  = td.f_type_def
#         entry = TypeEntry(name=tname, kind="other", declared_in=fname)

#         try:
#             if isinstance(tdef, lal.EnumTypeDef):
#                 entry.kind = "enum"
#                 for i, lit in enumerate(tdef.f_enum_literals):
#                     lit_name = _safe_text(lit)
#                     entry.enum_values.append({"value": lit_name, "position": i})
#                     self._literals[lit_name] = {
#                         "kind":        "enum_literal",
#                         "data_type":   tname,
#                         "parent_type": tname,
#                         "value":       lit_name,
#                         "position":    i,
#                         "declared_in": fname,
#                     }

#             elif isinstance(tdef, lal.RecordTypeDef):
#                 entry.kind = "record"
#                 for comp in tdef.findall(lal.ComponentDecl):
#                     if not comp.f_component_def:
#                         continue
#                     ftype_raw    = _safe_text(comp.f_component_def.f_type_expr)
#                     ftype_struct = _best_type(comp.f_component_def)
#                     for n in comp.f_ids:
#                         entry.record_fields[n.text.strip()] = {
#                             "raw_type":       ftype_raw,
#                             "structured_type": ftype_struct,
#                             "declared_in":    fname,
#                         }

#             elif isinstance(tdef, lal.SignedIntTypeDef):
#                 entry.kind = "integer"
#                 try:
#                     r = _safe_text(tdef.f_range.f_range)
#                     if r.lower().startswith("range "):
#                         r = r[6:].strip()
#                     entry.range_str = r
#                 except Exception:
#                     pass

#             elif isinstance(tdef, lal.ModIntTypeDef):
#                 entry.kind    = "modular"
#                 entry.modulus = _safe_text(tdef.f_expr)

#             elif isinstance(tdef, lal.ArrayTypeDef):
#                 entry.kind = "array"
#                 try:
#                     entry.element_type = _parse_subtype_indication(
#                         tdef.f_component_type.f_type_expr
#                     )
#                 except Exception:
#                     entry.element_type = {"type": "Unknown"}
#                 try:
#                     entry.indices = [_safe_text(i) for i in tdef.f_indices.f_list]
#                 except Exception:
#                     pass

#             elif isinstance(tdef, lal.FloatingPointDef):
#                 entry.kind = "float"
#                 try:
#                     entry.extra["digits"] = _safe_text(tdef.f_num_digits)
#                 except Exception:
#                     pass

#             elif isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#                 entry.kind = "fixed"
#                 try:
#                     entry.extra["delta"] = _safe_text(tdef.f_delta)
#                 except Exception:
#                     pass

#         except Exception as e:
#             entry.extra["error"] = str(e)

#         self._types[tname] = entry

#     def _register_subtype_decl(self, st, fname: str):
#         sname  = st.f_name.text.strip()
#         # parsed = _parse_subtype_indication(st.f_type_expr) if st.f_type_expr else {"type": "Unknown"}
#         parsed = _parse_subtype_indication(st.f_subtype) if st.f_subtype else {"type": "Unknown"}
#         base   = parsed.get("type", "Unknown").split()[0]

#         entry = TypeEntry(
#             name       = sname,
#             kind       = "subtype",
#             declared_in= fname,
#             base_type  = base,
#             structured = parsed,
#         )
#         # Inherit enum values from base
#         parent = self._types.get(base)
#         if parent and parent.kind == "enum":
#             entry.enum_values = parent.enum_values[:]

#         self._types[sname] = entry

#     def _register_object_decl(self, obj, fname: str):
#         is_const = False
#         try:
#             is_const = obj.f_has_constant.kind_name == "ConstantPresent"
#         except Exception:
#             pass

#         init_val = ""
#         try:
#             if obj.f_default_expr:
#                 init_val = _safe_text(obj.f_default_expr)
#         except Exception:
#             pass

#         dtype = _best_type(obj)
#         scope = _get_scope_name(obj)

#         for ident in obj.f_ids:
#             iname = ident.text.strip()
#             self._objects[iname] = ObjectEntry(
#                 name          = iname,
#                 kind          = "constant" if is_const else "variable",
#                 data_type     = dtype,
#                 initial_value = init_val,
#                 declared_in   = fname,
#                 scope         = scope,
#             )

#     def _enrich_object(self, obj: ObjectEntry):
#         base = obj.data_type.get("type", "Unknown").split()[0]
#         te   = self._types.get(base)
#         if te is None:
#             return
#         if te.kind == "enum":
#             obj.possible_values = te.enum_values
#             obj.value_count     = len(te.enum_values)
#         elif te.kind in ("integer", "modular"):
#             obj.range_str = te.range_str or te.modulus
#         elif te.kind == "subtype":
#             if te.enum_values:
#                 obj.possible_values = te.enum_values
#                 obj.value_count     = len(te.enum_values)
#             parent = self._types.get(te.base_type)
#             if parent and parent.kind == "enum" and not obj.possible_values:
#                 obj.possible_values = parent.enum_values
#                 obj.value_count     = len(parent.enum_values)

#     # ── public resolution API ──────────────────────────────────

#     def resolve(self, name: str) -> ObjectEntry | None:
#         return self._objects.get(name)

#     def resolve_type(self, name: str) -> TypeEntry | None:
#         return self._types.get(name)

#     def enum_literal(self, name: str) -> dict | None:
#         return self._literals.get(name)

#     def field_info(self, object_name: str, field_name: str) -> dict:
#         """
#         Resolve Odata.QuatStatus:
#           1. Find Odata's type → record definition
#           2. Find QuatStatus in that record
#           3. Find QuatStatus's type → enum values / range
#         """
#         result: dict = {
#             "kind":                "field",
#             "parent_object":       object_name,
#             "field_name":          field_name,
#             "data_type":           "Unknown",
#             "declared_in":         "Unknown",
#             "possible_values":     [],
#             "value_count":         0,
#         }

#         # Step 1: object type
#         obj = self._objects.get(object_name)
#         if obj is None:
#             return result
#         obj_type_name = obj.data_type.get("type", "Unknown").split()[0]

#         # Step 2: record definition (follow one alias if needed)
#         te = self._types.get(obj_type_name)
#         if te and te.kind == "subtype":
#             te = self._types.get(te.base_type)
#         if te is None or te.kind != "record":
#             return result

#         # Case-insensitive field lookup
#         finfo = te.record_fields.get(field_name)
#         if finfo is None:
#             for fn, fv in te.record_fields.items():
#                 if fn.lower() == field_name.lower():
#                     finfo = fv
#                     break
#         if finfo is None:
#             return result

#         raw      = finfo.get("raw_type", "Unknown")
#         struct   = finfo.get("structured_type", {"type": raw})
#         base_ft  = struct.get("type", raw).split()[0]

#         result["data_type"]        = raw
#         result["structured_type"]  = struct
#         result["declared_in"]      = finfo.get("declared_in", "Unknown")

#         # Step 3: enum values / range for the field's type
#         ft = self._types.get(base_ft)
#         if ft:
#             if ft.kind == "enum":
#                 result["possible_values"] = ft.enum_values
#                 result["value_count"]     = len(ft.enum_values)
#             elif ft.kind in ("integer", "modular"):
#                 result["range"]           = ft.range_str or ft.modulus
#             elif ft.kind == "subtype":
#                 result["subtype_of"]      = ft.base_type
#                 if ft.enum_values:
#                     result["possible_values"] = ft.enum_values
#                     result["value_count"]     = len(ft.enum_values)
#                 else:
#                     parent = self._types.get(ft.base_type)
#                     if parent and parent.kind == "enum":
#                         result["possible_values"] = parent.enum_values
#                         result["value_count"]     = len(parent.enum_values)
#         else:
#             # Inline range from structured_type (e.g. "UINT16 range 0..255")
#             if "range" in struct:
#                 result["range"] = struct["range"]

#         return result

#     def to_dict(self) -> dict:
#         """Serialise the full registry for JSON output."""
#         out: dict = {"types": {}, "objects": {}, "enum_literals": self._literals}
#         for k, v in self._types.items():
#             out["types"][k] = v.__dict__
#         for k, v in self._objects.items():
#             out["objects"][k] = v.__dict__
#         return out


# def _get_scope_name(node) -> str:
#     parent = node.parent
#     while parent:
#         if isinstance(parent, lal.SubpBody):
#             try:
#                 return parent.f_subp_spec.f_subp_name.text
#             except Exception:
#                 return "subprogram"
#         if isinstance(parent, lal.PackageBody):
#             try:
#                 return f"package:{parent.f_package_name.text}"
#             except Exception:
#                 return "package"
#         parent = parent.parent
#     return "global"


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 4 — EXPRESSION RESOLVER
# #  Takes a single expression node + registry, returns a dict of
# #  every variable/literal found with full type info.
# # ══════════════════════════════════════════════════════════════════

# class ExpressionResolver:
#     """
#     Walk one expression (a condition, RHS, etc.) and return
#     {name: {kind, data_type, possible_values, ...}} for every
#     identifier encountered.
#     """

#     def __init__(self, registry: TypeRegistry):
#         self.reg = registry

#     def resolve(self, node) -> dict[str, dict]:
#         found: dict[str, dict] = {}
#         self._walk(node, found)
#         return found

#     # ── main dispatcher ────────────────────────────────────────

#     def _walk(self, node, found: dict):
#         if node is None:
#             return

#         # Parenthesised expression  →  unwrap
#         if isinstance(node, lal.ParenExpr):
#             self._walk(node.f_expr, found)

#         # DottedName  →  Odata.QuatStatus
#         elif isinstance(node, lal.DottedName):
#             self._handle_dotted(node, found)

#         # Call expression  →  Foo(args)
#         elif isinstance(node, lal.CallExpr):
#             self._handle_call(node, found)

#         # Binary / relational  →  recurse both sides
#         elif isinstance(node, (lal.BinOp, lal.RelationOp,
#                                 lal.MembershipExpr,
#                                 lal.AndThen, lal.OrElse)):
#             self._walk(node.f_left,  found)
#             self._walk(node.f_right, found)

#         # Unary  →  not X, -X
#         elif isinstance(node, lal.UnOp):
#             self._walk(node.f_expr, found)

#         # Attribute reference  →  X'First
#         elif isinstance(node, lal.AttributeRef):
#             self._walk(node.f_prefix, found)
#             try:
#                 for arg in node.f_args:
#                     self._walk(arg, found)
#             except Exception:
#                 pass

#         # Qualified expression  →  Type'(expr)
#         elif isinstance(node, lal.QualExpr):
#             self._walk(node.f_suffix, found)

#         # Inline if  →  (if C then X else Y)
#         elif isinstance(node, lal.IfExpr):
#             self._walk(node.f_cond_expr, found)
#             self._walk(node.f_then_expr, found)
#             for alt in node.f_alternatives:
#                 self._walk(alt.f_cond_expr, found)
#                 self._walk(alt.f_then_expr, found)
#             self._walk(node.f_else_expr, found)

#         # Case expression
#         elif isinstance(node, lal.CaseExpr):
#             self._walk(node.f_expr, found)
#             for alt in node.f_cases:
#                 self._walk(alt.f_expr, found)

#         # Aggregate  →  (F => V, ...)
#         elif isinstance(node, lal.Aggregate):
#             try:
#                 for assoc in node.f_assocs:
#                     self._walk(assoc.f_r_expr, found)
#             except Exception:
#                 pass

#         # Plain identifier  →  QCOMPUTED_AND_OK, X, Counter
#         elif isinstance(node, lal.Identifier):
#             self._handle_identifier(node, found)

#         # Fallback: generic child walk
#         else:
#             try:
#                 for child in node.children:
#                     self._walk(child, found)
#             except Exception:
#                 pass

#     # ── dotted name  (Odata.QuatStatus) ───────────────────────

#     def _handle_dotted(self, node: lal.DottedName, found: dict):
#         prefix_text = _safe_text(node.f_prefix)
#         suffix_text = _safe_text(node.f_suffix)
#         full_text   = _safe_text(node)

#         # ① full dotted name
#         if full_text and full_text not in found:
#             fi = self.reg.field_info(prefix_text, suffix_text)
#             sem = _semantic_type(node)
#             # prefer semantic type if registry returned Unknown
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"] = sem["type"]
#                 fi["semantic_type"] = sem
#             found[full_text] = fi

#         # ② prefix object (Odata)
#         if prefix_text and prefix_text not in found:
#             found[prefix_text] = self._resolve_name(node.f_prefix, prefix_text)

#         # ③ suffix field name (QuatStatus) — standalone entry
#         if suffix_text and suffix_text not in found:
#             fi = self.reg.field_info(prefix_text, suffix_text)
#             sem = _semantic_type(node.f_suffix) if node.f_suffix else {"type": "Unknown"}
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"] = sem["type"]
#             fi["parent_object"] = prefix_text
#             found[suffix_text] = fi

#     # ── call expression ────────────────────────────────────────

#     def _handle_call(self, node: lal.CallExpr, found: dict):
#         try:
#             call_name = _safe_text(node.f_name)
#             if call_name and call_name not in found:
#                 found[call_name] = {
#                     "kind":      "call",
#                     "data_type": _semantic_type(node).get("type", "Unknown"),
#                     "args":      [_safe_text(p) for p in node.f_suffix],
#                 }
#             # walk arguments
#             try:
#                 for param in node.f_suffix:
#                     self._walk(param, found)
#             except Exception:
#                 pass
#         except Exception:
#             pass

#     # ── plain identifier ───────────────────────────────────────

#     def _handle_identifier(self, node: lal.Identifier, found: dict):
#         name = _safe_text(node)
#         if not name or name in found:
#             return
#         found[name] = self._resolve_name(node, name)

#     # ── unified name resolver ──────────────────────────────────

#     def _resolve_name(self, node, name: str) -> dict:
#         """
#         Try (in order):
#           1. Enum literal registry
#           2. Object registry (variable / constant)
#           3. Semantic p_type
#           4. Type registry (bare type name reference)
#           5. Fallback
#         """
#         # 1. Enum literal
#         lit = self.reg.enum_literal(name)
#         if lit:
#             return dict(lit)

#         # 2. Object
#         obj = self.reg.resolve(name)
#         if obj:
#             rec: dict = {
#                 "kind":          obj.kind,
#                 "data_type":     obj.data_type,
#                 "declared_in":   obj.declared_in,
#                 "scope":         obj.scope,
#             }
#             if obj.initial_value:
#                 rec["initial_value"] = obj.initial_value
#             if obj.possible_values:
#                 rec["possible_values"] = obj.possible_values
#                 rec["value_count"]     = obj.value_count
#             if obj.range_str:
#                 rec["range"] = obj.range_str
#             # Try to also fill semantic type
#             sem = _semantic_type(node) if node else {"type": "Unknown"}
#             if sem.get("type") not in ("Unknown", "") and obj.data_type.get("type") == "Unknown":
#                 rec["data_type"] = sem
#             return rec

#         # 3. Semantic p_type
#         sem = _semantic_type(node) if node else {"type": "Unknown"}
#         if sem.get("type") not in ("Unknown", "", None):
#             rec = {"kind": "identifier", "data_type": sem}
#             # enrich from type registry
#             te = self.reg.resolve_type(sem["type"])
#             if te and te.kind == "enum":
#                 rec["possible_values"] = te.enum_values
#                 rec["value_count"]     = len(te.enum_values)
#             return rec

#         # 4. Type name reference
#         te = self.reg.resolve_type(name)
#         if te:
#             rec = {"kind": "type_reference", "data_type": {"type": name}}
#             if te.kind == "enum":
#                 rec["possible_values"] = te.enum_values
#                 rec["value_count"]     = len(te.enum_values)
#             return rec

#         # 5. Fallback
#         return {"kind": "unresolved", "data_type": {"type": "Unknown"}}


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 5 — CONTROL FLOW WALKER
# #  Walks subprogram bodies, emits structured condition records.
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class ConditionRecord:
#     condition_text: str
#     branch_type: str          # if | elsif | else_guard | while | for | case_expr
#     nesting_depth: int
#     variables: dict[str, dict]


# @dataclass
# class BranchBodyRecord:
#     variable_name: str
#     kind: str                 # assignment | call | local_decl
#     data_type: dict
#     used_in_branch: str       # then | else | elsif | case_body | loop_body
#     assigned_from: str = ""
#     possible_values: list = field(default_factory=list)
#     value_count: int = 0


# class ControlFlowWalker:
#     """
#     Walks a subprogram body and produces:
#       - conditions:        list[ConditionRecord]
#       - branch_bodies:     list[BranchBodyRecord]
#       - procedure_calls:   list[dict]
#     """

#     def __init__(self, registry: TypeRegistry):
#         self.reg      = registry
#         self.resolver = ExpressionResolver(registry)

#     def walk_subprogram(self, subp: lal.SubpBody) -> dict:
#         self.conditions:     list[ConditionRecord]   = []
#         self.branch_bodies:  list[BranchBodyRecord]  = []
#         self.procedure_calls: list[dict]             = []

#         try:
#             stmts = subp.f_body.f_stmts
#         except Exception:
#             stmts = []

#         self._walk_stmts(stmts, depth=0)

#         return {
#             "if_conditions":       [self._cond_to_dict(c) for c in self.conditions],
#             "branch_body_variables": self._bodies_to_dict(),
#             "procedure_calls":     self.procedure_calls,
#         }

#     # ── statement list ─────────────────────────────────────────

#     def _walk_stmts(self, stmts, depth: int, branch_label: str = ""):
#         for stmt in stmts:
#             self._walk_stmt(stmt, depth, branch_label)

#     # ── single statement dispatcher ────────────────────────────

#     def _walk_stmt(self, node, depth: int, branch_label: str):
#         if node is None:
#             return

#         # ── IF ──────────────────────────────────────────────────
#         if isinstance(node, lal.IfStmt):
#             # condition
#             cond = node.f_cond_expr
#             if isinstance(cond, lal.ParenExpr):
#                 cond = cond.f_expr
#             self._record_condition(cond, "if", depth)

#             # then body
#             self._walk_stmts(node.f_then_stmts, depth + 1, "then")

#             # elsif parts
#             for part in node.f_alternatives:
#                 ec = part.f_cond_expr
#                 if isinstance(ec, lal.ParenExpr):
#                     ec = ec.f_expr
#                 self._record_condition(ec, "elsif", depth)
#                 self._walk_stmts(part.f_stmts, depth + 1, "elsif")

#             # else body
#             if node.f_else_stmts:
#                 self._walk_stmts(node.f_else_stmts, depth + 1, "else")
#             return

#         # ── CASE ────────────────────────────────────────────────
#         if isinstance(node, lal.CaseStmt):
#             self._record_condition(node.f_expr, "case_expr", depth)
#             for alt in node.f_alternatives:
#                 # when choices
#                 for choice in alt.f_choices:
#                     vars_in_choice = self.resolver.resolve(choice)
#                     if vars_in_choice:
#                         cr = ConditionRecord(
#                             condition_text = _safe_text(choice),
#                             branch_type    = "case_choice",
#                             nesting_depth  = depth,
#                             variables      = vars_in_choice,
#                         )
#                         self.conditions.append(cr)
#                 self._walk_stmts(alt.f_stmts, depth + 1, "case_body")
#             return

#         # ── WHILE ───────────────────────────────────────────────
#         if isinstance(node, lal.WhileLoopStmt):
#             try:
#                 self._record_condition(node.f_spec.f_expr, "while", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(node.f_stmts, depth + 1, "loop_body")
#             return

#         # ── FOR ─────────────────────────────────────────────────
#         if isinstance(node, lal.ForLoopStmt):
#             try:
#                 spec = node.f_spec
#                 if hasattr(spec, 'f_iter_expr') and spec.f_iter_expr:
#                     self._record_condition(spec.f_iter_expr, "for", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(node.f_stmts, depth + 1, "loop_body")
#             return

#         # ── PLAIN LOOP ──────────────────────────────────────────
#         if isinstance(node, lal.LoopStmt):
#             self._walk_stmts(node.f_stmts, depth + 1, "loop_body")
#             return

#         # ── BLOCK ───────────────────────────────────────────────
#         if isinstance(node, lal.BlockStmt):
#             self._walk_stmts(node.f_stmts, depth + 1, branch_label)
#             return

#         # ── ASSIGNMENT ──────────────────────────────────────────
#         if isinstance(node, lal.AssignStmt):
#             self._handle_assignment(node, branch_label)
#             return

#         # ── PROCEDURE CALL ──────────────────────────────────────
#         if isinstance(node, lal.CallStmt):
#             self._handle_call_stmt(node, branch_label)
#             return

#         # ── RETURN ──────────────────────────────────────────────
#         if isinstance(node, lal.ReturnStmt):
#             if node.f_return_expr:
#                 self._record_condition(node.f_return_expr, "return_expr", depth)
#             return

#         # ── LOCAL DECLARATIONS inside block ─────────────────────
#         if isinstance(node, lal.ObjectDecl):
#             dtype = _best_type(node)
#             for ident in node.f_ids:
#                 iname = ident.text.strip()
#                 init  = _safe_text(node.f_default_expr) if node.f_default_expr else ""
#                 br = BranchBodyRecord(
#                     variable_name = iname,
#                     kind          = "local_decl",
#                     data_type     = dtype,
#                     used_in_branch= branch_label,
#                     assigned_from = init,
#                 )
#                 self._enrich_body_record(br)
#                 self.branch_bodies.append(br)
#             return

#     # ── condition recorder ─────────────────────────────────────

#     def _record_condition(self, cond_node, branch_type: str, depth: int):
#         if cond_node is None:
#             return
#         variables = self.resolver.resolve(cond_node)
#         cr = ConditionRecord(
#             condition_text = _safe_text(cond_node),
#             branch_type    = branch_type,
#             nesting_depth  = depth,
#             variables      = variables,
#         )
#         self.conditions.append(cr)

#     # ── assignment handler ─────────────────────────────────────

#     def _handle_assignment(self, node: lal.AssignStmt, branch_label: str):
#         lhs     = node.f_dest
#         rhs     = node.f_expr
#         lhs_txt = _safe_text(lhs)
#         rhs_txt = _safe_text(rhs)
#         dtype   = _semantic_type(lhs)

#         # enrich dtype from registry if Unknown
#         if dtype.get("type") == "Unknown":
#             obj = self.reg.resolve(lhs_txt.split(".")[0])
#             if obj:
#                 dtype = obj.data_type

#         br = BranchBodyRecord(
#             variable_name  = lhs_txt,
#             kind           = "assignment",
#             data_type      = dtype,
#             used_in_branch = branch_label,
#             assigned_from  = rhs_txt,
#         )
#         self._enrich_body_record(br)
#         self.branch_bodies.append(br)

#         # also walk RHS for nested identifiers that appear as conditions
#         rhs_vars = self.resolver.resolve(rhs)
#         for vname, vinfo in rhs_vars.items():
#             if vname not in [b.variable_name for b in self.branch_bodies]:
#                 sub_br = BranchBodyRecord(
#                     variable_name  = vname,
#                     kind           = "rhs_reference",
#                     data_type      = vinfo.get("data_type", {"type": "Unknown"}),
#                     used_in_branch = branch_label,
#                     possible_values= vinfo.get("possible_values", []),
#                     value_count    = vinfo.get("value_count", 0),
#                 )
#                 self.branch_bodies.append(sub_br)

#     # ── call statement handler ─────────────────────────────────

#     def _handle_call_stmt(self, node: lal.CallStmt, branch_label: str):
#         call = node.f_call
#         try:
#             cname = _safe_text(call.f_name) if hasattr(call, 'f_name') else _safe_text(call)
#             dtype = _semantic_type(call)
#             args  = []
#             try:
#                 for p in call.f_suffix:
#                     args.append(_safe_text(p))
#             except Exception:
#                 pass
#             self.procedure_calls.append({
#                 "name":          cname,
#                 "data_type":     dtype.get("type", "Unknown"),
#                 "args":          args,
#                 "called_in":     branch_label,
#             })
#         except Exception:
#             pass

#     # ── branch-body enrichment ─────────────────────────────────

#     def _enrich_body_record(self, br: BranchBodyRecord):
#         base = br.data_type.get("type", "Unknown").split()[0] if isinstance(br.data_type, dict) else "Unknown"
#         te   = self.reg.resolve_type(base)
#         if te and te.kind == "enum":
#             br.possible_values = te.enum_values
#             br.value_count     = len(te.enum_values)

#     # ── serialisers ───────────────────────────────────────────

#     @staticmethod
#     def _cond_to_dict(c: ConditionRecord) -> dict:
#         return {
#             "condition_text": c.condition_text,
#             "branch_type":    c.branch_type,
#             "nesting_depth":  c.nesting_depth,
#             "variables":      c.variables,
#         }

#     def _bodies_to_dict(self) -> dict:
#         out: dict = {}
#         for br in self.branch_bodies:
#             entry: dict = {
#                 "kind":          br.kind,
#                 "data_type":     br.data_type,
#                 "used_in_branch": br.used_in_branch,
#             }
#             if br.assigned_from:
#                 entry["assigned_from"] = br.assigned_from
#             if br.possible_values:
#                 entry["possible_values"] = br.possible_values
#                 entry["value_count"]     = br.value_count
#             out[br.variable_name] = entry
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 6 — TOP-LEVEL EXTRACTOR  (public API)
# # ══════════════════════════════════════════════════════════════════

# class ControlFlowExtractor:
#     """
#     Main entry point.

#     extractor = ControlFlowExtractor("/path/to/project")
#     report    = extractor.run()
#     """

#     # def __init__(self, project_path: str):
#     #     self.project_path = project_path
#     def __init__(self, units: list):
#         self.units = units

#     # def run(self) -> dict:
#     #     ctx       = lal.AnalysisContext(
#     #                     unit_provider=lal.UnitProvider.auto([self.project_path])
#     #                 )
#     #     ada_files = collect_ada_files(self.project_path)

#     #     units: list = []
#     #     for f in ada_files:
#     #         try:
#     #             unit = ctx.get_from_file(f)
#     #             if unit.root:
#     #                 units.append(unit)
#     #         except Exception as e:
#     #             print(f"[WARN] Could not parse {f}: {e}")

#     def run(self) -> dict:
#         units = self.units

#         registry = TypeRegistry(units)
#         walker   = ControlFlowWalker(registry)

#         report: dict = {}

#         for unit in units:
#             fname      = unit.filename
#             file_entry: dict = {}

#             for subp in unit.root.findall(lal.SubpBody):
#                 try:
#                     sname = (
#                         subp.f_subp_spec.f_subp_name.text
#                         if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                         else "UNKNOWN"
#                     )
#                 except Exception:
#                     sname = "UNKNOWN"

#                 file_entry[sname] = walker.walk_subprogram(subp)

#             if file_entry:
#                 report[fname] = file_entry

#         # Attach full registry so callers can cross-check
#         report["__registry__"] = registry.to_dict()

#         return report


# # ══════════════════════════════════════════════════════════════════
# #  ENTRY POINT
# # ══════════════════════════════════════════════════════════════════

# if __name__ == "__main__":
#     import sys

#     path = sys.argv[1] if len(sys.argv) > 1 else "/your/project/path"
#     extractor = ControlFlowExtractor(path)
#     result    = extractor.run()
#     print(json.dumps(result, indent=4, default=str))





























# """
# control_flow_extractor.py
# =========================
# Extracts every variable / field / enum-literal / constant that appears
# inside if / elsif / else / case / while / for / loop bodies with full
# data-type resolution traced across all Ada source files.

# Usage
# -----
#     from control_flow_extractor import ControlFlowExtractor

#     extractor = ControlFlowExtractor(units)   # list of lal.AnalysisUnit
#     report    = extractor.run()
#     print(json.dumps(report, indent=4))
# """

# from __future__ import annotations
# import os, json
# from dataclasses import dataclass, field
# import libadalang as lal


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 1 — FILE COLLECTION
# # ══════════════════════════════════════════════════════════════════

# def collect_ada_files(path: str) -> list[str]:
#     ada_files: list[str] = []
#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for f in files:
#                 if f.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, f))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")
#     return ada_files


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 2 — SAFE AST ACCESSORS
# # ══════════════════════════════════════════════════════════════════

# def _safe_text(node) -> str:
#     try:
#         return node.text.strip() if node and node.text else ""
#     except Exception:
#         return ""


# # Statement-kind names that we want to walk
# _STMT_KINDS = frozenset({
#     "IfStmt", "CaseStmt", "AssignStmt", "CallStmt",
#     "WhileLoopStmt", "ForLoopStmt", "LoopStmt",
#     "BlockStmt", "ReturnStmt", "NullStmt",
#     "ExitStmt", "GotoStmt", "ExtendedReturnStmt",
#     "ObjectDecl",           # local declarations inside declare blocks
# })


# def _get_stmts_from_subp(subp: lal.SubpBody) -> list:
#     """
#     Robustly retrieve the executable statement list from a SubpBody.
#     Ada's SubpBody layout:  SubpBody → SubpSpec + DeclarativePart + HandledStmts
#     HandledStmts            → StmtList ( + ExceptionHandlers )
#     We try every known LAL path.
#     """

#     # ── Path 1: subp.f_body  (most common in LAL) ──────────────
#     try:
#         body = subp.f_body          # should be HandledStmts
#         if body is not None and hasattr(body, "f_stmts"):
#             stmts = list(body.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass

#     # ── Path 2: findall(HandledStmts) ──────────────────────────
#     try:
#         for hs in subp.findall(lal.HandledStmts):
#             stmts = list(hs.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass

#     # ── Path 3: subp.f_stmts directly ──────────────────────────
#     try:
#         stmts = list(subp.f_stmts)
#         if stmts:
#             return stmts
#     except Exception:
#         pass

#     # ── Path 4: walk direct children for HandledStmts / StmtList
#     try:
#         for child in subp.children:
#             if child is None:
#                 continue
#             if child.kind_name == "HandledStmts":
#                 try:
#                     stmts = list(child.f_stmts)
#                     if stmts:
#                         return stmts
#                 except Exception:
#                     pass
#             # one level deeper
#             try:
#                 for gc in child.children:
#                     if gc and gc.kind_name == "HandledStmts":
#                         try:
#                             stmts = list(gc.f_stmts)
#                             if stmts:
#                                 return stmts
#                         except Exception:
#                             pass
#             except Exception:
#                 pass
#     except Exception:
#         pass

#     # ── Path 5: brute-force – collect statement-kind children ───
#     try:
#         stmts = [c for c in subp.children
#                  if c and c.kind_name in _STMT_KINDS]
#         if stmts:
#             return stmts
#     except Exception:
#         pass

#     return []


# def _iter_list(node, attr: str) -> list:
#     """Safely iterate a LAL list attribute."""
#     try:
#         val = getattr(node, attr, None)
#         return list(val) if val is not None else []
#     except Exception:
#         return []


# def _get_stmts_from_block(node) -> list:
#     """Get stmts from a BlockStmt / HandledStmts / generic node."""
#     for attr in ("f_stmts", "f_body"):
#         try:
#             val = getattr(node, attr, None)
#             if val is not None:
#                 stmts = list(val) if not hasattr(val, "f_stmts") else list(val.f_stmts)
#                 if stmts:
#                     return stmts
#         except Exception:
#             pass
#     try:
#         for hs in node.findall(lal.HandledStmts):
#             stmts = list(hs.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     return []


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 3 — TYPE RESOLUTION HELPERS
# # ══════════════════════════════════════════════════════════════════

# def _semantic_type(node) -> dict:
#     try:
#         typ = node.p_type
#         if typ is None:
#             return {"type": "Unknown"}
#         base = _safe_text(typ.p_defining_name)
#         if not base:
#             return {"type": "Unknown"}
#         tdef = getattr(typ, "f_type_def", None)
#         if tdef is None:
#             return {"type": base}

#         if isinstance(tdef, lal.SignedIntTypeDef):
#             try:
#                 r = _safe_text(tdef.f_range.f_range)
#                 if r.lower().startswith("range "):
#                     r = r[6:].strip()
#                 return {"type": base, "range": r} if r else {"type": base}
#             except Exception:
#                 return {"type": base}

#         if isinstance(tdef, lal.ModIntTypeDef):
#             try:
#                 return {"type": base, "modulus": _safe_text(tdef.f_expr)}
#             except Exception:
#                 return {"type": base}

#         if isinstance(tdef, lal.FloatingPointDef):
#             try:
#                 res = {"type": base, "digits": _safe_text(tdef.f_num_digits)}
#                 if tdef.f_range:
#                     res["range"] = _safe_text(tdef.f_range.f_range)
#                 return res
#             except Exception:
#                 return {"type": base}

#         if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#             try:
#                 res = {"type": base, "delta": _safe_text(tdef.f_delta)}
#                 if tdef.f_range:
#                     res["range"] = _safe_text(tdef.f_range.f_range)
#                 return res
#             except Exception:
#                 return {"type": base}

#         return {"type": base}
#     except Exception:
#         return {"type": "Unknown"}


# def _parse_subtype_indication(node) -> dict:
#     if node is None:
#         return {"type": "Unknown"}
#     if not isinstance(node, lal.SubtypeIndication):
#         return {"type": _safe_text(node) or "Unknown"}
#     base = _safe_text(node.f_name)
#     c = node.f_constraint
#     if c is None:
#         return {"type": base}
#     if isinstance(c, lal.RangeConstraint):
#         r = _safe_text(c.f_range)
#         if r.lower().startswith("range "):
#             r = r[6:].strip()
#         return {"type": base, "range": r}
#     if isinstance(c, lal.DigitsConstraint):
#         res = {"type": base, "digits": _safe_text(c.f_digits)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     if isinstance(c, lal.DeltaConstraint):
#         res = {"type": base, "delta": _safe_text(c.f_delta)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     if isinstance(c, lal.IndexConstraint):
#         return {"type": base, "index_constraint": [_safe_text(x) for x in c.f_list]}
#     return {"type": base}


# def _best_type(node) -> dict:
#     sem = _semantic_type(node)
#     if sem.get("type") not in ("Unknown", "", None):
#         return sem
#     try:
#         te = node.f_type_expr
#         if te:
#             p = _parse_subtype_indication(te)
#             if p.get("type") not in ("Unknown", "", None):
#                 return p
#     except Exception:
#         pass
#     try:
#         raw = _safe_text(node.f_type_expr)
#         if raw:
#             return {"type": raw}
#     except Exception:
#         pass
#     return {"type": "Unknown"}


# def _get_scope_name(node) -> str:
#     p = node.parent
#     while p:
#         if isinstance(p, lal.SubpBody):
#             try:
#                 return p.f_subp_spec.f_subp_name.text
#             except Exception:
#                 return "subprogram"
#         if isinstance(p, lal.PackageBody):
#             try:
#                 return f"package:{p.f_package_name.text}"
#             except Exception:
#                 return "package"
#         p = p.parent
#     return "global"


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 4 — TYPE REGISTRY
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class TypeEntry:
#     name: str
#     kind: str           # enum|record|integer|modular|array|subtype|float|fixed|other
#     declared_in: str
#     enum_values:   list[dict]    = field(default_factory=list)
#     record_fields: dict          = field(default_factory=dict)
#     range_str: str               = ""
#     modulus: str                 = ""
#     element_type: dict           = field(default_factory=dict)
#     indices: list[str]           = field(default_factory=list)
#     base_type: str               = ""
#     structured: dict             = field(default_factory=dict)
#     extra: dict                  = field(default_factory=dict)


# @dataclass
# class ObjectEntry:
#     name: str
#     kind: str           # variable|constant
#     data_type: dict
#     initial_value: str
#     declared_in: str
#     scope: str
#     possible_values: list[dict] = field(default_factory=list)
#     value_count: int            = 0
#     range_str: str              = ""


# class TypeRegistry:

#     def __init__(self, units: list):
#         self._types:    dict[str, TypeEntry]   = {}
#         self._objects:  dict[str, ObjectEntry] = {}
#         self._literals: dict[str, dict]        = {}

#         for unit in units:
#             if unit.root:
#                 self._scan_unit(unit)

#         for obj in self._objects.values():
#             self._enrich_object(obj)

#     def _scan_unit(self, unit):
#         fname = unit.filename
#         for td in unit.root.findall(lal.TypeDecl):
#             if td and td.f_name:
#                 self._register_type_decl(td, fname)
#         for st in unit.root.findall(lal.SubtypeDecl):
#             if st.f_name:
#                 self._register_subtype_decl(st, fname)
#         for obj in unit.root.findall(lal.ObjectDecl):
#             self._register_object_decl(obj, fname)

#     def _register_type_decl(self, td, fname: str):
#         tname = td.f_name.text.strip()
#         tdef  = td.f_type_def
#         entry = TypeEntry(name=tname, kind="other", declared_in=fname)
#         try:
#             if isinstance(tdef, lal.EnumTypeDef):
#                 entry.kind = "enum"
#                 for i, lit in enumerate(tdef.f_enum_literals):
#                     ln = _safe_text(lit)
#                     entry.enum_values.append({"value": ln, "position": i})
#                     self._literals[ln] = {
#                         "kind": "enum_literal", "data_type": tname,
#                         "parent_type": tname, "value": ln,
#                         "position": i, "declared_in": fname,
#                     }
#             elif isinstance(tdef, lal.RecordTypeDef):
#                 entry.kind = "record"
#                 for comp in tdef.findall(lal.ComponentDecl):
#                     if not comp.f_component_def:
#                         continue
#                     fr = _safe_text(comp.f_component_def.f_type_expr)
#                     fs = _best_type(comp.f_component_def)
#                     for n in comp.f_ids:
#                         entry.record_fields[n.text.strip()] = {
#                             "raw_type": fr, "structured_type": fs, "declared_in": fname,
#                         }
#             elif isinstance(tdef, lal.SignedIntTypeDef):
#                 entry.kind = "integer"
#                 try:
#                     r = _safe_text(tdef.f_range.f_range)
#                     if r.lower().startswith("range "):
#                         r = r[6:].strip()
#                     entry.range_str = r
#                 except Exception:
#                     pass
#             elif isinstance(tdef, lal.ModIntTypeDef):
#                 entry.kind    = "modular"
#                 entry.modulus = _safe_text(tdef.f_expr)
#             elif isinstance(tdef, lal.ArrayTypeDef):
#                 entry.kind = "array"
#                 try:
#                     entry.element_type = _parse_subtype_indication(
#                         tdef.f_component_type.f_type_expr)
#                 except Exception:
#                     entry.element_type = {"type": "Unknown"}
#                 try:
#                     entry.indices = [_safe_text(i) for i in tdef.f_indices.f_list]
#                 except Exception:
#                     pass
#             elif isinstance(tdef, lal.FloatingPointDef):
#                 entry.kind = "float"
#                 try:
#                     entry.extra["digits"] = _safe_text(tdef.f_num_digits)
#                 except Exception:
#                     pass
#             elif isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#                 entry.kind = "fixed"
#                 try:
#                     entry.extra["delta"] = _safe_text(tdef.f_delta)
#                 except Exception:
#                     pass
#         except Exception as e:
#             entry.extra["error"] = str(e)
#         self._types[tname] = entry

#     def _register_subtype_decl(self, st, fname: str):
#         sname    = st.f_name.text.strip()
#         raw_node = getattr(st, "f_subtype", None) or getattr(st, "f_type_expr", None)
#         parsed   = _parse_subtype_indication(raw_node) if raw_node else {"type": "Unknown"}
#         base     = parsed.get("type", "Unknown").split()[0]
#         entry    = TypeEntry(name=sname, kind="subtype", declared_in=fname,
#                              base_type=base, structured=parsed)
#         parent   = self._types.get(base)
#         if parent and parent.kind == "enum":
#             entry.enum_values = parent.enum_values[:]
#         self._types[sname] = entry

#     def _register_object_decl(self, obj, fname: str):
#         is_const = False
#         try:
#             is_const = obj.f_has_constant.kind_name == "ConstantPresent"
#         except Exception:
#             pass
#         init_val = ""
#         try:
#             if obj.f_default_expr:
#                 init_val = _safe_text(obj.f_default_expr)
#         except Exception:
#             pass
#         dtype = _best_type(obj)
#         scope = _get_scope_name(obj)
#         for ident in obj.f_ids:
#             iname = ident.text.strip()
#             self._objects[iname] = ObjectEntry(
#                 name=iname, kind="constant" if is_const else "variable",
#                 data_type=dtype, initial_value=init_val,
#                 declared_in=fname, scope=scope,
#             )

#     def _enrich_object(self, obj: ObjectEntry):
#         base = obj.data_type.get("type", "Unknown").split()[0]
#         te   = self._types.get(base)
#         if te is None:
#             return
#         if te.kind == "enum":
#             obj.possible_values = te.enum_values
#             obj.value_count     = len(te.enum_values)
#         elif te.kind in ("integer", "modular"):
#             obj.range_str = te.range_str or te.modulus
#         elif te.kind == "subtype":
#             if te.enum_values:
#                 obj.possible_values = te.enum_values
#                 obj.value_count     = len(te.enum_values)
#             parent = self._types.get(te.base_type)
#             if parent and parent.kind == "enum" and not obj.possible_values:
#                 obj.possible_values = parent.enum_values
#                 obj.value_count     = len(parent.enum_values)

#     # ── public API ──────────────────────────────────────────────

#     def resolve(self, name: str) -> ObjectEntry | None:
#         return self._objects.get(name)

#     def resolve_type(self, name: str) -> TypeEntry | None:
#         return self._types.get(name)

#     def enum_literal(self, name: str) -> dict | None:
#         return self._literals.get(name)

#     def field_info(self, object_name: str, field_name: str) -> dict:
#         result: dict = {
#             "kind": "field", "parent_object": object_name,
#             "field_name": field_name, "data_type": "Unknown",
#             "declared_in": "Unknown", "possible_values": [], "value_count": 0,
#         }
#         obj = self._objects.get(object_name)
#         if obj is None:
#             return result
#         obj_type_name = obj.data_type.get("type", "Unknown").split()[0]
#         te = self._types.get(obj_type_name)
#         if te and te.kind == "subtype":
#             te = self._types.get(te.base_type)
#         if te is None or te.kind != "record":
#             return result
#         finfo = te.record_fields.get(field_name)
#         if finfo is None:
#             for fn, fv in te.record_fields.items():
#                 if fn.lower() == field_name.lower():
#                     finfo = fv
#                     break
#         if finfo is None:
#             return result
#         raw    = finfo.get("raw_type", "Unknown")
#         struct = finfo.get("structured_type", {"type": raw})
#         base_ft= struct.get("type", raw).split()[0]
#         result["data_type"]       = raw
#         result["structured_type"] = struct
#         result["declared_in"]     = finfo.get("declared_in", "Unknown")
#         ft = self._types.get(base_ft)
#         if ft:
#             if ft.kind == "enum":
#                 result["possible_values"] = ft.enum_values
#                 result["value_count"]     = len(ft.enum_values)
#             elif ft.kind in ("integer", "modular"):
#                 result["range"]           = ft.range_str or ft.modulus
#             elif ft.kind == "subtype":
#                 result["subtype_of"] = ft.base_type
#                 vals = ft.enum_values or (self._types.get(ft.base_type) or TypeEntry("","other","")).enum_values
#                 result["possible_values"] = vals
#                 result["value_count"]     = len(vals)
#         elif "range" in struct:
#             result["range"] = struct["range"]
#         return result

#     def to_dict(self) -> dict:
#         out: dict = {"types": {}, "objects": {}, "enum_literals": self._literals}
#         for k, v in self._types.items():
#             out["types"][k] = v.__dict__
#         for k, v in self._objects.items():
#             out["objects"][k] = v.__dict__
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 5 — EXPRESSION RESOLVER
# # ══════════════════════════════════════════════════════════════════

# class ExpressionResolver:

#     def __init__(self, registry: TypeRegistry):
#         self.reg = registry

#     def resolve(self, node) -> dict[str, dict]:
#         found: dict[str, dict] = {}
#         self._walk(node, found)
#         return found

#     def _walk(self, node, found: dict):
#         if node is None:
#             return
#         if isinstance(node, lal.ParenExpr):
#             self._walk(node.f_expr, found)
#         elif isinstance(node, lal.DottedName):
#             self._handle_dotted(node, found)
#         elif isinstance(node, lal.CallExpr):
#             self._handle_call(node, found)
#         elif isinstance(node, (lal.BinOp, lal.RelationOp,
#                                 lal.MembershipExpr, lal.OpAndThen, lal.OpOrElse)):
#             self._walk(node.f_left,  found)
#             self._walk(node.f_right, found)
#         elif isinstance(node, lal.UnOp):
#             self._walk(node.f_expr, found)
#         elif isinstance(node, lal.AttributeRef):
#             self._walk(node.f_prefix, found)
#             try:
#                 for arg in node.f_args:
#                     self._walk(arg, found)
#             except Exception:
#                 pass
#         elif isinstance(node, lal.QualExpr):
#             self._walk(node.f_suffix, found)
#         elif isinstance(node, lal.IfExpr):
#             self._walk(node.f_cond_expr, found)
#             self._walk(node.f_then_expr, found)
#             for alt in node.f_alternatives:
#                 self._walk(alt.f_cond_expr, found)
#                 self._walk(alt.f_then_expr, found)
#             self._walk(node.f_else_expr, found)
#         elif isinstance(node, lal.CaseExpr):
#             self._walk(node.f_expr, found)
#             for alt in node.f_cases:
#                 self._walk(alt.f_expr, found)
#         elif isinstance(node, lal.Aggregate):
#             try:
#                 for assoc in node.f_assocs:
#                     self._walk(assoc.f_r_expr, found)
#             except Exception:
#                 pass
#         elif isinstance(node, lal.Identifier):
#             self._handle_identifier(node, found)
#         else:
#             try:
#                 for child in node.children:
#                     self._walk(child, found)
#             except Exception:
#                 pass

#     def _handle_dotted(self, node: lal.DottedName, found: dict):
#         prefix_text = _safe_text(node.f_prefix)
#         suffix_text = _safe_text(node.f_suffix)
#         full_text   = _safe_text(node)

#         if full_text and full_text not in found:
#             fi  = self.reg.field_info(prefix_text, suffix_text)
#             sem = _semantic_type(node)
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"]     = sem["type"]
#                 fi["semantic_type"] = sem
#             found[full_text] = fi

#         if prefix_text and prefix_text not in found:
#             found[prefix_text] = self._resolve_name(node.f_prefix, prefix_text)

#         if suffix_text and suffix_text not in found:
#             fi  = self.reg.field_info(prefix_text, suffix_text)
#             sem = _semantic_type(node.f_suffix) if node.f_suffix else {"type": "Unknown"}
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"] = sem["type"]
#             fi["parent_object"] = prefix_text
#             found[suffix_text]  = fi

#     def _handle_call(self, node: lal.CallExpr, found: dict):
#         try:
#             cname = _safe_text(node.f_name)
#             if cname and cname not in found:
#                 found[cname] = {
#                     "kind":      "call",
#                     "data_type": _semantic_type(node).get("type", "Unknown"),
#                     "args":      [_safe_text(p) for p in node.f_suffix],
#                 }
#             try:
#                 for p in node.f_suffix:
#                     self._walk(p, found)
#             except Exception:
#                 pass
#         except Exception:
#             pass

#     def _handle_identifier(self, node: lal.Identifier, found: dict):
#         name = _safe_text(node)
#         if not name or name in found:
#             return
#         found[name] = self._resolve_name(node, name)

#     def _resolve_name(self, node, name: str) -> dict:
#         lit = self.reg.enum_literal(name)
#         if lit:
#             return dict(lit)

#         obj = self.reg.resolve(name)
#         if obj:
#             rec: dict = {
#                 "kind": obj.kind, "data_type": obj.data_type,
#                 "declared_in": obj.declared_in, "scope": obj.scope,
#             }
#             if obj.initial_value:
#                 rec["initial_value"]  = obj.initial_value
#             if obj.possible_values:
#                 rec["possible_values"] = obj.possible_values
#                 rec["value_count"]     = obj.value_count
#             if obj.range_str:
#                 rec["range"] = obj.range_str
#             sem = _semantic_type(node) if node else {"type": "Unknown"}
#             if sem.get("type") not in ("Unknown", "") and obj.data_type.get("type") == "Unknown":
#                 rec["data_type"] = sem
#             return rec

#         sem = _semantic_type(node) if node else {"type": "Unknown"}
#         if sem.get("type") not in ("Unknown", "", None):
#             rec = {"kind": "identifier", "data_type": sem}
#             te  = self.reg.resolve_type(sem["type"])
#             if te and te.kind == "enum":
#                 rec["possible_values"] = te.enum_values
#                 rec["value_count"]     = len(te.enum_values)
#             return rec

#         te = self.reg.resolve_type(name)
#         if te:
#             rec = {"kind": "type_reference", "data_type": {"type": name}}
#             if te.kind == "enum":
#                 rec["possible_values"] = te.enum_values
#                 rec["value_count"]     = len(te.enum_values)
#             return rec

#         return {"kind": "unresolved", "data_type": {"type": "Unknown"}}


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 6 — CONTROL FLOW WALKER
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class ConditionRecord:
#     condition_text: str
#     branch_type: str
#     nesting_depth: int
#     variables: dict[str, dict]


# @dataclass
# class BranchBodyRecord:
#     variable_name: str
#     kind: str
#     data_type: dict
#     used_in_branch: str
#     assigned_from: str    = ""
#     possible_values: list = field(default_factory=list)
#     value_count: int      = 0


# class ControlFlowWalker:

#     def __init__(self, registry: TypeRegistry):
#         self.reg      = registry
#         self.resolver = ExpressionResolver(registry)

#     def walk_subprogram(self, subp: lal.SubpBody) -> dict:
#         self.conditions:      list[ConditionRecord]  = []
#         self.branch_bodies:   list[BranchBodyRecord] = []
#         self.procedure_calls: list[dict]             = []

#         stmts = _get_stmts_from_subp(subp)
#         self._walk_stmts(stmts, depth=0, branch_label="")

#         return {
#             "if_conditions":         [self._cond_to_dict(c) for c in self.conditions],
#             "branch_body_variables": self._bodies_to_dict(),
#             "procedure_calls":       self.procedure_calls,
#         }

#     def _walk_stmts(self, stmts: list, depth: int, branch_label: str):
#         for stmt in stmts:
#             self._walk_stmt(stmt, depth, branch_label)

#     def _walk_stmt(self, node, depth: int, branch_label: str):
#         if node is None:
#             return
#         kind = node.kind_name

#         if kind == "IfStmt":
#             # ── condition ─────────────────────────────────────
#             cond = node.f_cond_expr
#             if isinstance(cond, lal.ParenExpr):
#                 cond = cond.f_expr
#             self._record_condition(cond, "if", depth)

#             # ── then body ─────────────────────────────────────
#             self._walk_stmts(_iter_list(node, "f_then_stmts"), depth + 1, "then")

#             # ── elsif ─────────────────────────────────────────
#             for part in _iter_list(node, "f_alternatives"):
#                 ec = getattr(part, "f_cond_expr", None)
#                 if isinstance(ec, lal.ParenExpr):
#                     ec = ec.f_expr
#                 self._record_condition(ec, "elsif", depth)
#                 self._walk_stmts(_iter_list(part, "f_stmts"), depth + 1, "elsif")

#             # ── else body ─────────────────────────────────────
#             self._walk_stmts(_iter_list(node, "f_else_stmts"), depth + 1, "else")

#         elif kind == "CaseStmt":
#             self._record_condition(node.f_expr, "case_expr", depth)
#             for alt in _iter_list(node, "f_alternatives"):
#                 for choice in _iter_list(alt, "f_choices"):
#                     vars_c = self.resolver.resolve(choice)
#                     if vars_c:
#                         self.conditions.append(ConditionRecord(
#                             condition_text=_safe_text(choice),
#                             branch_type="case_choice",
#                             nesting_depth=depth,
#                             variables=vars_c,
#                         ))
#                 self._walk_stmts(_iter_list(alt, "f_stmts"), depth + 1, "case_body")

#         elif kind == "WhileLoopStmt":
#             try:
#                 self._record_condition(node.f_spec.f_expr, "while", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "ForLoopStmt":
#             try:
#                 spec = node.f_spec
#                 if hasattr(spec, "f_iter_expr") and spec.f_iter_expr:
#                     self._record_condition(spec.f_iter_expr, "for", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "LoopStmt":
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "BlockStmt":
#             self._walk_stmts(_get_stmts_from_block(node), depth + 1, branch_label)

#         elif kind == "AssignStmt":
#             self._handle_assignment(node, branch_label)

#         elif kind == "CallStmt":
#             self._handle_call_stmt(node, branch_label)

#         elif kind == "ReturnStmt":
#             try:
#                 if node.f_return_expr:
#                     self._record_condition(node.f_return_expr, "return_expr", depth)
#             except Exception:
#                 pass

#         elif kind == "ObjectDecl":
#             dtype = _best_type(node)
#             for ident in node.f_ids:
#                 iname = ident.text.strip()
#                 init  = _safe_text(node.f_default_expr) if node.f_default_expr else ""
#                 br    = BranchBodyRecord(
#                     variable_name=iname, kind="local_decl",
#                     data_type=dtype, used_in_branch=branch_label,
#                     assigned_from=init,
#                 )
#                 self._enrich_body_record(br)
#                 self.branch_bodies.append(br)

#     # ── helpers ────────────────────────────────────────────────

#     def _record_condition(self, cond_node, branch_type: str, depth: int):
#         if cond_node is None:
#             return
#         variables = self.resolver.resolve(cond_node)
#         self.conditions.append(ConditionRecord(
#             condition_text=_safe_text(cond_node),
#             branch_type=branch_type,
#             nesting_depth=depth,
#             variables=variables,
#         ))

#     def _handle_assignment(self, node: lal.AssignStmt, branch_label: str):
#         lhs     = node.f_dest
#         rhs     = node.f_expr
#         lhs_txt = _safe_text(lhs)
#         rhs_txt = _safe_text(rhs)
#         dtype   = _semantic_type(lhs)

#         if dtype.get("type") == "Unknown":
#             base_name = lhs_txt.split(".")[0]
#             obj = self.reg.resolve(base_name)
#             if obj:
#                 if "." in lhs_txt:
#                     parts = lhs_txt.split(".", 1)
#                     fi    = self.reg.field_info(parts[0], parts[1])
#                     if fi["data_type"] != "Unknown":
#                         dtype = {"type": fi["data_type"]}
#                 else:
#                     dtype = obj.data_type

#         br = BranchBodyRecord(
#             variable_name=lhs_txt, kind="assignment",
#             data_type=dtype, used_in_branch=branch_label,
#             assigned_from=rhs_txt,
#         )
#         self._enrich_body_record(br)
#         self.branch_bodies.append(br)

#         existing = {b.variable_name for b in self.branch_bodies}
#         for vname, vinfo in self.resolver.resolve(rhs).items():
#             if vname not in existing:
#                 self.branch_bodies.append(BranchBodyRecord(
#                     variable_name=vname, kind="rhs_reference",
#                     data_type=vinfo.get("data_type", {"type": "Unknown"}),
#                     used_in_branch=branch_label,
#                     possible_values=vinfo.get("possible_values", []),
#                     value_count=vinfo.get("value_count", 0),
#                 ))

#     def _handle_call_stmt(self, node: lal.CallStmt, branch_label: str):
#         call = node.f_call
#         try:
#             cname = _safe_text(getattr(call, "f_name", None)) or _safe_text(call)
#             dtype = _semantic_type(call)
#             args  = []
#             try:
#                 for p in call.f_suffix:
#                     args.append(_safe_text(p))
#             except Exception:
#                 pass
#             self.procedure_calls.append({
#                 "name":      cname,
#                 "data_type": dtype.get("type", "Unknown"),
#                 "args":      args,
#                 "called_in": branch_label,
#             })
#         except Exception:
#             pass

#     def _enrich_body_record(self, br: BranchBodyRecord):
#         base = br.data_type.get("type", "Unknown").split()[0] \
#                if isinstance(br.data_type, dict) else "Unknown"
#         te = self.reg.resolve_type(base)
#         if te and te.kind == "enum":
#             br.possible_values = te.enum_values
#             br.value_count     = len(te.enum_values)

#     @staticmethod
#     def _cond_to_dict(c: ConditionRecord) -> dict:
#         return {
#             "condition_text": c.condition_text,
#             "branch_type":    c.branch_type,
#             "nesting_depth":  c.nesting_depth,
#             "variables":      c.variables,
#         }

#     def _bodies_to_dict(self) -> dict:
#         out: dict = {}
#         for br in self.branch_bodies:
#             entry: dict = {
#                 "kind":           br.kind,
#                 "data_type":      br.data_type,
#                 "used_in_branch": br.used_in_branch,
#             }
#             if br.assigned_from:
#                 entry["assigned_from"] = br.assigned_from
#             if br.possible_values:
#                 entry["possible_values"] = br.possible_values
#                 entry["value_count"]     = br.value_count
#             out[br.variable_name] = entry
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 7 — TOP-LEVEL EXTRACTOR
# # ══════════════════════════════════════════════════════════════════

# class ControlFlowExtractor:
#     """
#     Main entry point.
#         extractor = ControlFlowExtractor(units)
#         report    = extractor.run()
#     """

#     def __init__(self, units: list):
#         self.units = units

#     def run(self) -> dict:
#         registry = TypeRegistry(self.units)
#         walker   = ControlFlowWalker(registry)
#         report: dict = {}

#         for unit in self.units:
#             if not unit.root:
#                 continue
#             fname      = unit.filename
#             file_entry: dict = {}

#             for subp in unit.root.findall(lal.SubpBody):
#                 try:
#                     sname = (
#                         subp.f_subp_spec.f_subp_name.text
#                         if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                         else "UNKNOWN"
#                     )
#                 except Exception:
#                     sname = "UNKNOWN"

#                 result = walker.walk_subprogram(subp)

#                 # ── debug info if nothing extracted ────────────
#                 if (not result["if_conditions"] and
#                         not result["branch_body_variables"] and
#                         not result["procedure_calls"]):
#                     raw = _get_stmts_from_subp(subp)
#                     result["_debug"] = {
#                         "stmt_count": len(raw),
#                         "stmt_kinds": [s.kind_name for s in raw[:10]],
#                         "hint": (
#                             "0 stmts found — run debug_ast.py on this file "
#                             "to inspect the AST structure"
#                             if not raw else
#                             "Stmts found but no control-flow — subprogram may "
#                             "contain only assignments/calls at top level"
#                         ),
#                     }

#                 file_entry[sname] = result

#             if file_entry:
#                 report[fname] = file_entry

#         report["__registry__"] = registry.to_dict()
#         return report


# # ══════════════════════════════════════════════════════════════════
# #  ENTRY POINT
# # ══════════════════════════════════════════════════════════════════

# if __name__ == "__main__":
#     import sys

#     project_path = sys.argv[1] if len(sys.argv) > 1 else "/your/project/path"

#     ctx       = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([project_path]))
#     ada_files = collect_ada_files(project_path)
#     units: list = []
#     for f in ada_files:
#         try:
#             unit = ctx.get_from_file(f)
#             if unit.root:
#                 units.append(unit)
#         except Exception as e:
#             print(f"[WARN] {f}: {e}")

#     extractor = ControlFlowExtractor(units)
#     result    = extractor.run()
#     print(json.dumps(result, indent=4, default=str))




"""
control_flow_extractor.py
=========================
Extracts every variable / field / enum-literal / constant that appears
inside if / elsif / else / case / while / for / loop bodies, with full
data-type resolution traced across ALL Ada source files in the project.

Key fix: rhs_reference items that show "Unknown" are now resolved by:
  1. Semantic p_type (works when .ads files share the same AnalysisContext)
  2. Cross-file registry lookup (type/subtype/object declared anywhere)
  3. Record-field traversal for DottedName (Odata.Quaternion)
  4. Enum-literal reverse lookup (QCOMPUTED_AND_OK → parent type + all siblings)

Usage
-----
    from control_flow_extractor import ControlFlowExtractor, load_units

    units     = load_units("/path/to/ada/project")
    extractor = ControlFlowExtractor(units)
    report    = extractor.run()

    import json
    print(json.dumps(report, indent=4))
# """

# from __future__ import annotations
# import os, json
# from dataclasses import dataclass, field
# import libadalang as lal


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 1 — PROJECT LOADER  (always load ALL files together)
# # ══════════════════════════════════════════════════════════════════

# def collect_ada_files(path: str) -> list[str]:
#     ada_files: list[str] = []
#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for f in files:
#                 if f.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, f))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")
#     return ada_files


# def load_units(project_path: str) -> list:
#     """
#     Load every .adb / .ads file into ONE shared AnalysisContext so that
#     p_type semantic resolution can cross file boundaries.
#     This is the CRITICAL step — all files must share the same context.
#     """
#     ctx       = lal.AnalysisContext(
#                     unit_provider=lal.UnitProvider.auto([project_path])
#                 )
#     ada_files = collect_ada_files(project_path)
#     units: list = []
#     for f in ada_files:
#         try:
#             unit = ctx.get_from_file(f)
#             if unit.root:
#                 units.append(unit)
#             if unit.diagnostics:
#                 for d in unit.diagnostics:
#                     print(f"[DIAG] {f}: {d}")
#         except Exception as e:
#             print(f"[WARN] Could not parse {f}: {e}")
#     print(f"[INFO] Loaded {len(units)} units from {project_path}")
#     return units


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 2 — SAFE AST HELPERS
# # ══════════════════════════════════════════════════════════════════

# def _safe_text(node) -> str:
#     try:
#         return node.text.strip() if node and node.text else ""
#     except Exception:
#         return ""


# _STMT_KINDS = frozenset({
#     "IfStmt", "CaseStmt", "AssignStmt", "CallStmt",
#     "WhileLoopStmt", "ForLoopStmt", "LoopStmt",
#     "BlockStmt", "ReturnStmt", "NullStmt",
#     "ExitStmt", "GotoStmt", "ExtendedReturnStmt", "ObjectDecl",
# })


# def _get_stmts_from_subp(subp: lal.SubpBody) -> list:
#     """Try every known LAL path to get the executable statement list."""
#     # Path 1: f_body.f_stmts  (standard)
#     try:
#         body = subp.f_body
#         if body and hasattr(body, "f_stmts"):
#             stmts = list(body.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     # Path 2: findall(HandledStmts)
#     try:
#         for hs in subp.findall(lal.HandledStmts):
#             stmts = list(hs.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     # Path 3: f_stmts directly
#     try:
#         stmts = list(subp.f_stmts)
#         if stmts:
#             return stmts
#     except Exception:
#         pass
#     # Path 4: children scan
#     try:
#         for child in subp.children:
#             if child and child.kind_name == "HandledStmts":
#                 stmts = list(child.f_stmts)
#                 if stmts:
#                     return stmts
#             try:
#                 for gc in (child.children if child else []):
#                     if gc and gc.kind_name == "HandledStmts":
#                         stmts = list(gc.f_stmts)
#                         if stmts:
#                             return stmts
#             except Exception:
#                 pass
#     except Exception:
#         pass
#     # Path 5: brute-force collect statement-kind children
#     try:
#         stmts = [c for c in subp.children if c and c.kind_name in _STMT_KINDS]
#         if stmts:
#             return stmts
#     except Exception:
#         pass
#     return []


# def _iter_list(node, attr: str) -> list:
#     try:
#         val = getattr(node, attr, None)
#         return list(val) if val is not None else []
#     except Exception:
#         return []


# def _get_stmts_from_block(node) -> list:
#     for attr in ("f_stmts", "f_body"):
#         try:
#             val = getattr(node, attr, None)
#             if val is not None:
#                 stmts = list(val) if not hasattr(val, "f_stmts") else list(val.f_stmts)
#                 if stmts:
#                     return stmts
#         except Exception:
#             pass
#     try:
#         for hs in node.findall(lal.HandledStmts):
#             stmts = list(hs.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     return []


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 3 — TYPE RESOLUTION HELPERS
# # ══════════════════════════════════════════════════════════════════

# def _semantic_type(node) -> dict:
#     """
#     Ask libadalang for the semantic type of *node*.
#     Works across files when all units share one AnalysisContext.
#     """
#     try:
#         typ = node.p_type
#         if typ is None:
#             return {"type": "Unknown"}
#         base = _safe_text(typ.p_defining_name)
#         if not base:
#             return {"type": "Unknown"}
#         tdef = getattr(typ, "f_type_def", None)
#         if tdef is None:
#             return {"type": base}

#         if isinstance(tdef, lal.SignedIntTypeDef):
#             try:
#                 r = _safe_text(tdef.f_range.f_range)
#                 if r.lower().startswith("range "):
#                     r = r[6:].strip()
#                 return {"type": base, "range": r} if r else {"type": base}
#             except Exception:
#                 return {"type": base}
#         if isinstance(tdef, lal.ModIntTypeDef):
#             try:
#                 return {"type": base, "modulus": _safe_text(tdef.f_expr)}
#             except Exception:
#                 return {"type": base}
#         if isinstance(tdef, lal.FloatingPointDef):
#             try:
#                 res = {"type": base, "digits": _safe_text(tdef.f_num_digits)}
#                 if tdef.f_range:
#                     res["range"] = _safe_text(tdef.f_range.f_range)
#                 return res
#             except Exception:
#                 return {"type": base}
#         if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#             try:
#                 res = {"type": base, "delta": _safe_text(tdef.f_delta)}
#                 if tdef.f_range:
#                     res["range"] = _safe_text(tdef.f_range.f_range)
#                 return res
#             except Exception:
#                 return {"type": base}
#         return {"type": base}
#     except Exception:
#         return {"type": "Unknown"}


# def _parse_subtype_indication(node) -> dict:
#     if node is None:
#         return {"type": "Unknown"}
#     if not isinstance(node, lal.SubtypeIndication):
#         return {"type": _safe_text(node) or "Unknown"}
#     base = _safe_text(node.f_name)
#     c = node.f_constraint
#     if c is None:
#         return {"type": base}
#     if isinstance(c, lal.RangeConstraint):
#         r = _safe_text(c.f_range)
#         if r.lower().startswith("range "):
#             r = r[6:].strip()
#         return {"type": base, "range": r}
#     if isinstance(c, lal.DigitsConstraint):
#         res = {"type": base, "digits": _safe_text(c.f_digits)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     if isinstance(c, lal.DeltaConstraint):
#         res = {"type": base, "delta": _safe_text(c.f_delta)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     if isinstance(c, lal.IndexConstraint):
#         return {"type": base, "index_constraint": [_safe_text(x) for x in c.f_list]}
#     return {"type": base}


# def _best_type(node) -> dict:
#     sem = _semantic_type(node)
#     if sem.get("type") not in ("Unknown", "", None):
#         return sem
#     try:
#         te = node.f_type_expr
#         if te:
#             p = _parse_subtype_indication(te)
#             if p.get("type") not in ("Unknown", "", None):
#                 return p
#     except Exception:
#         pass
#     try:
#         raw = _safe_text(node.f_type_expr)
#         if raw:
#             return {"type": raw}
#     except Exception:
#         pass
#     return {"type": "Unknown"}


# def _get_scope_name(node) -> str:
#     p = node.parent
#     while p:
#         if isinstance(p, lal.SubpBody):
#             try:
#                 return p.f_subp_spec.f_subp_name.text
#             except Exception:
#                 return "subprogram"
#         if isinstance(p, lal.PackageBody):
#             try:
#                 return f"package:{p.f_package_name.text}"
#             except Exception:
#                 return "package"
#         p = p.parent
#     return "global"


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 4 — TYPE REGISTRY  (cross-file, syntactic scan)
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class TypeEntry:
#     name: str
#     kind: str           # enum|record|integer|modular|array|subtype|float|fixed|other
#     declared_in: str
#     enum_values:   list[dict]    = field(default_factory=list)
#     record_fields: dict          = field(default_factory=dict)
#     range_str: str               = ""
#     modulus: str                 = ""
#     element_type: dict           = field(default_factory=dict)
#     indices: list[str]           = field(default_factory=list)
#     base_type: str               = ""
#     structured: dict             = field(default_factory=dict)
#     extra: dict                  = field(default_factory=dict)


# @dataclass
# class ObjectEntry:
#     name: str
#     kind: str           # variable|constant
#     data_type: dict
#     initial_value: str
#     declared_in: str
#     scope: str
#     possible_values: list[dict]  = field(default_factory=list)
#     value_count: int             = 0
#     range_str: str               = ""


# class TypeRegistry:
#     """
#     Single-pass syntactic scan over ALL units.
#     Provides cross-file lookup for types, objects, and enum literals.
#     Used as fallback when LAL semantic resolution returns Unknown.
#     """

#     def __init__(self, units: list):
#         self._types:    dict[str, TypeEntry]   = {}
#         self._objects:  dict[str, ObjectEntry] = {}
#         self._literals: dict[str, dict]        = {}

#         for unit in units:
#             if unit.root:
#                 self._scan_unit(unit)

#         # Second pass: enrich objects with enum / range from their type
#         for obj in self._objects.values():
#             self._enrich_object(obj)

#     # ── scan ──────────────────────────────────────────────────

#     def _scan_unit(self, unit):
#         fname = unit.filename
#         for td in unit.root.findall(lal.TypeDecl):
#             if td and td.f_name:
#                 self._register_type_decl(td, fname)
#         for st in unit.root.findall(lal.SubtypeDecl):
#             if st.f_name:
#                 self._register_subtype_decl(st, fname)
#         for obj in unit.root.findall(lal.ObjectDecl):
#             self._register_object_decl(obj, fname)

#     def _register_type_decl(self, td, fname: str):
#         tname = td.f_name.text.strip()
#         tdef  = td.f_type_def
#         entry = TypeEntry(name=tname, kind="other", declared_in=fname)
#         try:
#             if isinstance(tdef, lal.EnumTypeDef):
#                 entry.kind = "enum"
#                 for i, lit in enumerate(tdef.f_enum_literals):
#                     ln = _safe_text(lit)
#                     entry.enum_values.append({"value": ln, "position": i})
#                     self._literals[ln] = {
#                         "kind": "enum_literal", "data_type": tname,
#                         "parent_type": tname, "value": ln,
#                         "position": i, "declared_in": fname,
#                         "all_values": [],   # filled in post-pass below
#                     }
#             elif isinstance(tdef, lal.RecordTypeDef):
#                 entry.kind = "record"
#                 for comp in tdef.findall(lal.ComponentDecl):
#                     if not comp.f_component_def:
#                         continue
#                     fr = _safe_text(comp.f_component_def.f_type_expr)
#                     fs = _best_type(comp.f_component_def)
#                     for n in comp.f_ids:
#                         entry.record_fields[n.text.strip()] = {
#                             "raw_type": fr, "structured_type": fs, "declared_in": fname,
#                         }
#             elif isinstance(tdef, lal.SignedIntTypeDef):
#                 entry.kind = "integer"
#                 try:
#                     r = _safe_text(tdef.f_range.f_range)
#                     if r.lower().startswith("range "):
#                         r = r[6:].strip()
#                     entry.range_str = r
#                 except Exception:
#                     pass
#             elif isinstance(tdef, lal.ModIntTypeDef):
#                 entry.kind    = "modular"
#                 entry.modulus = _safe_text(tdef.f_expr)
#             elif isinstance(tdef, lal.ArrayTypeDef):
#                 entry.kind = "array"
#                 try:
#                     entry.element_type = _parse_subtype_indication(
#                         tdef.f_component_type.f_type_expr)
#                 except Exception:
#                     entry.element_type = {"type": "Unknown"}
#                 try:
#                     entry.indices = [_safe_text(i) for i in tdef.f_indices.f_list]
#                 except Exception:
#                     pass
#             elif isinstance(tdef, lal.FloatingPointDef):
#                 entry.kind = "float"
#                 try:
#                     entry.extra["digits"] = _safe_text(tdef.f_num_digits)
#                 except Exception:
#                     pass
#             elif isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#                 entry.kind = "fixed"
#                 try:
#                     entry.extra["delta"] = _safe_text(tdef.f_delta)
#                 except Exception:
#                     pass
#         except Exception as e:
#             entry.extra["error"] = str(e)
#         self._types[tname] = entry

#         # Backfill all_values for enum literals of this type
#         if entry.kind == "enum":
#             for lit_info in self._literals.values():
#                 if lit_info.get("parent_type") == tname:
#                     lit_info["all_values"] = entry.enum_values

#     def _register_subtype_decl(self, st, fname: str):
#         sname    = st.f_name.text.strip()
#         raw_node = getattr(st, "f_subtype", None) or getattr(st, "f_type_expr", None)
#         parsed   = _parse_subtype_indication(raw_node) if raw_node else {"type": "Unknown"}
#         base     = parsed.get("type", "Unknown").split()[0]
#         entry    = TypeEntry(name=sname, kind="subtype", declared_in=fname,
#                              base_type=base, structured=parsed)
#         parent   = self._types.get(base)
#         if parent and parent.kind == "enum":
#             entry.enum_values = parent.enum_values[:]
#         self._types[sname] = entry

#     def _register_object_decl(self, obj, fname: str):
#         is_const = False
#         try:
#             is_const = obj.f_has_constant.kind_name == "ConstantPresent"
#         except Exception:
#             pass
#         init_val = ""
#         try:
#             if obj.f_default_expr:
#                 init_val = _safe_text(obj.f_default_expr)
#         except Exception:
#             pass
#         dtype = _best_type(obj)
#         scope = _get_scope_name(obj)
#         for ident in obj.f_ids:
#             iname = ident.text.strip()
#             self._objects[iname] = ObjectEntry(
#                 name=iname, kind="constant" if is_const else "variable",
#                 data_type=dtype, initial_value=init_val,
#                 declared_in=fname, scope=scope,
#             )

#     def _enrich_object(self, obj: ObjectEntry):
#         base = obj.data_type.get("type", "Unknown").split()[0]
#         te   = self._resolve_type_chain(base)
#         if te is None:
#             return
#         if te.kind == "enum":
#             obj.possible_values = te.enum_values
#             obj.value_count     = len(te.enum_values)
#         elif te.kind in ("integer", "modular"):
#             obj.range_str = te.range_str or te.modulus
#         elif te.kind == "record":
#             pass  # fields already stored in type entry

#     def _resolve_type_chain(self, name: str, depth: int = 0) -> TypeEntry | None:
#         """Follow subtype/alias chain up to 10 levels."""
#         if not name or depth > 10:
#             return None
#         te = self._types.get(name)
#         if te is None:
#             return None
#         if te.kind == "subtype" and te.base_type and te.base_type != name:
#             parent = self._resolve_type_chain(te.base_type, depth + 1)
#             if parent:
#                 # inherit enum values
#                 if parent.kind == "enum" and not te.enum_values:
#                     te.enum_values  = parent.enum_values[:]
#                 return parent
#         return te

#     # ── public API ──────────────────────────────────────────────

#     def resolve(self, name: str) -> ObjectEntry | None:
#         return self._objects.get(name)

#     def resolve_type(self, name: str) -> TypeEntry | None:
#         return self._resolve_type_chain(name)

#     def enum_literal(self, name: str) -> dict | None:
#         return self._literals.get(name)

#     def field_info(self, object_name: str, field_name: str) -> dict:
#         """
#         Full resolution for Odata.QuatStatus:
#           Odata → its type → record fields → QuatStatus → QuatStatus's type → enum values
#         """
#         result: dict = {
#             "kind": "field", "parent_object": object_name,
#             "field_name": field_name, "data_type": "Unknown",
#             "declared_in": "Unknown", "possible_values": [], "value_count": 0,
#         }
#         obj = self._objects.get(object_name)
#         if obj is None:
#             return result

#         obj_type_name = obj.data_type.get("type", "Unknown").split()[0]
#         te = self._resolve_type_chain(obj_type_name)
#         if te is None or te.kind != "record":
#             return result

#         # Case-insensitive field lookup
#         finfo = te.record_fields.get(field_name)
#         if finfo is None:
#             for fn, fv in te.record_fields.items():
#                 if fn.lower() == field_name.lower():
#                     finfo = fv
#                     break
#         if finfo is None:
#             return result

#         raw    = finfo.get("raw_type", "Unknown")
#         struct = finfo.get("structured_type", {"type": raw})
#         base_ft= struct.get("type", raw).split()[0]

#         result["data_type"]       = raw
#         result["structured_type"] = struct
#         result["declared_in"]     = finfo.get("declared_in", "Unknown")

#         # Resolve field's type for enum values / range
#         ft = self._resolve_type_chain(base_ft)
#         if ft:
#             if ft.kind == "enum":
#                 result["possible_values"] = ft.enum_values
#                 result["value_count"]     = len(ft.enum_values)
#             elif ft.kind in ("integer", "modular"):
#                 result["range"] = ft.range_str or ft.modulus
#             elif ft.kind == "subtype":
#                 result["subtype_of"] = ft.base_type
#                 vals = ft.enum_values
#                 if not vals:
#                     grandparent = self._resolve_type_chain(ft.base_type)
#                     if grandparent and grandparent.kind == "enum":
#                         vals = grandparent.enum_values
#                 result["possible_values"] = vals
#                 result["value_count"]     = len(vals)
#         elif "range" in struct:
#             result["range"] = struct["range"]

#         return result

#     def to_dict(self) -> dict:
#         out: dict = {"types": {}, "objects": {}, "enum_literals": self._literals}
#         for k, v in self._types.items():
#             out["types"][k] = v.__dict__
#         for k, v in self._objects.items():
#             out["objects"][k] = v.__dict__
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 5 — EXPRESSION RESOLVER
# #  Resolves every identifier in an expression to its full type info.
# #  Resolution order: semantic p_type → registry lookup → fallback
# # ══════════════════════════════════════════════════════════════════

# # Standard Ada identifiers we don't want to report as "unknown"
# _BUILTIN_TYPES = frozenset({
#     "Boolean", "Integer", "Float", "Duration", "Character",
#     "String", "Natural", "Positive", "Long_Integer", "Long_Float",
#     "Short_Integer", "Short_Float", "Wide_Character",
#     "True", "False",
# })

# _BUILTIN_MAP = {
#     "True":  {"kind": "enum_literal", "data_type": "Boolean",
#               "parent_type": "Boolean", "value": "True",
#               "all_values": [{"value": "False", "position": 0},
#                              {"value": "True",  "position": 1}]},
#     "False": {"kind": "enum_literal", "data_type": "Boolean",
#               "parent_type": "Boolean", "value": "False",
#               "all_values": [{"value": "False", "position": 0},
#                              {"value": "True",  "position": 1}]},
# }


# class ExpressionResolver:

#     def __init__(self, registry: TypeRegistry):
#         self.reg = registry

#     def resolve(self, node) -> dict[str, dict]:
#         found: dict[str, dict] = {}
#         self._walk(node, found)
#         return found

#     # ── AST walker ────────────────────────────────────────────

#     def _walk(self, node, found: dict):
#         if node is None:
#             return
#         if isinstance(node, lal.ParenExpr):
#             self._walk(node.f_expr, found)
#         elif isinstance(node, lal.DottedName):
#             self._handle_dotted(node, found)
#         elif isinstance(node, lal.CallExpr):
#             self._handle_call(node, found)
#         elif isinstance(node, (lal.BinOp, lal.RelationOp,
#                                 lal.MembershipExpr, lal.OpAndThen, lal.OpOrElse)):
#             self._walk(node.f_left,  found)
#             self._walk(node.f_right, found)
#         elif isinstance(node, lal.UnOp):
#             self._walk(node.f_expr, found)
#         elif isinstance(node, lal.AttributeRef):
#             self._walk(node.f_prefix, found)
#             try:
#                 for arg in node.f_args:
#                     self._walk(arg, found)
#             except Exception:
#                 pass
#         elif isinstance(node, lal.QualExpr):
#             self._walk(node.f_suffix, found)
#         elif isinstance(node, lal.IfExpr):
#             self._walk(node.f_cond_expr, found)
#             self._walk(node.f_then_expr, found)
#             for alt in node.f_alternatives:
#                 self._walk(alt.f_cond_expr, found)
#                 self._walk(alt.f_then_expr, found)
#             self._walk(node.f_else_expr, found)
#         elif isinstance(node, lal.CaseExpr):
#             self._walk(node.f_expr, found)
#             for alt in node.f_cases:
#                 self._walk(alt.f_expr, found)
#         elif isinstance(node, lal.Aggregate):
#             try:
#                 for assoc in node.f_assocs:
#                     self._walk(assoc.f_r_expr, found)
#             except Exception:
#                 pass
#         elif isinstance(node, lal.Identifier):
#             self._handle_identifier(node, found)
#         else:
#             try:
#                 for child in node.children:
#                     self._walk(child, found)
#             except Exception:
#                 pass

#     # ── DottedName: Odata.QuatStatus ──────────────────────────

#     def _handle_dotted(self, node: lal.DottedName, found: dict):
#         prefix_text = _safe_text(node.f_prefix)
#         suffix_text = _safe_text(node.f_suffix)
#         full_text   = _safe_text(node)

#         # ① Full dotted name  (Odata.QuatStatus)
#         if full_text and full_text not in found:
#             # Try registry field resolution first (syntactic, always works)
#             fi  = self.reg.field_info(prefix_text, suffix_text)
#             # Also try semantic type on the full node
#             sem = _semantic_type(node)
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"]     = sem["type"]
#                 fi["semantic_type"] = sem
#                 # Now try to enrich with enum values using the semantic type
#                 te = self.reg.resolve_type(sem["type"])
#                 if te and te.kind == "enum":
#                     fi["possible_values"] = te.enum_values
#                     fi["value_count"]     = len(te.enum_values)
#             found[full_text] = fi

#         # ② Prefix object  (Odata)
#         if prefix_text and prefix_text not in found:
#             found[prefix_text] = self._resolve_name(node.f_prefix, prefix_text)

#         # ③ Suffix field  (QuatStatus) — standalone with parent_object annotation
#         if suffix_text and suffix_text not in found:
#             fi  = self.reg.field_info(prefix_text, suffix_text)
#             sem = _semantic_type(node.f_suffix) if node.f_suffix else {"type": "Unknown"}
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"] = sem["type"]
#                 # Enrich with enum values
#                 te = self.reg.resolve_type(sem["type"])
#                 if te and te.kind == "enum":
#                     fi["possible_values"] = te.enum_values
#                     fi["value_count"]     = len(te.enum_values)
#             fi["parent_object"] = prefix_text
#             found[suffix_text]  = fi

#     # ── CallExpr: Sqrt(...), FL6(...) ─────────────────────────

#     def _handle_call(self, node: lal.CallExpr, found: dict):
#         try:
#             cname = _safe_text(node.f_name)
#             # Type conversions like FL6(...) or Double(...) — skip as noise
#             # but DO walk their arguments to capture inner identifiers
#             try:
#                 for p in node.f_suffix:
#                     self._walk(p, found)
#             except Exception:
#                 pass
#             # Only record if it looks like a real procedure/function call
#             # (i.e. name is not a known type from registry)
#             if cname and cname not in found:
#                 te = self.reg.resolve_type(cname)
#                 if te is None:  # not a type conversion — it's a real call
#                     dtype = _semantic_type(node)
#                     found[cname] = {
#                         "kind":      "call",
#                         "data_type": dtype if dtype.get("type") != "Unknown"
#                                      else {"type": "procedure"},
#                         "args": [_safe_text(p) for p in node.f_suffix],
#                     }
#         except Exception:
#             pass

#     # ── Plain Identifier: QCOMPUTED_AND_OK ───────────────────

#     def _handle_identifier(self, node: lal.Identifier, found: dict):
#         name = _safe_text(node)
#         if not name or name in found:
#             return
#         found[name] = self._resolve_name(node, name)

#     # ── Master resolver ───────────────────────────────────────

#     def _resolve_name(self, node, name: str) -> dict:
#         """
#         Resolution order:
#           1. Built-in (True, False)
#           2. Enum literal registry   → parent type + all sibling values
#           3. Object registry         → data_type, scope, declared_in
#           4. Semantic p_type         → works cross-file when context is shared
#           5. Type name reference     → type is used as a value (e.g. type conversion)
#           6. Fallback
#         """

#         # 1. Built-ins
#         if name in _BUILTIN_MAP:
#             return dict(_BUILTIN_MAP[name])

#         # 2. Enum literal  (QCOMPUTED_AND_OK)
#         lit = self.reg.enum_literal(name)
#         if lit:
#             rec = dict(lit)
#             # Ensure all sibling values are included
#             if not rec.get("all_values"):
#                 te = self.reg.resolve_type(lit.get("parent_type", ""))
#                 if te and te.kind == "enum":
#                     rec["all_values"] = te.enum_values
#             return rec

#         # 3. Object registry  (Odata, LatestQuaternion, ...)
#         obj = self.reg.resolve(name)
#         if obj:
#             rec: dict = {
#                 "kind":        obj.kind,
#                 "data_type":   obj.data_type,
#                 "declared_in": obj.declared_in,
#                 "scope":       obj.scope,
#             }
#             if obj.initial_value:
#                 rec["initial_value"] = obj.initial_value
#             if obj.possible_values:
#                 rec["possible_values"] = obj.possible_values
#                 rec["value_count"]     = obj.value_count
#             if obj.range_str:
#                 rec["range"] = obj.range_str
#             # Try semantic type to enrich data_type if it's Unknown
#             if obj.data_type.get("type") in ("Unknown", "", None) and node is not None:
#                 sem = _semantic_type(node)
#                 if sem.get("type") not in ("Unknown", "", None):
#                     rec["data_type"] = sem
#                     # re-enrich with enum values if type changed
#                     te = self.reg.resolve_type(sem["type"])
#                     if te and te.kind == "enum":
#                         rec["possible_values"] = te.enum_values
#                         rec["value_count"]     = len(te.enum_values)
#             return rec

#         # 4. Semantic p_type (cross-file, requires shared AnalysisContext)
#         if node is not None:
#             sem = _semantic_type(node)
#             if sem.get("type") not in ("Unknown", "", None):
#                 rec = {"kind": "identifier", "data_type": sem}
#                 te  = self.reg.resolve_type(sem["type"])
#                 if te:
#                     if te.kind == "enum":
#                         rec["possible_values"] = te.enum_values
#                         rec["value_count"]     = len(te.enum_values)
#                     elif te.kind in ("integer", "modular"):
#                         rec["range"] = te.range_str or te.modulus
#                     elif te.kind == "record":
#                         rec["record_fields"] = list(te.record_fields.keys())
#                 return rec

#         # 5. Type name reference  (e.g. FL6 used as type conversion)
#         te = self.reg.resolve_type(name)
#         if te:
#             rec = {"kind": "type_conversion", "data_type": {"type": name}}
#             if te.kind == "enum":
#                 rec["possible_values"] = te.enum_values
#                 rec["value_count"]     = len(te.enum_values)
#             elif te.kind == "record":
#                 rec["record_fields"] = list(te.record_fields.keys())
#             return rec

#         # 6. Fallback
#         return {"kind": "unresolved", "data_type": {"type": "Unknown"}}


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 6 — CONTROL FLOW WALKER
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class ConditionRecord:
#     condition_text: str
#     branch_type: str       # if|elsif|while|for|case_expr|case_choice
#     nesting_depth: int
#     variables: dict[str, dict]


# @dataclass
# class BranchBodyRecord:
#     variable_name: str
#     kind: str              # assignment|rhs_reference|local_decl|call
#     data_type: dict
#     used_in_branch: str
#     assigned_from: str    = ""
#     possible_values: list = field(default_factory=list)
#     value_count: int      = 0


# class ControlFlowWalker:

#     def __init__(self, registry: TypeRegistry):
#         self.reg      = registry
#         self.resolver = ExpressionResolver(registry)

#     def walk_subprogram(self, subp: lal.SubpBody) -> dict:
#         self.conditions:      list[ConditionRecord]  = []
#         self.branch_bodies:   list[BranchBodyRecord] = []
#         self.procedure_calls: list[dict]             = []

#         stmts = _get_stmts_from_subp(subp)
#         self._walk_stmts(stmts, depth=0, branch_label="")

#         return {
#             "if_conditions":         [self._cond_to_dict(c) for c in self.conditions],
#             "branch_body_variables": self._bodies_to_dict(),
#             "procedure_calls":       self.procedure_calls,
#         }

#     def _walk_stmts(self, stmts: list, depth: int, branch_label: str):
#         for stmt in stmts:
#             self._walk_stmt(stmt, depth, branch_label)

#     def _walk_stmt(self, node, depth: int, branch_label: str):
#         if node is None:
#             return
#         kind = node.kind_name

#         if kind == "IfStmt":
#             cond = node.f_cond_expr
#             if isinstance(cond, lal.ParenExpr):
#                 cond = cond.f_expr
#             self._record_condition(cond, "if", depth)
#             self._walk_stmts(_iter_list(node, "f_then_stmts"), depth + 1, "then")
#             for part in _iter_list(node, "f_alternatives"):
#                 ec = getattr(part, "f_cond_expr", None)
#                 if isinstance(ec, lal.ParenExpr):
#                     ec = ec.f_expr
#                 self._record_condition(ec, "elsif", depth)
#                 self._walk_stmts(_iter_list(part, "f_stmts"), depth + 1, "elsif")
#             self._walk_stmts(_iter_list(node, "f_else_stmts"), depth + 1, "else")

#         elif kind == "CaseStmt":
#             self._record_condition(node.f_expr, "case_expr", depth)
#             for alt in _iter_list(node, "f_alternatives"):
#                 for choice in _iter_list(alt, "f_choices"):
#                     vars_c = self.resolver.resolve(choice)
#                     if vars_c:
#                         self.conditions.append(ConditionRecord(
#                             condition_text=_safe_text(choice),
#                             branch_type="case_choice",
#                             nesting_depth=depth,
#                             variables=vars_c,
#                         ))
#                 self._walk_stmts(_iter_list(alt, "f_stmts"), depth + 1, "case_body")

#         elif kind == "WhileLoopStmt":
#             try:
#                 self._record_condition(node.f_spec.f_expr, "while", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "ForLoopStmt":
#             try:
#                 spec = node.f_spec
#                 if hasattr(spec, "f_iter_expr") and spec.f_iter_expr:
#                     self._record_condition(spec.f_iter_expr, "for", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "LoopStmt":
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "BlockStmt":
#             self._walk_stmts(_get_stmts_from_block(node), depth + 1, branch_label)

#         elif kind == "AssignStmt":
#             self._handle_assignment(node, branch_label)

#         elif kind == "CallStmt":
#             self._handle_call_stmt(node, branch_label)

#         elif kind == "ReturnStmt":
#             try:
#                 if node.f_return_expr:
#                     self._record_condition(node.f_return_expr, "return_expr", depth)
#             except Exception:
#                 pass

#         elif kind == "ObjectDecl":
#             dtype = _best_type(node)
#             for ident in node.f_ids:
#                 iname = ident.text.strip()
#                 init  = _safe_text(node.f_default_expr) if node.f_default_expr else ""
#                 br    = BranchBodyRecord(
#                     variable_name=iname, kind="local_decl",
#                     data_type=dtype, used_in_branch=branch_label,
#                     assigned_from=init,
#                 )
#                 self._enrich_body_record(br)
#                 self.branch_bodies.append(br)

#     def _record_condition(self, cond_node, branch_type: str, depth: int):
#         if cond_node is None:
#             return
#         variables = self.resolver.resolve(cond_node)
#         self.conditions.append(ConditionRecord(
#             condition_text=_safe_text(cond_node),
#             branch_type=branch_type,
#             nesting_depth=depth,
#             variables=variables,
#         ))

#     def _handle_assignment(self, node: lal.AssignStmt, branch_label: str):
#         lhs     = node.f_dest
#         rhs     = node.f_expr
#         lhs_txt = _safe_text(lhs)
#         rhs_txt = _safe_text(rhs)

#         # Resolve LHS type: semantic first, then registry
#         dtype = _semantic_type(lhs)
#         if dtype.get("type") in ("Unknown", "", None):
#             base_name = lhs_txt.split(".")[0]
#             if "." in lhs_txt:
#                 parts = lhs_txt.split(".", 1)
#                 fi    = self.reg.field_info(parts[0], parts[1])
#                 if fi["data_type"] != "Unknown":
#                     dtype = {"type": fi["data_type"]}
#             else:
#                 obj = self.reg.resolve(base_name)
#                 if obj:
#                     dtype = obj.data_type

#         br = BranchBodyRecord(
#             variable_name=lhs_txt, kind="assignment",
#             data_type=dtype, used_in_branch=branch_label,
#             assigned_from=rhs_txt,
#         )
#         self._enrich_body_record(br)
#         self.branch_bodies.append(br)

#         # Walk RHS and resolve each identifier found there
#         existing = {b.variable_name for b in self.branch_bodies}
#         rhs_vars = self.resolver.resolve(rhs)
#         for vname, vinfo in rhs_vars.items():
#             if vname in existing:
#                 continue
#             # Only add if the type is not Unknown OR it's a field/enum
#             vkind  = vinfo.get("kind", "unresolved")
#             vtype  = vinfo.get("data_type", {})
#             vtype_str = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)

#             if vtype_str == "Unknown" and vkind not in ("field", "enum_literal"):
#                 # Skip noise: type conversions (FL6, Double, Sqrt are in registry as types)
#                 te = self.reg.resolve_type(vname)
#                 if te is not None:
#                     continue   # it's a type name, not a variable reference

#             self.branch_bodies.append(BranchBodyRecord(
#                 variable_name=vname, kind=vkind if vkind != "unresolved" else "rhs_reference",
#                 data_type=vtype if isinstance(vtype, dict) else {"type": vtype_str},
#                 used_in_branch=branch_label,
#                 possible_values=vinfo.get("possible_values", []),
#                 value_count=vinfo.get("value_count", 0),
#             ))

#     def _handle_call_stmt(self, node: lal.CallStmt, branch_label: str):
#         call = node.f_call
#         try:
#             cname = _safe_text(getattr(call, "f_name", None)) or _safe_text(call)
#             dtype = _semantic_type(call)
#             args  = []
#             try:
#                 for p in call.f_suffix:
#                     args.append(_safe_text(p))
#             except Exception:
#                 pass
#             self.procedure_calls.append({
#                 "name":      cname,
#                 "data_type": dtype.get("type", "procedure")
#                              if dtype.get("type") != "Unknown" else "procedure",
#                 "args":      args,
#                 "called_in": branch_label,
#             })
#         except Exception:
#             pass

#     def _enrich_body_record(self, br: BranchBodyRecord):
#         base = br.data_type.get("type", "Unknown").split()[0] \
#                if isinstance(br.data_type, dict) else "Unknown"
#         te = self.reg.resolve_type(base)
#         if te and te.kind == "enum":
#             br.possible_values = te.enum_values
#             br.value_count     = len(te.enum_values)

#     @staticmethod
#     def _cond_to_dict(c: ConditionRecord) -> dict:
#         return {
#             "condition_text": c.condition_text,
#             "branch_type":    c.branch_type,
#             "nesting_depth":  c.nesting_depth,
#             "variables":      c.variables,
#         }

#     def _bodies_to_dict(self) -> dict:
#         out: dict = {}
#         for br in self.branch_bodies:
#             entry: dict = {
#                 "kind":           br.kind,
#                 "data_type":      br.data_type,
#                 "used_in_branch": br.used_in_branch,
#             }
#             if br.assigned_from:
#                 entry["assigned_from"] = br.assigned_from
#             if br.possible_values:
#                 entry["possible_values"] = br.possible_values
#                 entry["value_count"]     = br.value_count
#             out[br.variable_name] = entry
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 7 — TOP-LEVEL EXTRACTOR
# # ══════════════════════════════════════════════════════════════════

# class ControlFlowExtractor:
#     """
#     Main entry point.

#         units     = load_units("/path/to/project")   # MUST use load_units
#         extractor = ControlFlowExtractor(units)
#         report    = extractor.run()
#     """

#     def __init__(self, units: list):
#         self.units = units

#     def run(self) -> dict:
#         registry = TypeRegistry(self.units)
#         walker   = ControlFlowWalker(registry)
#         report: dict = {}

#         for unit in self.units:
#             if not unit.root:
#                 continue
#             # Only report .adb files (bodies contain executable code)
#             if not unit.filename.endswith(".adb"):
#                 continue

#             fname      = unit.filename
#             file_entry: dict = {}

#             for subp in unit.root.findall(lal.SubpBody):
#                 try:
#                     sname = (
#                         subp.f_subp_spec.f_subp_name.text
#                         if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                         else "UNKNOWN"
#                     )
#                 except Exception:
#                     sname = "UNKNOWN"

#                 result = walker.walk_subprogram(subp)

#                 # Debug info when nothing extracted
#                 if (not result["if_conditions"] and
#                         not result["branch_body_variables"] and
#                         not result["procedure_calls"]):
#                     raw = _get_stmts_from_subp(subp)
#                     result["_debug"] = {
#                         "stmt_count": len(raw),
#                         "stmt_kinds": [s.kind_name for s in raw[:10]],
#                         "hint": (
#                             "0 stmts — subp.f_body path failed; "
#                             "run debug_ast.py to inspect AST structure"
#                             if not raw else
#                             "Stmts found but no control-flow at top level"
#                         ),
#                     }

#                 file_entry[sname] = result

#             if file_entry:
#                 report[fname] = file_entry

#         report["__registry__"] = registry.to_dict()
#         return report


# # ══════════════════════════════════════════════════════════════════
# #  ENTRY POINT
# # ══════════════════════════════════════════════════════════════════

# if __name__ == "__main__":
#     import sys

#     project_path = sys.argv[1] if len(sys.argv) > 1 else "/your/project/path"
#     units  = load_units(project_path)
#     report = ControlFlowExtractor(units).run()
#     print(json.dumps(report, indent=4, default=str))





#*************************************
# TEST
#*************************************




# from __future__ import annotations
# import os, json
# from dataclasses import dataclass, field
# import libadalang as lal
# # from variables_analysis import VariablesAnalyzer 

# # ══════════════════════════════════════════════════════════════════
# #  SECTION 1 — PROJECT LOADER  (always load ALL files together)
# # ══════════════════════════════════════════════════════════════════
# path = "/home/ssss/Desktop/Libada_test_project/Rakshitha/src"

# def collect_ada_files(path: str) -> list[str]:
#     ada_files: list[str] = []
#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for f in files:
#                 if f.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, f))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")
#     return ada_files


# def load_units(project_path: str) -> list:
#     """
#     Load every .adb / .ads file into ONE shared AnalysisContext so that
#     p_type semantic resolution can cross file boundaries.
#     This is the CRITICAL step — all files must share the same context.
#     """
#     ctx       = lal.AnalysisContext(
#                     unit_provider=lal.UnitProvider.auto([project_path])
#                 )
#     ada_files = collect_ada_files(project_path)
#     units: list = []
#     for f in ada_files:
#         try:
#             unit = ctx.get_from_file(f)
#             if unit.root:
#                 units.append(unit)
#             if unit.diagnostics:
#                 for d in unit.diagnostics:
#                     print(f"[DIAG] {f}: {d}")
#         except Exception as e:
#             print(f"[WARN] Could not parse {f}: {e}")
#     print(f"[INFO] Loaded {len(units)} units from {project_path}")
#     return units


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 2 — SAFE AST HELPERS
# # ══════════════════════════════════════════════════════════════════

# #  TEST change

# def parse_type_expr(node):
#     """
#     Returns a structured dict like:
#       {"type": "UINT16", "range": "0 .. 255"}
#       {"type": "Boolean"}
#       {"type": "Integer"}
#     """
#     if node is None:
#         return {"type": "Unknown"}

#     text = node.text.strip() if node.text else ""

#     # SubtypeIndication: may have a constraint
#     if isinstance(node, lal.SubtypeIndication):
#         base = node.f_name.text.strip() if node.f_name else text
#         constraint = node.f_constraint

#         if constraint is not None:
#             # Range constraint: e.g. "range 0 .. 255"
#             if isinstance(constraint, lal.RangeConstraint):
#                 r = constraint.f_range
#                 range_text = r.text.strip() if r else ""
#                 # Strip leading "range " keyword if present
#                 if range_text.lower().startswith("range "):
#                     range_text = range_text[6:].strip()
#                 return {"type": base, "range": range_text}

#             # Digits constraint (fixed/float): e.g. "digits 6"
#             elif isinstance(constraint, lal.DigitsConstraint):
#                 digits = constraint.f_digits.text.strip() if constraint.f_digits else ""
#                 result = {"type": base, "digits": digits}
#                 if constraint.f_range:
#                     r_text = constraint.f_range.text.strip()
#                     if r_text.lower().startswith("range "):
#                         r_text = r_text[6:].strip()
#                     result["range"] = r_text
#                 return result

#             # Delta constraint (fixed point): e.g. "delta 0.001"
#             elif isinstance(constraint, lal.DeltaConstraint):
#                 delta = constraint.f_delta.text.strip() if constraint.f_delta else ""
#                 result = {"type": base, "delta": delta}
#                 if constraint.f_range:
#                     r_text = constraint.f_range.text.strip()
#                     if r_text.lower().startswith("range "):
#                         r_text = r_text[6:].strip()
#                     result["range"] = r_text
#                 return result

#             # Index constraint (array): e.g. "(0 .. 9)"
#             elif isinstance(constraint, lal.IndexConstraint):
#                 indices = [c.text.strip() for c in constraint.f_list if c.text]
#                 return {"type": base, "index_constraint": indices}

#             # Discriminant constraint
#             elif isinstance(constraint, lal.DiscriminantConstraint):
#                 assocs = [a.text.strip() for a in constraint.f_constraints if a.text]
#                 return {"type": base, "discriminant_constraint": assocs}

#         return {"type": base}

#     # AnonymousType wraps another type def
#     if isinstance(node, lal.AnonymousType):
#         if node.f_type_decl:
#             return parse_type_def_node(node.f_type_decl.f_type_def)
#         return {"type": text or "Unknown"}

#     # Fallback: return raw text as type name
#     if text:
#         return {"type": text}
#     return {"type": "Unknown"}


# def parse_type_def_node(tdef):
#     """
#     Parse a TypeDef node (not a type expression) into structured dict.
#     Used for anonymous array types and similar.
#     """
#     if tdef is None:
#         return {"type": "Unknown"}

#     if isinstance(tdef, lal.ArrayTypeDef):
#         try:
#             elem = parse_type_expr(tdef.f_component_type.f_type_expr)
#         except Exception:
#             elem = {"type": "Unknown"}
#         indices = []
#         try:
#             for idx in tdef.f_indices.f_list:
#                 indices.append(idx.text.strip())
#         except Exception:
#             pass
#         return {"type": "array", "element": elem, "indices": indices}

#     if isinstance(tdef, lal.RecordTypeDef):
#         return {"type": "record"}

#     return {"type": tdef.text.strip() if tdef.text else "Unknown"}


# # ---------------------------
# # Resolve a p_type result into a structured dict
# # ---------------------------
# def resolve_p_type(node):
#     """
#     Try libadalang semantic p_type resolution.
#     Returns structured dict or None on failure.
#     """
#     try:
#         typ = node.p_type
#         if typ is None:
#             return None

#         # Boolean / standard types
#         name = typ.p_defining_name
#         if name is None:
#             return None
#         base_name = name.text.strip()

#         # Try to get the type definition for range info
#         if hasattr(typ, 'f_type_def') and typ.f_type_def:
#             tdef = typ.f_type_def

#             if isinstance(tdef, lal.SignedIntTypeDef):
#                 try:
#                     r = tdef.f_range.f_range
#                     range_text = r.text.strip() if r else ""
#                     if range_text.lower().startswith("range "):
#                         range_text = range_text[6:].strip()
#                     if range_text:
#                         return {"type": base_name, "range": range_text}
#                 except Exception:
#                     pass
#                 return {"type": base_name}

#             if isinstance(tdef, lal.ModIntTypeDef):
#                 try:
#                     mod_val = tdef.f_expr.text.strip()
#                     return {"type": base_name, "modulus": mod_val}
#                 except Exception:
#                     return {"type": base_name}

#             if isinstance(tdef, lal.FloatingPointDef):
#                 try:
#                     digits = tdef.f_num_digits.text.strip()
#                     result = {"type": base_name, "digits": digits}
#                     if tdef.f_range:
#                         r_text = tdef.f_range.f_range.text.strip()
#                         result["range"] = r_text
#                     return result
#                 except Exception:
#                     return {"type": base_name}

#             if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#                 try:
#                     delta = tdef.f_delta.text.strip()
#                     result = {"type": base_name, "delta": delta}
#                     if tdef.f_range:
#                         r_text = tdef.f_range.f_range.text.strip()
#                         result["range"] = r_text
#                     return result
#                 except Exception:
#                     return {"type": base_name}

#             if isinstance(tdef, lal.ArrayTypeDef):
#                 return parse_type_def_node(tdef)

#         return {"type": base_name}
#     except Exception:
#         return None


# # ---------------------------
# # Master type resolver for an ObjectDecl / component node
# # ---------------------------
# def get_structured_type(node):
#     """
#     Try in order:
#       1. Semantic p_type resolution (most accurate, gives ranges)
#       2. Syntactic SubtypeIndication parse (gets inline constraints)
#       3. Raw text fallback
#     """
#     # 1. Semantic resolution
#     result = resolve_p_type(node)
#     if result and result.get("type") not in (None, "Unknown", ""):
#         return result

#     # 2. Syntactic: look at f_type_expr
#     try:
#         type_expr = node.f_type_expr
#         if type_expr:
#             parsed = parse_type_expr(type_expr)
#             if parsed.get("type") not in (None, "Unknown", ""):
#                 return parsed
#     except Exception:
#         pass

#     # 3. Raw text fallback
#     try:
#         if node.f_type_expr and node.f_type_expr.text:
#             return {"type": node.f_type_expr.text.strip()}
#     except Exception:
#         pass

#     return {"type": "Unknown"}

# #  TEST chnage  




# def _safe_text(node) -> str:
#     try:
#         return node.text.strip() if node and node.text else ""
#     except Exception:
#         return ""


# _STMT_KINDS = frozenset({
#     "IfStmt", "CaseStmt", "AssignStmt", "CallStmt",
#     "WhileLoopStmt", "ForLoopStmt", "LoopStmt",
#     "BlockStmt", "ReturnStmt", "NullStmt",
#     "ExitStmt", "GotoStmt", "ExtendedReturnStmt", "ObjectDecl",
# })


# def _get_stmts_from_subp(subp: lal.SubpBody) -> list:
#     """Try every known LAL path to get the executable statement list."""
#     # Path 1: f_body.f_stmts  (standard)
#     try:
#         body = subp.f_body
#         if body and hasattr(body, "f_stmts"):
#             stmts = list(body.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     # Path 2: findall(HandledStmts)
#     try:
#         for hs in subp.findall(lal.HandledStmts):
#             stmts = list(hs.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     # Path 3: f_stmts directly
#     try:
#         stmts = list(subp.f_stmts)
#         if stmts:
#             return stmts
#     except Exception:
#         pass
#     # Path 4: children scan
#     try:
#         for child in subp.children:
#             if child and child.kind_name == "HandledStmts":
#                 stmts = list(child.f_stmts)
#                 if stmts:
#                     return stmts
#             try:
#                 for gc in (child.children if child else []):
#                     if gc and gc.kind_name == "HandledStmts":
#                         stmts = list(gc.f_stmts)
#                         if stmts:
#                             return stmts
#             except Exception:
#                 pass
#     except Exception:
#         pass
#     # Path 5: brute-force collect statement-kind children
#     try:
#         stmts = [c for c in subp.children if c and c.kind_name in _STMT_KINDS]
#         if stmts:
#             return stmts
#     except Exception:
#         pass
#     return []


# def _iter_list(node, attr: str) -> list:
#     try:
#         val = getattr(node, attr, None)
#         return list(val) if val is not None else []
#     except Exception:
#         return []


# def _get_stmts_from_block(node) -> list:
#     for attr in ("f_stmts", "f_body"):
#         try:
#             val = getattr(node, attr, None)
#             if val is not None:
#                 stmts = list(val) if not hasattr(val, "f_stmts") else list(val.f_stmts)
#                 if stmts:
#                     return stmts
#         except Exception:
#             pass
#     try:
#         for hs in node.findall(lal.HandledStmts):
#             stmts = list(hs.f_stmts)
#             if stmts:
#                 return stmts
#     except Exception:
#         pass
#     return []


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 3 — TYPE RESOLUTION HELPERS
# # ══════════════════════════════════════════════════════════════════

# def _semantic_type(node) -> dict:
#     """
#     Ask libadalang for the semantic type of *node*.
#     Works across files when all units share one AnalysisContext.
#     """
#     try:
#         typ = node.p_type
#         if typ is None:
#             return {"type": "Unknown"}
#         base = _safe_text(typ.p_defining_name)
#         if not base:
#             return {"type": "Unknown"}
#         tdef = getattr(typ, "f_type_def", None)
#         if tdef is None:
#             return {"type": base}

#         if isinstance(tdef, lal.SignedIntTypeDef):
#             try:
#                 r = _safe_text(tdef.f_range.f_range)
#                 if r.lower().startswith("range "):
#                     r = r[6:].strip()
#                 return {"type": base, "range": r} if r else {"type": base}
#             except Exception:
#                 return {"type": base}
#         if isinstance(tdef, lal.ModIntTypeDef):
#             try:
#                 return {"type": base, "modulus": _safe_text(tdef.f_expr)}
#             except Exception:
#                 return {"type": base}
#         if isinstance(tdef, lal.FloatingPointDef):
#             try:
#                 res = {"type": base, "digits": _safe_text(tdef.f_num_digits)}
#                 if tdef.f_range:
#                     res["range"] = _safe_text(tdef.f_range.f_range)
#                 return res
#             except Exception:
#                 return {"type": base}
#         if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#             try:
#                 res = {"type": base, "delta": _safe_text(tdef.f_delta)}
#                 if tdef.f_range:
#                     res["range"] = _safe_text(tdef.f_range.f_range)
#                 return res
#             except Exception:
#                 return {"type": base}
#         return {"type": base}
#     except Exception:
#         return {"type": "Unknown"}


# def _parse_subtype_indication(node) -> dict:
#     if node is None:
#         return {"type": "Unknown"}
#     if not isinstance(node, lal.SubtypeIndication):
#         return {"type": _safe_text(node) or "Unknown"}
#     base = _safe_text(node.f_name)
#     c = node.f_constraint
#     if c is None:
#         return {"type": base}
#     if isinstance(c, lal.RangeConstraint):
#         r = _safe_text(c.f_range)
#         if r.lower().startswith("range "):
#             r = r[6:].strip()
#         return {"type": base, "range": r}
#     if isinstance(c, lal.DigitsConstraint):
#         res = {"type": base, "digits": _safe_text(c.f_digits)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     if isinstance(c, lal.DeltaConstraint):
#         res = {"type": base, "delta": _safe_text(c.f_delta)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     # if isinstance(c, lal.IndexConstraint):
#     if isinstance(c, lal.CompositeConstraint):
#     # if isinstance(c, (lal.UnconstrainedArrayIndex, lal.UnconstrainedArrayIndexList)):
#         return {"type": base, "index_constraint": [_safe_text(x) for x in c.f_list]}
#     return {"type": base}


# def _best_type(node) -> dict:
#     sem = _semantic_type(node)
#     if sem.get("type") not in ("Unknown", "", None):
#         return sem
#     try:
#         te = node.f_type_expr
#         if te:
#             p = _parse_subtype_indication(te)
#             if p.get("type") not in ("Unknown", "", None):
#                 return p
#     except Exception:
#         pass
#     try:
#         raw = _safe_text(node.f_type_expr)
#         if raw:
#             return {"type": raw}
#     except Exception:
#         pass
#     return {"type": "Unknown"}


# def _get_scope_name(node) -> str:
#     p = node.parent
#     while p:
#         if isinstance(p, lal.SubpBody):
#             try:
#                 return p.f_subp_spec.f_subp_name.text
#             except Exception:
#                 return "subprogram"
#         if isinstance(p, lal.PackageBody):
#             try:
#                 return f"package:{p.f_package_name.text}"
#             except Exception:
#                 return "package"
#         p = p.parent
#     return "global"


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 4 — TYPE REGISTRY  (cross-file, syntactic scan)
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class TypeEntry:
#     name: str
#     kind: str           # enum|record|integer|modular|array|subtype|float|fixed|other
#     declared_in: str
#     enum_values:   list[dict]    = field(default_factory=list)
#     record_fields: dict          = field(default_factory=dict)
#     range_str: str               = ""
#     modulus: str                 = ""
#     element_type: dict           = field(default_factory=dict)
#     indices: list[str]           = field(default_factory=list)
#     base_type: str               = ""
#     structured: dict             = field(default_factory=dict)
#     extra: dict                  = field(default_factory=dict)


# @dataclass
# class ObjectEntry:
#     name: str
#     kind: str           # variable|constant
#     data_type: dict
#     initial_value: str
#     declared_in: str
#     scope: str
#     possible_values: list[dict]  = field(default_factory=list)
#     value_count: int             = 0
#     range_str: str               = ""


# class TypeRegistry:
#     """
#     Single-pass syntactic scan over ALL units.
#     Provides cross-file lookup for types, objects, and enum literals.
#     Used as fallback when LAL semantic resolution returns Unknown.
#     """

#     def __init__(self, units: list):
#         self._types:    dict[str, TypeEntry]   = {}
#         self._objects:  dict[str, ObjectEntry] = {}
#         self._literals: dict[str, dict]        = {}

#         for unit in units:
#             if unit.root:
#                 self._scan_unit(unit)

#         # Second pass: enrich objects with enum / range from their type
#         for obj in self._objects.values():
#             self._enrich_object(obj)

#     # ── scan ──────────────────────────────────────────────────

#     def _scan_unit(self, unit):
#         fname = unit.filename
#         for td in unit.root.findall(lal.TypeDecl):
#             if td and td.f_name:
#                 self._register_type_decl(td, fname)
#         for st in unit.root.findall(lal.SubtypeDecl):
#             if st.f_name:
#                 self._register_subtype_decl(st, fname)
#         for obj in unit.root.findall(lal.ObjectDecl):
#             self._register_object_decl(obj, fname)

#     def _register_type_decl(self, td, fname: str):
#         tname = td.f_name.text.strip()
#         tdef  = td.f_type_def
#         entry = TypeEntry(name=tname, kind="other", declared_in=fname)
#         try:
#             if isinstance(tdef, lal.EnumTypeDef):
#                 entry.kind = "enum"
#                 for i, lit in enumerate(tdef.f_enum_literals):
#                     ln = _safe_text(lit)
#                     entry.enum_values.append({"value": ln, "position": i})
#                     self._literals[ln] = {
#                         "kind": "enum_literal", "data_type": tname,
#                         "parent_type": tname, "value": ln,
#                         "position": i, "declared_in": fname,
#                         "all_values": [],   # filled in post-pass below
#                     }
#             elif isinstance(tdef, lal.RecordTypeDef):
#                 entry.kind = "record"
#                 for comp in tdef.findall(lal.ComponentDecl):
#                     if not comp.f_component_def:
#                         continue
#                     fr = _safe_text(comp.f_component_def.f_type_expr)
#                     fs = _best_type(comp.f_component_def)
#                     for n in comp.f_ids:
#                         entry.record_fields[n.text.strip()] = {
#                             "raw_type": fr, "structured_type": fs, "declared_in": fname,
#                         }
#             elif isinstance(tdef, lal.SignedIntTypeDef):
#                 entry.kind = "integer"
#                 try:
#                     r = _safe_text(tdef.f_range.f_range)
#                     if r.lower().startswith("range "):
#                         r = r[6:].strip()
#                     entry.range_str = r
#                 except Exception:
#                     pass
#             elif isinstance(tdef, lal.ModIntTypeDef):
#                 entry.kind    = "modular"
#                 entry.modulus = _safe_text(tdef.f_expr)
#             elif isinstance(tdef, lal.ArrayTypeDef):
#                 entry.kind = "array"
#                 try:
#                     entry.element_type = _parse_subtype_indication(
#                         tdef.f_component_type.f_type_expr)
#                 except Exception:
#                     entry.element_type = {"type": "Unknown"}
#                 try:
#                     entry.indices = [_safe_text(i) for i in tdef.f_indices.f_list]
#                 except Exception:
#                     pass
#             elif isinstance(tdef, lal.FloatingPointDef):
#                 entry.kind = "float"
#                 try:
#                     entry.extra["digits"] = _safe_text(tdef.f_num_digits)
#                 except Exception:
#                     pass
#             elif isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
#                 entry.kind = "fixed"
#                 try:
#                     entry.extra["delta"] = _safe_text(tdef.f_delta)
#                 except Exception:
#                     pass
#         except Exception as e:
#             entry.extra["error"] = str(e)
#         self._types[tname] = entry

#         # Backfill all_values for enum literals of this type
#         if entry.kind == "enum":
#             for lit_info in self._literals.values():
#                 if lit_info.get("parent_type") == tname:
#                     lit_info["all_values"] = entry.enum_values

#     def _register_subtype_decl(self, st, fname: str):
#         sname    = st.f_name.text.strip()
#         raw_node = getattr(st, "f_subtype", None) or getattr(st, "f_type_expr", None)
#         parsed   = _parse_subtype_indication(raw_node) if raw_node else {"type": "Unknown"}
#         base     = parsed.get("type", "Unknown").split()[0]
#         entry    = TypeEntry(name=sname, kind="subtype", declared_in=fname,
#                              base_type=base, structured=parsed)
#         parent   = self._types.get(base)
#         if parent and parent.kind == "enum":
#             entry.enum_values = parent.enum_values[:]
#         self._types[sname] = entry

#     def _register_object_decl(self, obj, fname: str):
#         is_const = False
#         try:
#             is_const = obj.f_has_constant.kind_name == "ConstantPresent"
#         except Exception:
#             pass
#         init_val = ""
#         try:
#             if obj.f_default_expr:
#                 init_val = _safe_text(obj.f_default_expr)
#         except Exception:
#             pass
#         dtype = _best_type(obj)
#         scope = _get_scope_name(obj)
#         for ident in obj.f_ids:
#             iname = ident.text.strip()
#             self._objects[iname] = ObjectEntry(
#                 name=iname, kind="constant" if is_const else "variable",
#                 data_type=dtype, initial_value=init_val,
#                 declared_in=fname, scope=scope,
#             )

#     def _enrich_object(self, obj: ObjectEntry):
#         base = obj.data_type.get("type", "Unknown").split()[0]
#         te   = self._resolve_type_chain(base)
#         if te is None:
#             return
#         if te.kind == "enum":
#             obj.possible_values = te.enum_values
#             obj.value_count     = len(te.enum_values)
#         elif te.kind in ("integer", "modular"):
#             obj.range_str = te.range_str or te.modulus
#         elif te.kind == "record":
#             pass  # fields already stored in type entry

#     def _resolve_type_chain(self, name: str, depth: int = 0) -> TypeEntry | None:
#         """Follow subtype/alias chain up to 10 levels."""
#         if not name or depth > 10:
#             return None
#         te = self._types.get(name)
#         if te is None:
#             return None
#         if te.kind == "subtype" and te.base_type and te.base_type != name:
#             parent = self._resolve_type_chain(te.base_type, depth + 1)
#             if parent:
#                 # inherit enum values
#                 if parent.kind == "enum" and not te.enum_values:
#                     te.enum_values  = parent.enum_values[:]
#                 return parent
#         return te

#     # ── public API ──────────────────────────────────────────────

#     def resolve(self, name: str) -> ObjectEntry | None:
#         return self._objects.get(name)

#     def resolve_type(self, name: str) -> TypeEntry | None:
#         return self._resolve_type_chain(name)

#     def enum_literal(self, name: str) -> dict | None:
#         return self._literals.get(name)

#     def field_info(self, object_name: str, field_name: str) -> dict:
#         """
#         Full resolution for Odata.QuatStatus:
#           Odata → its type → record fields → QuatStatus → QuatStatus's type → enum values
#         """
#         result: dict = {
#             "kind": "field", "parent_object": object_name,
#             "field_name": field_name, "data_type": "Unknown",
#             "declared_in": "Unknown", "possible_values": [], "value_count": 0,
#         }
#         obj = self._objects.get(object_name)
#         if obj is None:
#             return result

#         obj_type_name = obj.data_type.get("type", "Unknown").split()[0]
#         te = self._resolve_type_chain(obj_type_name)
#         if te is None or te.kind != "record":
#             return result

#         # Case-insensitive field lookup
#         finfo = te.record_fields.get(field_name)
#         if finfo is None:
#             for fn, fv in te.record_fields.items():
#                 if fn.lower() == field_name.lower():
#                     finfo = fv
#                     break
#         if finfo is None:
#             return result

#         raw    = finfo.get("raw_type", "Unknown")
#         struct = finfo.get("structured_type", {"type": raw})
#         base_ft= struct.get("type", raw).split()[0]

#         result["data_type"]       = raw
#         result["structured_type"] = struct
#         result["declared_in"]     = finfo.get("declared_in", "Unknown")

#         # Resolve field's type for enum values / range
#         ft = self._resolve_type_chain(base_ft)
#         if ft:
#             if ft.kind == "enum":
#                 result["possible_values"] = ft.enum_values
#                 result["value_count"]     = len(ft.enum_values)
#             elif ft.kind in ("integer", "modular"):
#                 result["range"] = ft.range_str or ft.modulus
#             elif ft.kind == "subtype":
#                 result["subtype_of"] = ft.base_type
#                 vals = ft.enum_values
#                 if not vals:
#                     grandparent = self._resolve_type_chain(ft.base_type)
#                     if grandparent and grandparent.kind == "enum":
#                         vals = grandparent.enum_values
#                 result["possible_values"] = vals
#                 result["value_count"]     = len(vals)
#         elif "range" in struct:
#             result["range"] = struct["range"]

#         return result

#     def to_dict(self) -> dict:
#         out: dict = {"types": {}, "objects": {}, "enum_literals": self._literals}
#         for k, v in self._types.items():
#             out["types"][k] = v.__dict__
#         for k, v in self._objects.items():
#             out["objects"][k] = v.__dict__
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 5 — EXPRESSION RESOLVER
# #  Resolves every identifier in an expression to its full type info.
# #  Resolution order: semantic p_type → registry lookup → fallback
# # ══════════════════════════════════════════════════════════════════

# # Standard Ada identifiers we don't want to report as "unknown"
# _BUILTIN_TYPES = frozenset({
#     "Boolean", "Integer", "Float", "Duration", "Character",
#     "String", "Natural", "Positive", "Long_Integer", "Long_Float",
#     "Short_Integer", "Short_Float", "Wide_Character",
#     "True", "False",
# })

# _BUILTIN_MAP = {
#     "True":  {"kind": "enum_literal", "data_type": "Boolean",
#               "parent_type": "Boolean", "value": "True",
#               "all_values": [{"value": "False", "position": 0},
#                              {"value": "True",  "position": 1}]},
#     "False": {"kind": "enum_literal", "data_type": "Boolean",
#               "parent_type": "Boolean", "value": "False",
#               "all_values": [{"value": "False", "position": 0},
#                              {"value": "True",  "position": 1}]},
# }


# class ExpressionResolver:

#     def __init__(self, registry: TypeRegistry):
#         self.reg = registry

#     def resolve(self, node) -> dict[str, dict]:
#         found: dict[str, dict] = {}
#         self._walk(node, found)
#         return found

#     # ── AST walker ────────────────────────────────────────────

#     def _walk(self, node, found: dict):
#         if node is None:
#             return
#         if isinstance(node, lal.ParenExpr):
#             self._walk(node.f_expr, found)
#         elif isinstance(node, lal.DottedName):
#             self._handle_dotted(node, found)
#         elif isinstance(node, lal.CallExpr):
#             self._handle_call(node, found)
#         elif isinstance(node, (lal.BinOp, lal.RelationOp,
#                                 lal.MembershipExpr, lal.OpAndThen, lal.OpOrElse)):
#             self._walk(node.f_left,  found)
#             self._walk(node.f_right, found)
#         elif isinstance(node, lal.UnOp):
#             self._walk(node.f_expr, found)
#         elif isinstance(node, lal.AttributeRef):
#             self._walk(node.f_prefix, found)
#             try:
#                 for arg in node.f_args:
#                     self._walk(arg, found)
#             except Exception:
#                 pass
#         elif isinstance(node, lal.QualExpr):
#             self._walk(node.f_suffix, found)
#         elif isinstance(node, lal.IfExpr):
#             self._walk(node.f_cond_expr, found)
#             self._walk(node.f_then_expr, found)
#             for alt in node.f_alternatives:
#                 self._walk(alt.f_cond_expr, found)
#                 self._walk(alt.f_then_expr, found)
#             self._walk(node.f_else_expr, found)
#         elif isinstance(node, lal.CaseExpr):
#             self._walk(node.f_expr, found)
#             for alt in node.f_cases:
#                 self._walk(alt.f_expr, found)
#         elif isinstance(node, lal.Aggregate):
#             try:
#                 for assoc in node.f_assocs:
#                     self._walk(assoc.f_r_expr, found)
#             except Exception:
#                 pass
#         elif isinstance(node, lal.Identifier):
#             self._handle_identifier(node, found)
#         else:
#             try:
#                 for child in node.children:
#                     self._walk(child, found)
#             except Exception:
#                 pass

#     # ── DottedName: Odata.QuatStatus ──────────────────────────

#     def _handle_dotted(self, node: lal.DottedName, found: dict):
#         prefix_text = _safe_text(node.f_prefix)
#         suffix_text = _safe_text(node.f_suffix)
#         full_text   = _safe_text(node)

#         # ① Full dotted name  (Odata.QuatStatus)
#         if full_text and full_text not in found:
#             # Try registry field resolution first (syntactic, always works)
#             fi  = self.reg.field_info(prefix_text, suffix_text)
#             # Also try semantic type on the full node
#             sem = _semantic_type(node)
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"]     = sem["type"]
#                 fi["semantic_type"] = sem
#                 # Now try to enrich with enum values using the semantic type
#                 te = self.reg.resolve_type(sem["type"])
#                 if te and te.kind == "enum":
#                     fi["possible_values"] = te.enum_values
#                     fi["value_count"]     = len(te.enum_values)
#             found[full_text] = fi

#         # ② Prefix object  (Odata)
#         if prefix_text and prefix_text not in found:
#             found[prefix_text] = self._resolve_name(node.f_prefix, prefix_text)

#         # ③ Suffix field  (QuatStatus) — standalone with parent_object annotation
#         if suffix_text and suffix_text not in found:
#             fi  = self.reg.field_info(prefix_text, suffix_text)
#             sem = _semantic_type(node.f_suffix) if node.f_suffix else {"type": "Unknown"}
#             if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
#                 fi["data_type"] = sem["type"]
#                 # Enrich with enum values
#                 te = self.reg.resolve_type(sem["type"])
#                 if te and te.kind == "enum":
#                     fi["possible_values"] = te.enum_values
#                     fi["value_count"]     = len(te.enum_values)
#             fi["parent_object"] = prefix_text
#             found[suffix_text]  = fi

#     # ── CallExpr: Sqrt(...), FL6(...) ─────────────────────────

#     def _handle_call(self, node: lal.CallExpr, found: dict):
#         try:
#             cname = _safe_text(node.f_name)
#             # Type conversions like FL6(...) or Double(...) — skip as noise
#             # but DO walk their arguments to capture inner identifiers
#             try:
#                 for p in node.f_suffix:
#                     self._walk(p, found)
#             except Exception:
#                 pass
#             # Only record if it looks like a real procedure/function call
#             # (i.e. name is not a known type from registry)
#             if cname and cname not in found:
#                 te = self.reg.resolve_type(cname)
#                 if te is None:  # not a type conversion — it's a real call
#                     dtype = _semantic_type(node)
#                     found[cname] = {
#                         "kind":      "call",
#                         "data_type": dtype if dtype.get("type") != "Unknown"
#                                      else {"type": "procedure"},
#                         "args": [_safe_text(p) for p in node.f_suffix],
#                     }
#         except Exception:
#             pass

#     # ── Plain Identifier: QCOMPUTED_AND_OK ───────────────────

#     def _handle_identifier(self, node: lal.Identifier, found: dict):
#         name = _safe_text(node)
#         if not name or name in found:
#             return
#         found[name] = self._resolve_name(node, name)

#     # ── Master resolver ───────────────────────────────────────

#     def _resolve_name(self, node, name: str) -> dict:
#         """
#         Resolution order:
#           1. Built-in (True, False)
#           2. Enum literal registry   → parent type + all sibling values
#           3. Object registry         → data_type, scope, declared_in
#           4. Semantic p_type         → works cross-file when context is shared
#           5. Type name reference     → type is used as a value (e.g. type conversion)
#           6. Fallback
#         """

#         # 1. Built-ins
#         if name in _BUILTIN_MAP:
#             return dict(_BUILTIN_MAP[name])

#         # 2. Enum literal  (QCOMPUTED_AND_OK)
#         lit = self.reg.enum_literal(name)
#         if lit:
#             rec = dict(lit)
#             # Ensure all sibling values are included
#             if not rec.get("all_values"):
#                 te = self.reg.resolve_type(lit.get("parent_type", ""))
#                 if te and te.kind == "enum":
#                     rec["all_values"] = te.enum_values
#             return rec

#         # 3. Object registry  (Odata, LatestQuaternion, ...)
#         obj = self.reg.resolve(name)
#         if obj:
#             rec: dict = {
#                 "kind":        obj.kind,
#                 "data_type":   obj.data_type,
#                 "declared_in": obj.declared_in,
#                 "scope":       obj.scope,
#             }
#             if obj.initial_value:
#                 rec["initial_value"] = obj.initial_value
#             if obj.possible_values:
#                 rec["possible_values"] = obj.possible_values
#                 rec["value_count"]     = obj.value_count
#             if obj.range_str:
#                 rec["range"] = obj.range_str
#             # Try semantic type to enrich data_type if it's Unknown
#             if obj.data_type.get("type") in ("Unknown", "", None) and node is not None:
#                 sem = _semantic_type(node)
#                 if sem.get("type") not in ("Unknown", "", None):
#                     rec["data_type"] = sem
#                     # re-enrich with enum values if type changed
#                     te = self.reg.resolve_type(sem["type"])
#                     if te and te.kind == "enum":
#                         rec["possible_values"] = te.enum_values
#                         rec["value_count"]     = len(te.enum_values)
#             return rec

#         # 4. Semantic p_type (cross-file, requires shared AnalysisContext)
#         if node is not None:
#             sem = _semantic_type(node)
#             if sem.get("type") not in ("Unknown", "", None):
#                 rec = {"kind": "identifier", "data_type": sem}
#                 te  = self.reg.resolve_type(sem["type"])
#                 if te:
#                     if te.kind == "enum":
#                         rec["possible_values"] = te.enum_values
#                         rec["value_count"]     = len(te.enum_values)
#                     elif te.kind in ("integer", "modular"):
#                         rec["range"] = te.range_str or te.modulus
#                     elif te.kind == "record":
#                         rec["record_fields"] = list(te.record_fields.keys())
#                 return rec

#         # 5. Type name reference  (e.g. FL6 used as type conversion)
#         te = self.reg.resolve_type(name)
#         if te:
#             rec = {"kind": "type_conversion", "data_type": {"type": name}}
#             if te.kind == "enum":
#                 rec["possible_values"] = te.enum_values
#                 rec["value_count"]     = len(te.enum_values)
#             elif te.kind == "record":
#                 rec["record_fields"] = list(te.record_fields.keys())
#             return rec

#         # 6. Fallback
#         return {"kind": "unresolved", "data_type": {"type": "Unknown"}}


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 6 — CONTROL FLOW WALKER
# # ══════════════════════════════════════════════════════════════════

# @dataclass
# class ConditionRecord:
#     condition_text: str
#     branch_type: str       # if|elsif|while|for|case_expr|case_choice
#     nesting_depth: int
#     variables: dict[str, dict]


# @dataclass
# class BranchBodyRecord:
#     variable_name: str
#     kind: str              # assignment|rhs_reference|local_decl|call
#     data_type: dict
#     used_in_branch: str
#     assigned_from: str    = ""
#     possible_values: list = field(default_factory=list)
#     value_count: int      = 0


# class ControlFlowWalker:

#     def __init__(self, registry: TypeRegistry):
#         self.reg      = registry
#         self.resolver = ExpressionResolver(registry)

#     def walk_subprogram(self, subp: lal.SubpBody) -> dict:
#         self.conditions:      list[ConditionRecord]  = []
#         self.branch_bodies:   list[BranchBodyRecord] = []
#         self.procedure_calls: list[dict]             = []

#         stmts = _get_stmts_from_subp(subp)
#         self._walk_stmts(stmts, depth=0, branch_label="")

#         return {
#             "if_conditions":         [self._cond_to_dict(c) for c in self.conditions],
#             "branch_body_variables": self._bodies_to_dict(),
#             "procedure_calls":       self.procedure_calls,
#         }

#     def _walk_stmts(self, stmts: list, depth: int, branch_label: str):
#         for stmt in stmts:
#             self._walk_stmt(stmt, depth, branch_label)

#     def _walk_stmt(self, node, depth: int, branch_label: str):
#         if node is None:
#             return
#         kind = node.kind_name

#         if kind == "IfStmt":
#             cond = node.f_cond_expr
#             if isinstance(cond, lal.ParenExpr):
#                 cond = cond.f_expr
#             self._record_condition(cond, "if", depth)
#             self._walk_stmts(_iter_list(node, "f_then_stmts"), depth + 1, "then")
#             for part in _iter_list(node, "f_alternatives"):
#                 ec = getattr(part, "f_cond_expr", None)
#                 if isinstance(ec, lal.ParenExpr):
#                     ec = ec.f_expr
#                 self._record_condition(ec, "elsif", depth)
#                 self._walk_stmts(_iter_list(part, "f_stmts"), depth + 1, "elsif")
#             self._walk_stmts(_iter_list(node, "f_else_stmts"), depth + 1, "else")

#         elif kind == "CaseStmt":
#             self._record_condition(node.f_expr, "case_expr", depth)
#             for alt in _iter_list(node, "f_alternatives"):
#                 for choice in _iter_list(alt, "f_choices"):
#                     vars_c = self.resolver.resolve(choice)
#                     if vars_c:
#                         self.conditions.append(ConditionRecord(
#                             condition_text=_safe_text(choice),
#                             branch_type="case_choice",
#                             nesting_depth=depth,
#                             variables=vars_c,
#                         ))
#                 self._walk_stmts(_iter_list(alt, "f_stmts"), depth + 1, "case_body")

#         elif kind == "WhileLoopStmt":
#             try:
#                 self._record_condition(node.f_spec.f_expr, "while", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "ForLoopStmt":
#             try:
#                 spec = node.f_spec
#                 if hasattr(spec, "f_iter_expr") and spec.f_iter_expr:
#                     self._record_condition(spec.f_iter_expr, "for", depth)
#             except Exception:
#                 pass
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "LoopStmt":
#             self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

#         elif kind == "BlockStmt":
#             self._walk_stmts(_get_stmts_from_block(node), depth + 1, branch_label)

#         elif kind == "AssignStmt":
#             self._handle_assignment(node, branch_label)

#         elif kind == "CallStmt":
#             self._handle_call_stmt(node, branch_label)

#         elif kind == "ReturnStmt":
#             try:
#                 if node.f_return_expr:
#                     self._record_condition(node.f_return_expr, "return_expr", depth)
#             except Exception:
#                 pass

#         elif kind == "ObjectDecl":
#             dtype = _best_type(node)
#             for ident in node.f_ids:
#                 iname = ident.text.strip()
#                 init  = _safe_text(node.f_default_expr) if node.f_default_expr else ""
#                 br    = BranchBodyRecord(
#                     variable_name=iname, kind="local_decl",
#                     data_type=dtype, used_in_branch=branch_label,
#                     assigned_from=init,
#                 )
#                 self._enrich_body_record(br)
#                 self.branch_bodies.append(br)

#     def _record_condition(self, cond_node, branch_type: str, depth: int):
#         if cond_node is None:
#             return
#         variables = self.resolver.resolve(cond_node)
#         self.conditions.append(ConditionRecord(
#             condition_text=_safe_text(cond_node),
#             branch_type=branch_type,
#             nesting_depth=depth,
#             variables=variables,
#         ))

#     def _handle_assignment(self, node: lal.AssignStmt, branch_label: str):
#         lhs     = node.f_dest
#         rhs     = node.f_expr
#         lhs_txt = _safe_text(lhs)
#         rhs_txt = _safe_text(rhs)

#         # Resolve LHS type: semantic first, then registry
#         dtype = _semantic_type(lhs)
#         if dtype.get("type") in ("Unknown", "", None):
#             base_name = lhs_txt.split(".")[0]
#             if "." in lhs_txt:
#                 parts = lhs_txt.split(".", 1)
#                 fi    = self.reg.field_info(parts[0], parts[1])
#                 if fi["data_type"] != "Unknown":
#                     dtype = {"type": fi["data_type"]}
#             else:
#                 obj = self.reg.resolve(base_name)
#                 if obj:
#                     dtype = obj.data_type

#         br = BranchBodyRecord(
#             variable_name=lhs_txt, kind="assignment",
#             data_type=dtype, used_in_branch=branch_label,
#             assigned_from=rhs_txt,
#         )
#         self._enrich_body_record(br)
#         self.branch_bodies.append(br)

#         # Walk RHS and resolve each identifier found there
#         existing = {b.variable_name for b in self.branch_bodies}
#         rhs_vars = self.resolver.resolve(rhs)
#         for vname, vinfo in rhs_vars.items():
#             if vname in existing:
#                 continue
#             # Only add if the type is not Unknown OR it's a field/enum
#             vkind  = vinfo.get("kind", "unresolved")
#             vtype  = vinfo.get("data_type", {})
#             vtype_str = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)

#             if vtype_str == "Unknown" and vkind not in ("field", "enum_literal"):
#                 # Skip noise: type conversions (FL6, Double, Sqrt are in registry as types)
#                 te = self.reg.resolve_type(vname)
#                 if te is not None:
#                     continue   # it's a type name, not a variable reference

#             self.branch_bodies.append(BranchBodyRecord(
#                 variable_name=vname, kind=vkind if vkind != "unresolved" else "rhs_reference",
#                 data_type=vtype if isinstance(vtype, dict) else {"type": vtype_str},
#                 used_in_branch=branch_label,
#                 possible_values=vinfo.get("possible_values", []),
#                 value_count=vinfo.get("value_count", 0),
#             ))

#     def _handle_call_stmt(self, node: lal.CallStmt, branch_label: str):
#         call = node.f_call
#         try:
#             cname = _safe_text(getattr(call, "f_name", None)) or _safe_text(call)
#             dtype = _semantic_type(call)
#             args  = []
#             try:
#                 for p in call.f_suffix:
#                     args.append(_safe_text(p))
#             except Exception:
#                 pass
#             self.procedure_calls.append({
#                 "name":      cname,
#                 "data_type": dtype.get("type", "procedure")
#                              if dtype.get("type") != "Unknown" else "procedure",
#                 "args":      args,
#                 "called_in": branch_label,
#             })
#         except Exception:
#             pass

#     def _enrich_body_record(self, br: BranchBodyRecord):
#         base = br.data_type.get("type", "Unknown").split()[0] \
#                if isinstance(br.data_type, dict) else "Unknown"
#         te = self.reg.resolve_type(base)
#         if te and te.kind == "enum":
#             br.possible_values = te.enum_values
#             br.value_count     = len(te.enum_values)

#     @staticmethod
#     def _cond_to_dict(c: ConditionRecord) -> dict:
#         return {
#             "condition_text": c.condition_text,
#             "branch_type":    c.branch_type,
#             "nesting_depth":  c.nesting_depth,
#             "variables":      c.variables,
#         }

#     def _bodies_to_dict(self) -> dict:
#         out: dict = {}
#         for br in self.branch_bodies:
#             entry: dict = {
#                 "kind":           br.kind,
#                 "data_type":      br.data_type,
#                 "used_in_branch": br.used_in_branch,
#             }
#             if br.assigned_from:
#                 entry["assigned_from"] = br.assigned_from
#             if br.possible_values:
#                 entry["possible_values"] = br.possible_values
#                 entry["value_count"]     = br.value_count
#             out[br.variable_name] = entry
#         return out


# # ══════════════════════════════════════════════════════════════════
# #  SECTION 7 — TOP-LEVEL EXTRACTOR
# # ══════════════════════════════════════════════════════════════════

# class ControlFlowExtractor:
#     """
#     Main entry point.

#         units     = load_units("/path/to/project")   # MUST use load_units
#         extractor = ControlFlowExtractor(units)
#         report    = extractor.run()
#     """

#     def __init__(self, units: list):
#         self.units = units

#     def run(self) -> dict:
#         registry = TypeRegistry(self.units)
#         walker   = ControlFlowWalker(registry)
#         report: dict = {}

#         for unit in self.units:
#             if not unit.root:
#                 continue
#             # Only report .adb files (bodies contain executable code)
#             if not unit.filename.endswith(".adb"):
#                 continue

#             fname      = unit.filename
#             file_entry: dict = {}

#             for subp in unit.root.findall(lal.SubpBody):
#                 try:
#                     sname = (
#                         subp.f_subp_spec.f_subp_name.text
#                         if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                         else "UNKNOWN"
#                     )
#                 except Exception:
#                     sname = "UNKNOWN"

#                 result = walker.walk_subprogram(subp)

#                 # Debug info when nothing extracted
#                 if (not result["if_conditions"] and
#                         not result["branch_body_variables"] and
#                         not result["procedure_calls"]):
#                     raw = _get_stmts_from_subp(subp)
#                     result["_debug"] = {
#                         "stmt_count": len(raw),
#                         "stmt_kinds": [s.kind_name for s in raw[:10]],
#                         "hint": (
#                             "0 stmts — subp.f_body path failed; "
#                             "run debug_ast.py to inspect AST structure"
#                             if not raw else
#                             "Stmts found but no control-flow at top level"
#                         ),
#                     }

#                 file_entry[sname] = result

#             if file_entry:
#                 report[fname] = file_entry

#         report["__registry__"] = registry.to_dict()
#         return report


# # ══════════════════════════════════════════════════════════════════
# #  ENTRY POINT
# # ══════════════════════════════════════════════════════════════════

# if __name__ == "__main__":
#     import sys

#     project_path = sys.argv[1] if len(sys.argv) > 1 else "/home/ssss/Desktop/Libada_test_project/Rakshitha/src"
#     units  = load_units(project_path)
#     report = ControlFlowExtractor(units).run()
#     print(json.dumps(report, indent=4, default=str))



# TEST





from __future__ import annotations
import os, json
from dataclasses import dataclass, field
import libadalang as lal
# from variables_analysis import VariablesAnalyzer 

# ══════════════════════════════════════════════════════════════════
#  SECTION 1 — PROJECT LOADER  (always load ALL files together)
# ══════════════════════════════════════════════════════════════════
path = "/home/ssss/Desktop/Libada_test_project/Rakshitha/src"

def collect_ada_files(path: str) -> list[str]:
    ada_files: list[str] = []
    if os.path.isfile(path):
        if path.endswith((".adb", ".ads")):
            ada_files.append(path)
    elif os.path.isdir(path):
        for root, _, files in os.walk(path):
            for f in files:
                if f.endswith((".adb", ".ads")):
                    ada_files.append(os.path.join(root, f))
    else:
        raise FileNotFoundError(f"Invalid path: {path}")
    return ada_files


def load_units(project_path: str) -> list:
    """
    Load every .adb / .ads file into ONE shared AnalysisContext so that
    p_type semantic resolution can cross file boundaries.
    This is the CRITICAL step — all files must share the same context.
    """
    ctx       = lal.AnalysisContext(
                    unit_provider=lal.UnitProvider.auto([project_path])
                )
    ada_files = collect_ada_files(project_path)
    units: list = []
    for f in ada_files:
        try:
            unit = ctx.get_from_file(f)
            if unit.root:
                units.append(unit)
            if unit.diagnostics:
                for d in unit.diagnostics:
                    print(f"[DIAG] {f}: {d}")
        except Exception as e:
            print(f"[WARN] Could not parse {f}: {e}")
    print(f"[INFO] Loaded {len(units)} units from {project_path}")
    return units


# ══════════════════════════════════════════════════════════════════
#  SECTION 2 — SAFE AST HELPERS
# ══════════════════════════════════════════════════════════════════

#  TEST change

def parse_type_expr(node):
    """
    Returns a structured dict like:
      {"type": "UINT16", "range": "0 .. 255"}
      {"type": "Boolean"}
      {"type": "Integer"}
    """
    if node is None:
        return {"type": "Unknown"}

    text = node.text.strip() if node.text else ""

    # SubtypeIndication: may have a constraint
    if isinstance(node, lal.SubtypeIndication):
        base = node.f_name.text.strip() if node.f_name else text
        constraint = node.f_constraint

        if constraint is not None:
            # Range constraint: e.g. "range 0 .. 255"
            if isinstance(constraint, lal.RangeConstraint):
                r = constraint.f_range
                range_text = r.text.strip() if r else ""
                # Strip leading "range " keyword if present
                if range_text.lower().startswith("range "):
                    range_text = range_text[6:].strip()
                return {"type": base, "range": range_text}

            # Digits constraint (fixed/float): e.g. "digits 6"
            elif isinstance(constraint, lal.DigitsConstraint):
                digits = constraint.f_digits.text.strip() if constraint.f_digits else ""
                result = {"type": base, "digits": digits}
                if constraint.f_range:
                    r_text = constraint.f_range.text.strip()
                    if r_text.lower().startswith("range "):
                        r_text = r_text[6:].strip()
                    result["range"] = r_text
                return result

            # Delta constraint (fixed point): e.g. "delta 0.001"
            elif isinstance(constraint, lal.DeltaConstraint):
                delta = constraint.f_delta.text.strip() if constraint.f_delta else ""
                result = {"type": base, "delta": delta}
                if constraint.f_range:
                    r_text = constraint.f_range.text.strip()
                    if r_text.lower().startswith("range "):
                        r_text = r_text[6:].strip()
                    result["range"] = r_text
                return result

            # Index constraint (array): e.g. "(0 .. 9)"
            elif isinstance(constraint, lal.IndexConstraint):
                indices = [c.text.strip() for c in constraint.f_list if c.text]
                return {"type": base, "index_constraint": indices}

            # Discriminant constraint
            elif isinstance(constraint, lal.DiscriminantConstraint):
                assocs = [a.text.strip() for a in constraint.f_constraints if a.text]
                return {"type": base, "discriminant_constraint": assocs}

        return {"type": base}

    # AnonymousType wraps another type def
    if isinstance(node, lal.AnonymousType):
        if node.f_type_decl:
            return parse_type_def_node(node.f_type_decl.f_type_def)
        return {"type": text or "Unknown"}

    # Fallback: return raw text as type name
    if text:
        return {"type": text}
    return {"type": "Unknown"}


def parse_type_def_node(tdef):
    """
    Parse a TypeDef node (not a type expression) into structured dict.
    Used for anonymous array types and similar.
    """
    if tdef is None:
        return {"type": "Unknown"}

    if isinstance(tdef, lal.ArrayTypeDef):
        try:
            elem = parse_type_expr(tdef.f_component_type.f_type_expr)
        except Exception:
            elem = {"type": "Unknown"}
        indices = []
        try:
            # for idx in tdef.f_indices.f_list:
                # indices.append(idx.text.strip())
            for idx in getattr(tdef.f_indices, "children", []):
                txt = _safe_text(idx)
                if txt:
                    indices.append(txt)
                
        except Exception:
            pass
        return {"type": "array", "element": elem, "indices": indices}

    if isinstance(tdef, lal.RecordTypeDef):
        return {"type": "record"}

    return {"type": tdef.text.strip() if tdef.text else "Unknown"}


# ---------------------------
# Resolve a p_type result into a structured dict
# ---------------------------
def resolve_p_type(node):
    """
    Try libadalang semantic p_type resolution.
    Returns structured dict or None on failure.
    """
    try:
        typ = node.p_type
        if typ is None:
            return None

        # Boolean / standard types
        name = typ.p_defining_name
        if name is None:
            return None
        base_name = name.text.strip()

        # Try to get the type definition for range info
        if hasattr(typ, 'f_type_def') and typ.f_type_def:
            tdef = typ.f_type_def

            if isinstance(tdef, lal.SignedIntTypeDef):
                try:
                    r = tdef.f_range.f_range
                    range_text = r.text.strip() if r else ""
                    if range_text.lower().startswith("range "):
                        range_text = range_text[6:].strip()
                    if range_text:
                        return {"type": base_name, "range": range_text}
                except Exception:
                    pass
                return {"type": base_name}

            if isinstance(tdef, lal.ModIntTypeDef):
                try:
                    mod_val = tdef.f_expr.text.strip()
                    return {"type": base_name, "modulus": mod_val}
                except Exception:
                    return {"type": base_name}

            if isinstance(tdef, lal.FloatingPointDef):
                try:
                    digits = tdef.f_num_digits.text.strip()
                    result = {"type": base_name, "digits": digits}
                    if tdef.f_range:
                        r_text = tdef.f_range.f_range.text.strip()
                        result["range"] = r_text
                    return result
                except Exception:
                    return {"type": base_name}

            if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
                try:
                    delta = tdef.f_delta.text.strip()
                    result = {"type": base_name, "delta": delta}
                    if tdef.f_range:
                        r_text = tdef.f_range.f_range.text.strip()
                        result["range"] = r_text
                    return result
                except Exception:
                    return {"type": base_name}

            if isinstance(tdef, lal.ArrayTypeDef):
                return parse_type_def_node(tdef)

        return {"type": base_name}
    except Exception:
        return None


# ---------------------------
# Master type resolver for an ObjectDecl / component node
# ---------------------------
def get_structured_type(node):
    """
    Try in order:
      1. Semantic p_type resolution (most accurate, gives ranges)
      2. Syntactic SubtypeIndication parse (gets inline constraints)
      3. Raw text fallback
    """
    # 1. Semantic resolution
    result = resolve_p_type(node)
    if result and result.get("type") not in (None, "Unknown", ""):
        return result

    # 2. Syntactic: look at f_type_expr
    try:
        type_expr = node.f_type_expr
        if type_expr:
            parsed = parse_type_expr(type_expr)
            if parsed.get("type") not in (None, "Unknown", ""):
                return parsed
    except Exception:
        pass

    # 3. Raw text fallback
    try:
        if node.f_type_expr and node.f_type_expr.text:
            return {"type": node.f_type_expr.text.strip()}
    except Exception:
        pass

    return {"type": "Unknown"}

#  TEST chnage  




def _safe_text(node) -> str:
    try:
        return node.text.strip() if node and node.text else ""
    except Exception:
        return ""


_STMT_KINDS = frozenset({
    "IfStmt", "CaseStmt", "AssignStmt", "CallStmt",
    "WhileLoopStmt", "ForLoopStmt", "LoopStmt",
    "BlockStmt", "ReturnStmt", "NullStmt",
    "ExitStmt", "GotoStmt", "ExtendedReturnStmt", "ObjectDecl",
})


def _get_stmts_from_subp(subp: lal.SubpBody) -> list:
    """Try every known LAL path to get the executable statement list."""
    # Path 1: f_body.f_stmts  (standard)
    try:
        body = subp.f_body
        if body and hasattr(body, "f_stmts"):
            stmts = list(body.f_stmts)
            if stmts:
                return stmts
    except Exception:
        pass
    # Path 2: findall(HandledStmts)
    try:
        for hs in subp.findall(lal.HandledStmts):
            stmts = list(hs.f_stmts)
            if stmts:
                return stmts
    except Exception:
        pass
    # Path 3: f_stmts directly
    try:
        stmts = list(subp.f_stmts)
        if stmts:
            return stmts
    except Exception:
        pass
    # Path 4: children scan
    try:
        for child in subp.children:
            if child and child.kind_name == "HandledStmts":
                stmts = list(child.f_stmts)
                if stmts:
                    return stmts
            try:
                for gc in (child.children if child else []):
                    if gc and gc.kind_name == "HandledStmts":
                        stmts = list(gc.f_stmts)
                        if stmts:
                            return stmts
            except Exception:
                pass
    except Exception:
        pass
    # Path 5: brute-force collect statement-kind children
    try:
        stmts = [c for c in subp.children if c and c.kind_name in _STMT_KINDS]
        if stmts:
            return stmts
    except Exception:
        pass
    return []


def _iter_list(node, attr: str) -> list:
    try:
        val = getattr(node, attr, None)
        return list(val) if val is not None else []
    except Exception:
        return []


def _get_stmts_from_block(node) -> list:
    for attr in ("f_stmts", "f_body"):
        try:
            val = getattr(node, attr, None)
            if val is not None:
                stmts = list(val) if not hasattr(val, "f_stmts") else list(val.f_stmts)
                if stmts:
                    return stmts
        except Exception:
            pass
    try:
        for hs in node.findall(lal.HandledStmts):
            stmts = list(hs.f_stmts)
            if stmts:
                return stmts
    except Exception:
        pass
    return []


# ══════════════════════════════════════════════════════════════════
#  SECTION 3 — TYPE RESOLUTION HELPERS
# ══════════════════════════════════════════════════════════════════

def _semantic_type(node) -> dict:
    """
    Ask libadalang for the semantic type of *node*.
    Works across files when all units share one AnalysisContext.
    """
    try:
        typ = node.p_type
        if typ is None:
            return {"type": "Unknown"}
        base = _safe_text(typ.p_defining_name)
        if not base:
            return {"type": "Unknown"}
        tdef = getattr(typ, "f_type_def", None)
        if tdef is None:
            return {"type": base}

        if isinstance(tdef, lal.SignedIntTypeDef):
            try:
                r = _safe_text(tdef.f_range.f_range)
                if r.lower().startswith("range "):
                    r = r[6:].strip()
                return {"type": base, "range": r} if r else {"type": base}
            except Exception:
                return {"type": base}
        if isinstance(tdef, lal.ModIntTypeDef):
            try:
                return {"type": base, "modulus": _safe_text(tdef.f_expr)}
            except Exception:
                return {"type": base}
        if isinstance(tdef, lal.FloatingPointDef):
            try:
                res = {"type": base, "digits": _safe_text(tdef.f_num_digits)}
                if tdef.f_range:
                    res["range"] = _safe_text(tdef.f_range.f_range)
                return res
            except Exception:
                return {"type": base}
        if isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
            try:
                res = {"type": base, "delta": _safe_text(tdef.f_delta)}
                if tdef.f_range:
                    res["range"] = _safe_text(tdef.f_range.f_range)
                return res
            except Exception:
                return {"type": base}
        return {"type": base}
    except Exception:
        return {"type": "Unknown"}


# def _parse_subtype_indication(node) -> dict:
#     if node is None:
#         return {"type": "Unknown"}
#     if not isinstance(node, lal.SubtypeIndication):
#         return {"type": _safe_text(node) or "Unknown"}
#     base = _safe_text(node.f_name)
#     c = node.f_constraint
#     if c is None:
#         return {"type": base}
#     if isinstance(c, lal.RangeConstraint):
#         r = _safe_text(c.f_range)
#         if r.lower().startswith("range "):
#             r = r[6:].strip()
#         return {"type": base, "range": r}
#     if isinstance(c, lal.DigitsConstraint):
#         res = {"type": base, "digits": _safe_text(c.f_digits)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     if isinstance(c, lal.DeltaConstraint):
#         res = {"type": base, "delta": _safe_text(c.f_delta)}
#         if c.f_range:
#             r = _safe_text(c.f_range)
#             if r.lower().startswith("range "):
#                 r = r[6:].strip()
#             res["range"] = r
#         return res
#     # if isinstance(c, lal.IndexConstraint):
#     if isinstance(c, lal.CompositeConstraint):
#     # if isinstance(c, (lal.UnconstrainedArrayIndex, lal.UnconstrainedArrayIndexList)):
#         return {"type": base, "index_constraint": [_safe_text(x) for x in c.f_list]}
#     return {"type": base}
def _parse_subtype_indication(node) -> dict:
    if node is None:
        return {"type": "Unknown"}

    if not isinstance(node, lal.SubtypeIndication):
        return {"type": _safe_text(node) or "Unknown"}

    base = _safe_text(node.f_name)
    c = node.f_constraint

    if c is None:
        return {"type": base}

    # ── Range ─────────────────────────────────────────
    if isinstance(c, lal.RangeConstraint):
        r = _safe_text(c.f_range)
        if r.lower().startswith("range "):
            r = r[6:].strip()
        return {"type": base, "range": r}

    # ── Digits ────────────────────────────────────────
    if isinstance(c, lal.DigitsConstraint):
        res = {"type": base, "digits": _safe_text(c.f_digits)}
        if c.f_range:
            r = _safe_text(c.f_range)
            if r.lower().startswith("range "):
                r = r[6:].strip()
            res["range"] = r
        return res

    # ── Delta ─────────────────────────────────────────
    if isinstance(c, lal.DeltaConstraint):
        res = {"type": base, "delta": _safe_text(c.f_delta)}
        if c.f_range:
            r = _safe_text(c.f_range)
            if r.lower().startswith("range "):
                r = r[6:].strip()
            res["range"] = r
        return res

    # ── CompositeConstraint (REPLACES IndexConstraint) ─
    if isinstance(c, lal.CompositeConstraint):
        items = []

        try:
            # SAFEST: iterate children (works across versions)
            for child in c.children:
                txt = _safe_text(child)
                if txt:
                    items.append(txt)
        except Exception:
            pass

        return {"type": base, "index_constraint": items}

    # ── Fallback ──────────────────────────────────────
    return {"type": base}

def _best_type(node) -> dict:
    sem = _semantic_type(node)
    if sem.get("type") not in ("Unknown", "", None):
        return sem
    try:
        te = node.f_type_expr
        if te:
            p = _parse_subtype_indication(te)
            if p.get("type") not in ("Unknown", "", None):
                return p
    except Exception:
        pass
    try:
        raw = _safe_text(node.f_type_expr)
        if raw:
            return {"type": raw}
    except Exception:
        pass
    return {"type": "Unknown"}


def _get_scope_name(node) -> str:
    p = node.parent
    while p:
        if isinstance(p, lal.SubpBody):
            try:
                return p.f_subp_spec.f_subp_name.text
            except Exception:
                return "subprogram"
        if isinstance(p, lal.PackageBody):
            try:
                return f"package:{p.f_package_name.text}"
            except Exception:
                return "package"
        p = p.parent
    return "global"


# ══════════════════════════════════════════════════════════════════
#  SECTION 4 — TYPE REGISTRY  (cross-file, syntactic scan)
# ══════════════════════════════════════════════════════════════════

@dataclass
class TypeEntry:
    name: str
    kind: str           # enum|record|integer|modular|array|subtype|float|fixed|other
    declared_in: str
    enum_values:   list[dict]    = field(default_factory=list)
    record_fields: dict          = field(default_factory=dict)
    range_str: str               = ""
    modulus: str                 = ""
    element_type: dict           = field(default_factory=dict)
    indices: list[str]           = field(default_factory=list)
    base_type: str               = ""
    structured: dict             = field(default_factory=dict)
    extra: dict                  = field(default_factory=dict)


@dataclass
class ObjectEntry:
    name: str
    kind: str           # variable|constant
    data_type: dict
    initial_value: str
    declared_in: str
    scope: str
    possible_values: list[dict]  = field(default_factory=list)
    value_count: int             = 0
    range_str: str               = ""


class TypeRegistry:
    """
    Single-pass syntactic scan over ALL units.
    Provides cross-file lookup for types, objects, and enum literals.
    Used as fallback when LAL semantic resolution returns Unknown.
    """

    def __init__(self, units: list):
        self._types:    dict[str, TypeEntry]   = {}
        self._objects:  dict[str, ObjectEntry] = {}
        self._literals: dict[str, dict]        = {}

        for unit in units:
            if unit.root:
                self._scan_unit(unit)

        # Second pass: enrich objects with enum / range from their type
        for obj in self._objects.values():
            self._enrich_object(obj)

    # ── scan ──────────────────────────────────────────────────

    def _scan_unit(self, unit):
        fname = unit.filename
        for td in unit.root.findall(lal.TypeDecl):
            if td and td.f_name:
                self._register_type_decl(td, fname)
        for st in unit.root.findall(lal.SubtypeDecl):
            if st.f_name:
                self._register_subtype_decl(st, fname)
        for obj in unit.root.findall(lal.ObjectDecl):
            self._register_object_decl(obj, fname)

    def _register_type_decl(self, td, fname: str):
        tname = td.f_name.text.strip()
        tdef  = td.f_type_def
        entry = TypeEntry(name=tname, kind="other", declared_in=fname)
        try:
            if isinstance(tdef, lal.EnumTypeDef):
                entry.kind = "enum"
                for i, lit in enumerate(tdef.f_enum_literals):
                    ln = _safe_text(lit)
                    entry.enum_values.append({"value": ln, "position": i})
                    self._literals[ln] = {
                        "kind": "enum_literal", "data_type": tname,
                        "parent_type": tname, "value": ln,
                        "position": i, "declared_in": fname,
                        "all_values": [],   # filled in post-pass below
                    }
            elif isinstance(tdef, lal.RecordTypeDef):
                entry.kind = "record"
                for comp in tdef.findall(lal.ComponentDecl):
                    if not comp.f_component_def:
                        continue
                    fr = _safe_text(comp.f_component_def.f_type_expr)
                    fs = _best_type(comp.f_component_def)
                    for n in comp.f_ids:
                        entry.record_fields[n.text.strip()] = {
                            "raw_type": fr, "structured_type": fs, "declared_in": fname,
                        }
            elif isinstance(tdef, lal.SignedIntTypeDef):
                entry.kind = "integer"
                try:
                    r = _safe_text(tdef.f_range.f_range)
                    if r.lower().startswith("range "):
                        r = r[6:].strip()
                    entry.range_str = r
                except Exception:
                    pass
            elif isinstance(tdef, lal.ModIntTypeDef):
                entry.kind    = "modular"
                entry.modulus = _safe_text(tdef.f_expr)
            elif isinstance(tdef, lal.ArrayTypeDef):
                entry.kind = "array"
                try:
                    entry.element_type = _parse_subtype_indication(
                        tdef.f_component_type.f_type_expr)
                except Exception:
                    entry.element_type = {"type": "Unknown"}
                try:
                    entry.indices = [_safe_text(i) for i in tdef.f_indices.f_list]
                except Exception:
                    pass
            elif isinstance(tdef, lal.FloatingPointDef):
                entry.kind = "float"
                try:
                    entry.extra["digits"] = _safe_text(tdef.f_num_digits)
                except Exception:
                    pass
            elif isinstance(tdef, (lal.OrdinaryFixedPointDef, lal.DecimalFixedPointDef)):
                entry.kind = "fixed"
                try:
                    entry.extra["delta"] = _safe_text(tdef.f_delta)
                except Exception:
                    pass
        except Exception as e:
            entry.extra["error"] = str(e)
        self._types[tname] = entry

        # Backfill all_values for enum literals of this type
        if entry.kind == "enum":
            for lit_info in self._literals.values():
                if lit_info.get("parent_type") == tname:
                    lit_info["all_values"] = entry.enum_values

    def _register_subtype_decl(self, st, fname: str):
        sname    = st.f_name.text.strip()
        raw_node = getattr(st, "f_subtype", None) or getattr(st, "f_type_expr", None)
        parsed   = _parse_subtype_indication(raw_node) if raw_node else {"type": "Unknown"}
        base     = parsed.get("type", "Unknown").split()[0]
        entry    = TypeEntry(name=sname, kind="subtype", declared_in=fname,
                             base_type=base, structured=parsed)
        parent   = self._types.get(base)
        if parent and parent.kind == "enum":
            entry.enum_values = parent.enum_values[:]
        self._types[sname] = entry

    def _register_object_decl(self, obj, fname: str):
        is_const = False
        try:
            is_const = obj.f_has_constant.kind_name == "ConstantPresent"
        except Exception:
            pass
        init_val = ""
        try:
            if obj.f_default_expr:
                init_val = _safe_text(obj.f_default_expr)
        except Exception:
            pass
        dtype = _best_type(obj)
        scope = _get_scope_name(obj)
        for ident in obj.f_ids:
            iname = ident.text.strip()
            self._objects[iname] = ObjectEntry(
                name=iname, kind="constant" if is_const else "variable",
                data_type=dtype, initial_value=init_val,
                declared_in=fname, scope=scope,
            )

    def _enrich_object(self, obj: ObjectEntry):
        base = obj.data_type.get("type", "Unknown").split()[0]
        te   = self._resolve_type_chain(base)
        if te is None:
            return
        if te.kind == "enum":
            obj.possible_values = te.enum_values
            obj.value_count     = len(te.enum_values)
        elif te.kind in ("integer", "modular"):
            obj.range_str = te.range_str or te.modulus
        elif te.kind == "record":
            pass  # fields already stored in type entry

    def _resolve_type_chain(self, name: str, depth: int = 0) -> TypeEntry | None:
        """Follow subtype/alias chain up to 10 levels."""
        if not name or depth > 10:
            return None
        te = self._types.get(name)
        if te is None:
            return None
        if te.kind == "subtype" and te.base_type and te.base_type != name:
            parent = self._resolve_type_chain(te.base_type, depth + 1)
            if parent:
                # inherit enum values
                if parent.kind == "enum" and not te.enum_values:
                    te.enum_values  = parent.enum_values[:]
                return parent
        return te

    # ── public API ──────────────────────────────────────────────

    def resolve(self, name: str) -> ObjectEntry | None:
        return self._objects.get(name)

    def resolve_type(self, name: str) -> TypeEntry | None:
        return self._resolve_type_chain(name)

    def enum_literal(self, name: str) -> dict | None:
        return self._literals.get(name)

    def field_info(self, object_name: str, field_name: str) -> dict:
        """
        Full resolution for Odata.QuatStatus:
          Odata → its type → record fields → QuatStatus → QuatStatus's type → enum values
        """
        result: dict = {
            "kind": "field", "parent_object": object_name,
            "field_name": field_name, "data_type": "Unknown",
            "declared_in": "Unknown", "possible_values": [], "value_count": 0,
        }
        obj = self._objects.get(object_name)
        if obj is None:
            return result

        obj_type_name = obj.data_type.get("type", "Unknown").split()[0]
        te = self._resolve_type_chain(obj_type_name)
        if te is None or te.kind != "record":
            return result

        # Case-insensitive field lookup
        finfo = te.record_fields.get(field_name)
        if finfo is None:
            for fn, fv in te.record_fields.items():
                if fn.lower() == field_name.lower():
                    finfo = fv
                    break
        if finfo is None:
            return result

        raw    = finfo.get("raw_type", "Unknown")
        struct = finfo.get("structured_type", {"type": raw})
        base_ft= struct.get("type", raw).split()[0]

        result["data_type"]       = raw
        result["structured_type"] = struct
        result["declared_in"]     = finfo.get("declared_in", "Unknown")

        # Resolve field's type for enum values / range
        ft = self._resolve_type_chain(base_ft)
        if ft:
            if ft.kind == "enum":
                result["possible_values"] = ft.enum_values
                result["value_count"]     = len(ft.enum_values)
            elif ft.kind in ("integer", "modular"):
                result["range"] = ft.range_str or ft.modulus
            elif ft.kind == "subtype":
                result["subtype_of"] = ft.base_type
                vals = ft.enum_values
                if not vals:
                    grandparent = self._resolve_type_chain(ft.base_type)
                    if grandparent and grandparent.kind == "enum":
                        vals = grandparent.enum_values
                result["possible_values"] = vals
                result["value_count"]     = len(vals)
        elif "range" in struct:
            result["range"] = struct["range"]

        return result

    def to_dict(self) -> dict:
        out: dict = {"types": {}, "objects": {}, "enum_literals": self._literals}
        for k, v in self._types.items():
            out["types"][k] = v.__dict__
        for k, v in self._objects.items():
            out["objects"][k] = v.__dict__
        return out


# ══════════════════════════════════════════════════════════════════
#  SECTION 5 — EXPRESSION RESOLVER
#  Resolves every identifier in an expression to its full type info.
#  Resolution order: semantic p_type → registry lookup → fallback
# ══════════════════════════════════════════════════════════════════

# Standard Ada identifiers we don't want to report as "unknown"
_BUILTIN_TYPES = frozenset({
    "Boolean", "Integer", "Float", "Duration", "Character",
    "String", "Natural", "Positive", "Long_Integer", "Long_Float",
    "Short_Integer", "Short_Float", "Wide_Character",
    "True", "False",
})

_BUILTIN_MAP = {
    "True":  {"kind": "enum_literal", "data_type": "Boolean",
              "parent_type": "Boolean", "value": "True",
              "all_values": [{"value": "False", "position": 0},
                             {"value": "True",  "position": 1}]},
    "False": {"kind": "enum_literal", "data_type": "Boolean",
              "parent_type": "Boolean", "value": "False",
              "all_values": [{"value": "False", "position": 0},
                             {"value": "True",  "position": 1}]},
}


class ExpressionResolver:

    def __init__(self, registry: TypeRegistry):
        self.reg = registry

    def resolve(self, node) -> dict[str, dict]:
        found: dict[str, dict] = {}
        self._walk(node, found)
        return found

    # ── AST walker ────────────────────────────────────────────

    def _walk(self, node, found: dict):
        if node is None:
            return
        if isinstance(node, lal.ParenExpr):
            self._walk(node.f_expr, found)
        elif isinstance(node, lal.DottedName):
            self._handle_dotted(node, found)
        elif isinstance(node, lal.CallExpr):
            self._handle_call(node, found)
        # elif isinstance(node, (lal.BinOp, lal.RelationOp,
        #                         lal.MembershipExpr, lal.OpAndThen, lal.OpOrElse)):
        #     self._walk(node.f_left,  found)
        #     self._walk(node.f_right, found)
        elif isinstance(node, (lal.BinOp, lal.RelationOp,
                        lal.OpAndThen, lal.OpOrElse)):
            self._walk(node.f_left,  found)
            self._walk(node.f_right, found)

        elif isinstance(node, lal.MembershipExpr):
            try:
                self._walk(node.f_expr, found)
            except Exception:
                pass
            try:
                self._walk(node.f_membership, found)
            except Exception:
                pass
        elif isinstance(node, lal.UnOp):
            self._walk(node.f_expr, found)
        elif isinstance(node, lal.AttributeRef):
            self._walk(node.f_prefix, found)
            try:
                for arg in node.f_args:
                    self._walk(arg, found)
            except Exception:
                pass
        elif isinstance(node, lal.QualExpr):
            self._walk(node.f_suffix, found)
        elif isinstance(node, lal.IfExpr):
            self._walk(node.f_cond_expr, found)
            self._walk(node.f_then_expr, found)
            for alt in node.f_alternatives:
                self._walk(alt.f_cond_expr, found)
                self._walk(alt.f_then_expr, found)
            self._walk(node.f_else_expr, found)
        elif isinstance(node, lal.CaseExpr):
            self._walk(node.f_expr, found)
            for alt in node.f_cases:
                self._walk(alt.f_expr, found)
        elif isinstance(node, lal.Aggregate):
            try:
                for assoc in node.f_assocs:
                    self._walk(assoc.f_r_expr, found)
            except Exception:
                pass
        elif isinstance(node, lal.Identifier):
            self._handle_identifier(node, found)
        else:
            try:
                for child in node.children:
                    self._walk(child, found)
            except Exception:
                pass

    # ── DottedName: Odata.QuatStatus ──────────────────────────

    def _handle_dotted(self, node: lal.DottedName, found: dict):
        prefix_text = _safe_text(node.f_prefix)
        suffix_text = _safe_text(node.f_suffix)
        full_text   = _safe_text(node)

        # ① Full dotted name  (Odata.QuatStatus)
        if full_text and full_text not in found:
            # Try registry field resolution first (syntactic, always works)
            fi  = self.reg.field_info(prefix_text, suffix_text)
            # Also try semantic type on the full node
            sem = _semantic_type(node)
            if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
                fi["data_type"]     = sem["type"]
                fi["semantic_type"] = sem
                # Now try to enrich with enum values using the semantic type
                te = self.reg.resolve_type(sem["type"])
                if te and te.kind == "enum":
                    fi["possible_values"] = te.enum_values
                    fi["value_count"]     = len(te.enum_values)
            found[full_text] = fi

        # ② Prefix object  (Odata)
        if prefix_text and prefix_text not in found:
            found[prefix_text] = self._resolve_name(node.f_prefix, prefix_text)

        # ③ Suffix field  (QuatStatus) — standalone with parent_object annotation
        if suffix_text and suffix_text not in found:
            fi  = self.reg.field_info(prefix_text, suffix_text)
            sem = _semantic_type(node.f_suffix) if node.f_suffix else {"type": "Unknown"}
            if fi["data_type"] == "Unknown" and sem.get("type") not in ("Unknown", ""):
                fi["data_type"] = sem["type"]
                # Enrich with enum values
                te = self.reg.resolve_type(sem["type"])
                if te and te.kind == "enum":
                    fi["possible_values"] = te.enum_values
                    fi["value_count"]     = len(te.enum_values)
            fi["parent_object"] = prefix_text
            found[suffix_text]  = fi

    # ── CallExpr: Sqrt(...), FL6(...) ─────────────────────────

    def _handle_call(self, node: lal.CallExpr, found: dict):
        try:
            cname = _safe_text(node.f_name)
            # Type conversions like FL6(...) or Double(...) — skip as noise
            # but DO walk their arguments to capture inner identifiers
            try:
                for p in node.f_suffix:
                    self._walk(p, found)
            except Exception:
                pass
            # Only record if it looks like a real procedure/function call
            # (i.e. name is not a known type from registry)
            if cname and cname not in found:
                te = self.reg.resolve_type(cname)
                if te is None:  # not a type conversion — it's a real call
                    dtype = _semantic_type(node)
                    found[cname] = {
                        "kind":      "call",
                        "data_type": dtype if dtype.get("type") != "Unknown"
                                     else {"type": "procedure"},
                        "args": [_safe_text(p) for p in node.f_suffix],
                    }
        except Exception:
            pass

    # ── Plain Identifier: QCOMPUTED_AND_OK ───────────────────

    def _handle_identifier(self, node: lal.Identifier, found: dict):
        name = _safe_text(node)
        if not name or name in found:
            return
        found[name] = self._resolve_name(node, name)

    # ── Master resolver ───────────────────────────────────────

    def _resolve_name(self, node, name: str) -> dict:
        """
        Resolution order:
          1. Built-in (True, False)
          2. Enum literal registry   → parent type + all sibling values
          3. Object registry         → data_type, scope, declared_in
          4. Semantic p_type         → works cross-file when context is shared
          5. Type name reference     → type is used as a value (e.g. type conversion)
          6. Fallback
        """

        # 1. Built-ins
        if name in _BUILTIN_MAP:
            return dict(_BUILTIN_MAP[name])

        # 2. Enum literal  (QCOMPUTED_AND_OK)
        lit = self.reg.enum_literal(name)
        if lit:
            rec = dict(lit)
            # Ensure all sibling values are included
            if not rec.get("all_values"):
                te = self.reg.resolve_type(lit.get("parent_type", ""))
                if te and te.kind == "enum":
                    rec["all_values"] = te.enum_values
            return rec

        # 3. Object registry  (Odata, LatestQuaternion, ...)
        obj = self.reg.resolve(name)
        if obj:
            rec: dict = {
                "kind":        obj.kind,
                "data_type":   obj.data_type,
                "declared_in": obj.declared_in,
                "scope":       obj.scope,
            }
            if obj.initial_value:
                rec["initial_value"] = obj.initial_value
            if obj.possible_values:
                rec["possible_values"] = obj.possible_values
                rec["value_count"]     = obj.value_count
            if obj.range_str:
                rec["range"] = obj.range_str
            # Try semantic type to enrich data_type if it's Unknown
            if obj.data_type.get("type") in ("Unknown", "", None) and node is not None:
                sem = _semantic_type(node)
                if sem.get("type") not in ("Unknown", "", None):
                    rec["data_type"] = sem
                    # re-enrich with enum values if type changed
                    te = self.reg.resolve_type(sem["type"])
                    if te and te.kind == "enum":
                        rec["possible_values"] = te.enum_values
                        rec["value_count"]     = len(te.enum_values)
            return rec

        # 4. Semantic p_type (cross-file, requires shared AnalysisContext)
        if node is not None:
            sem = _semantic_type(node)
            if sem.get("type") not in ("Unknown", "", None):
                rec = {"kind": "identifier", "data_type": sem}
                te  = self.reg.resolve_type(sem["type"])
                if te:
                    if te.kind == "enum":
                        rec["possible_values"] = te.enum_values
                        rec["value_count"]     = len(te.enum_values)
                    elif te.kind in ("integer", "modular"):
                        rec["range"] = te.range_str or te.modulus
                    elif te.kind == "record":
                        rec["record_fields"] = list(te.record_fields.keys())
                return rec

        # 5. Type name reference  (e.g. FL6 used as type conversion)
        te = self.reg.resolve_type(name)
        if te:
            rec = {"kind": "type_conversion", "data_type": {"type": name}}
            if te.kind == "enum":
                rec["possible_values"] = te.enum_values
                rec["value_count"]     = len(te.enum_values)
            elif te.kind == "record":
                rec["record_fields"] = list(te.record_fields.keys())
            return rec

        # 6. Fallback
        return {"kind": "unresolved", "data_type": {"type": "Unknown"}}


# ══════════════════════════════════════════════════════════════════
#  SECTION 6 — CONTROL FLOW WALKER
# ══════════════════════════════════════════════════════════════════

@dataclass
class ConditionRecord:
    condition_text: str
    branch_type: str       # if|elsif|while|for|case_expr|case_choice
    nesting_depth: int
    variables: dict[str, dict]


@dataclass
class BranchBodyRecord:
    variable_name: str
    kind: str              # assignment|rhs_reference|local_decl|call
    data_type: dict
    used_in_branch: str
    assigned_from: str    = ""
    possible_values: list = field(default_factory=list)
    value_count: int      = 0


class ControlFlowWalker:

    def __init__(self, registry: TypeRegistry):
        self.reg      = registry
        self.resolver = ExpressionResolver(registry)

    def walk_subprogram(self, subp: lal.SubpBody) -> dict:
        self.conditions:      list[ConditionRecord]  = []
        self.branch_bodies:   list[BranchBodyRecord] = []
        self.procedure_calls: list[dict]             = []

        stmts = _get_stmts_from_subp(subp)
        self._walk_stmts(stmts, depth=0, branch_label="")

        return {
            "if_conditions":         [self._cond_to_dict(c) for c in self.conditions],
            "branch_body_variables": self._bodies_to_dict(),
            "procedure_calls":       self.procedure_calls,
        }

    def _walk_stmts(self, stmts: list, depth: int, branch_label: str):
        for stmt in stmts:
            self._walk_stmt(stmt, depth, branch_label)

    def _walk_stmt(self, node, depth: int, branch_label: str):
        if node is None:
            return
        kind = node.kind_name

        if kind == "IfStmt":
            cond = node.f_cond_expr
            if isinstance(cond, lal.ParenExpr):
                cond = cond.f_expr
            self._record_condition(cond, "if", depth)
            self._walk_stmts(_iter_list(node, "f_then_stmts"), depth + 1, "then")
            for part in _iter_list(node, "f_alternatives"):
                ec = getattr(part, "f_cond_expr", None)
                if isinstance(ec, lal.ParenExpr):
                    ec = ec.f_expr
                self._record_condition(ec, "elsif", depth)
                self._walk_stmts(_iter_list(part, "f_stmts"), depth + 1, "elsif")
            self._walk_stmts(_iter_list(node, "f_else_stmts"), depth + 1, "else")

        elif kind == "CaseStmt":
            self._record_condition(node.f_expr, "case_expr", depth)
            for alt in _iter_list(node, "f_alternatives"):
                for choice in _iter_list(alt, "f_choices"):
                    vars_c = self.resolver.resolve(choice)
                    if vars_c:
                        self.conditions.append(ConditionRecord(
                            condition_text=_safe_text(choice),
                            branch_type="case_choice",
                            nesting_depth=depth,
                            variables=vars_c,
                        ))
                self._walk_stmts(_iter_list(alt, "f_stmts"), depth + 1, "case_body")

        elif kind == "WhileLoopStmt":
            try:
                self._record_condition(node.f_spec.f_expr, "while", depth)
            except Exception:
                pass
            self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

        elif kind == "ForLoopStmt":
            try:
                spec = node.f_spec
                if hasattr(spec, "f_iter_expr") and spec.f_iter_expr:
                    self._record_condition(spec.f_iter_expr, "for", depth)
            except Exception:
                pass
            self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

        elif kind == "LoopStmt":
            self._walk_stmts(_iter_list(node, "f_stmts"), depth + 1, "loop_body")

        elif kind == "BlockStmt":
            self._walk_stmts(_get_stmts_from_block(node), depth + 1, branch_label)

        elif kind == "AssignStmt":
            self._handle_assignment(node, branch_label)

        elif kind == "CallStmt":
            self._handle_call_stmt(node, branch_label)

        elif kind == "ReturnStmt":
            try:
                if node.f_return_expr:
                    self._record_condition(node.f_return_expr, "return_expr", depth)
            except Exception:
                pass

        elif kind == "ObjectDecl":
            dtype = _best_type(node)
            for ident in node.f_ids:
                iname = ident.text.strip()
                init  = _safe_text(node.f_default_expr) if node.f_default_expr else ""
                br    = BranchBodyRecord(
                    variable_name=iname, kind="local_decl",
                    data_type=dtype, used_in_branch=branch_label,
                    assigned_from=init,
                )
                self._enrich_body_record(br)
                self.branch_bodies.append(br)

    def _record_condition(self, cond_node, branch_type: str, depth: int):
        if cond_node is None:
            return
        variables = self.resolver.resolve(cond_node)
        self.conditions.append(ConditionRecord(
            condition_text=_safe_text(cond_node),
            branch_type=branch_type,
            nesting_depth=depth,
            variables=variables,
        ))

    def _handle_assignment(self, node: lal.AssignStmt, branch_label: str):
        lhs     = node.f_dest
        rhs     = node.f_expr
        lhs_txt = _safe_text(lhs)
        rhs_txt = _safe_text(rhs)

        # Resolve LHS type: semantic first, then registry
        dtype = _semantic_type(lhs)
        if dtype.get("type") in ("Unknown", "", None):
            base_name = lhs_txt.split(".")[0]
            if "." in lhs_txt:
                parts = lhs_txt.split(".", 1)
                fi    = self.reg.field_info(parts[0], parts[1])
                if fi["data_type"] != "Unknown":
                    dtype = {"type": fi["data_type"]}
            else:
                obj = self.reg.resolve(base_name)
                if obj:
                    dtype = obj.data_type

        br = BranchBodyRecord(
            variable_name=lhs_txt, kind="assignment",
            data_type=dtype, used_in_branch=branch_label,
            assigned_from=rhs_txt,
        )
        self._enrich_body_record(br)
        self.branch_bodies.append(br)

        # Walk RHS and resolve each identifier found there
        existing = {b.variable_name for b in self.branch_bodies}
        rhs_vars = self.resolver.resolve(rhs)
        for vname, vinfo in rhs_vars.items():
            if vname in existing:
                continue
            # Only add if the type is not Unknown OR it's a field/enum
            vkind  = vinfo.get("kind", "unresolved")
            vtype  = vinfo.get("data_type", {})
            vtype_str = vtype.get("type", "Unknown") if isinstance(vtype, dict) else str(vtype)

            if vtype_str == "Unknown" and vkind not in ("field", "enum_literal"):
                # Skip noise: type conversions (FL6, Double, Sqrt are in registry as types)
                te = self.reg.resolve_type(vname)
                if te is not None:
                    continue   # it's a type name, not a variable reference

            self.branch_bodies.append(BranchBodyRecord(
                variable_name=vname, kind=vkind if vkind != "unresolved" else "rhs_reference",
                data_type=vtype if isinstance(vtype, dict) else {"type": vtype_str},
                used_in_branch=branch_label,
                possible_values=vinfo.get("possible_values", []),
                value_count=vinfo.get("value_count", 0),
            ))

    def _handle_call_stmt(self, node: lal.CallStmt, branch_label: str):
        call = node.f_call
        try:
            cname = _safe_text(getattr(call, "f_name", None)) or _safe_text(call)
            dtype = _semantic_type(call)
            args  = []
            try:
                for p in call.f_suffix:
                    args.append(_safe_text(p))
            except Exception:
                pass
            self.procedure_calls.append({
                "name":      cname,
                "data_type": dtype.get("type", "procedure")
                             if dtype.get("type") != "Unknown" else "procedure",
                "args":      args,
                "called_in": branch_label,
            })
        except Exception:
            pass

    def _enrich_body_record(self, br: BranchBodyRecord):
        base = br.data_type.get("type", "Unknown").split()[0] \
               if isinstance(br.data_type, dict) else "Unknown"
        te = self.reg.resolve_type(base)
        if te and te.kind == "enum":
            br.possible_values = te.enum_values
            br.value_count     = len(te.enum_values)

    @staticmethod
    def _cond_to_dict(c: ConditionRecord) -> dict:
        return {
            "condition_text": c.condition_text,
            "branch_type":    c.branch_type,
            "nesting_depth":  c.nesting_depth,
            "variables":      c.variables,
        }

    def _bodies_to_dict(self) -> dict:
        out: dict = {}
        for br in self.branch_bodies:
            entry: dict = {
                "kind":           br.kind,
                "data_type":      br.data_type,
                "used_in_branch": br.used_in_branch,
            }
            if br.assigned_from:
                entry["assigned_from"] = br.assigned_from
            if br.possible_values:
                entry["possible_values"] = br.possible_values
                entry["value_count"]     = br.value_count
            out[br.variable_name] = entry
        return out


# ══════════════════════════════════════════════════════════════════
#  SECTION 7 — TOP-LEVEL EXTRACTOR
# ══════════════════════════════════════════════════════════════════

class ControlFlowExtractor:
    """
    Main entry point.

        units     = load_units("/path/to/project")   # MUST use load_units
        extractor = ControlFlowExtractor(units)
        report    = extractor.run()
    """

    def __init__(self, units: list):
        self.units = units

    def run(self) -> dict:
        registry = TypeRegistry(self.units)
        walker   = ControlFlowWalker(registry)
        report: dict = {}

        for unit in self.units:
            if not unit.root:
                continue
            # Only report .adb files (bodies contain executable code)
            if not unit.filename.endswith(".adb"):
                continue

            fname      = unit.filename
            file_entry: dict = {}

            for subp in unit.root.findall(lal.SubpBody):
                try:
                    sname = (
                        subp.f_subp_spec.f_subp_name.text
                        if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
                        else "UNKNOWN"
                    )
                except Exception:
                    sname = "UNKNOWN"

                result = walker.walk_subprogram(subp)

                # Debug info when nothing extracted
                if (not result["if_conditions"] and
                        not result["branch_body_variables"] and
                        not result["procedure_calls"]):
                    raw = _get_stmts_from_subp(subp)
                    result["_debug"] = {
                        "stmt_count": len(raw),
                        "stmt_kinds": [s.kind_name for s in raw[:10]],
                        "hint": (
                            "0 stmts — subp.f_body path failed; "
                            "run debug_ast.py to inspect AST structure"
                            if not raw else
                            "Stmts found but no control-flow at top level"
                        ),
                    }

                file_entry[sname] = result

            if file_entry:
                report[fname] = file_entry

        report["__registry__"] = registry.to_dict()
        return report


# ══════════════════════════════════════════════════════════════════
#  ENTRY POINT
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import sys

    project_path = sys.argv[1] if len(sys.argv) > 1 else "/home/ssss/Desktop/Libada_test_project/Rakshitha/src"
    units  = load_units(project_path)
    report = ControlFlowExtractor(units).run()
    print(json.dumps(report, indent=4, default=str))