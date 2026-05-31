# import libadalang as lal

# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units

#     def extract(self):
#         result = {}

#         # for unit in self.units:
#         #     file_vars = {
#         #         "global_variables": [],
#         #         "local_variables": {}
#         #     }


#             # # Global variables
#             # for obj in unit.root.findall(lal.ObjectDecl):
#             #     file_vars["global_variables"].append(obj.f_ids[0].text)

#             # # Local variables per subprogram
#             # for subp in unit.root.findall(lal.SubpBody):
#             #     name = subp.f_subp_spec.f_subp_name.text
#             #     file_vars["local_variables"][name] = []

#             #     for obj in subp.findall(lal.ObjectDecl):
#             #         file_vars["local_variables"][name].append(obj.f_ids[0].text)
        
#         # for unit in self.units:
#         #     file_vars = {
#         #         "global_variables": {},
#         #         "local_variables": {}
#         #     }

#         #     for subp in unit.root.findall (lal.SubpBody):
#         #         name = subp.f_subp_spec.f_subp_name.text
#         #         file_vars["global_variables"][name] = []
#         #         file_vars["local_variables"][name] = []

#         #         for obj in subp.findall(lal.ObjectDecl):
#         #             for ident in obj.f_ids:
#         #                 file_vars["local_variables"][name].append(ident.text)

#         #         for obj in subp.f_decls:
#         #             if isinstance(obj, lal.ObjectDecl):
#         #                 for ident in obj.f_ids:
#         #                     file_vars["global_variables"][name].append(ident.text)
       
#      #   def is_global_object(obj):
#       #      parent = obj.parent

# #            while parent:
#  #               if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#   ##             if isinstance(parent, (lal.PackageDecl,lal.PackageBody)):
#     #                return True
#      #           parent = parent.parent

# #            return True    

#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "local_variables": {}
#             }

#          #   global_nodes = set()

# #            root = unit.root
#  #           print(unit.root.f_name.text)

#           #  for obj in root.findall(lal.ObjectDecl):
#            #         if is_global_object(obj):
#             #            global_nodes.add(obj)
#                         #print(obj.dump)
#              #       p = obj.parent
#                     #while p:
#                      #   print(type(p))
#                       #  p = p.parent
# #
#  #           if global_nodes:
#   #              print("Globals used:")
#    #         else:
#     #            print("No globals")  
        
#             for subp in unit.root.findall (lal.SubpBody):
#                 name = subp.f_subp_spec.f_subp_name.text
#                 file_vars["global_variables"][name] = []
#                 file_vars["local_variables"][name] = []
#                 local_vars = set()
#                 global_vars = set()
#                 for obj in subp.findall(lal.ObjectDecl):
#                     for ident in obj.f_ids:
#                         local_vars.add(ident.text)
#                         file_vars["local_variables"][name].append(ident.text)
    
#                 for node in subp.findall(lal.Name):
#                     ref = node.p_referenced_defining_name
#                     if not ref:
#                         continue
#                  #   print(ref.text)
#                   #  decl = ref.p_basic_decl
#                    # if not isinstance(decl, lal.ObjectDecl):
#                     #    continue

# #                    var_name = ref.text
#  #                   if var_name in local_vars:
#   #                      continue 

# #                    if not isinstance(lal.PackageBody, lal.PackageDecl):
#  #                       parent = node.p_semantic_parent
#   #                      if isinstance(parent, lal.AssignStmt):
#    #                         global_vars.add(var_name)

#                # for name in subp.findall(lal.Name):
#                 #     decl = name.p_referenced_defining_name()
                     
#                  #    if decl is global_nodes:
#                   #       print("Globals used:", name.text)


#                     # scope = decl.p_semantic_parent
#                     # if isinstance(Scope, (lal.PackageBody, lal.PackageDecl)):
#                     #     parent = node.p_semantic_parent
#                     #     if isinstance(parent, lal.AssignStmt):
#                     #         self.global_writes[name].add(var_name)
#                     #     else:
#                     #         self.global_reads[name].add(var_name)   
#                     #     file_vars["global_variables"][name].append(var_name)


#             result[unit.filename] = file_vars

#         return result
    



# import libadalang as lal

# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units

#     def extract(self):
#         result = {}

#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "local_variables": {}
#             }
        
        
#         def is_global_object(obj):
#             parent = obj.parent

#             while parent:
#                 if isinstance(parent, (lal.SubpBody, lal.SubpDecl)):
#                     return False
#                 parent = parent.parent

#             return True    

#         global_nodes = set()

#         for obj in unit.root.findall(lal.ObjectDecl):
#             if is_global_object(obj):
#                 global_nodes.add(obj)




#             for subp in unit.root.findall (lal.SubpBody):
#                 name = subp.f_subp_spec.f_subp_name.text
#                 file_vars["global_variables"][name] = []
#                 file_vars["local_variables"][name] = []
#                 local_vars = set()
#                 for obj in subp.findall(lal.ObjectDecl):
#                     for ident in obj.f_ids:
#                         local_vars.add(ident.text)
#                         file_vars["local_variables"][name].append(ident.text)
    
#                 for obj in subp.f_decls:
#                     if isinstance(obj, lal.ObjectDecl):
#                         for ident in obj.f_ids:
#                             file_vars["global_variables"][name].append(ident.text)

#                 for name in subp.findall(lal.Name):
#                      decl = name.p_referenced_defining_name()
                     
#                      if decl is global_nodes:
#                          print("Globals used:", name.text)


#                     # scope = decl.p_semantic_parent
#                     # if isinstance(Scope, (lal.PackageBody, lal.PackageDecl)):
#                     #     parent = node.p_semantic_parent
#                     #     if isinstance(parent, lal.AssignStmt):
#                     #         self.global_writes[name].add(var_name)
#                     #     else:
#                     #         self.global_reads[name].add(var_name)   
#                     #     file_vars["global_variables"][name].append(var_name)


#             result[unit.filename] = file_vars

#         return result



# import os
# import libadalang as lal

# #collecting all Ada files recursively
# def collect_ada_files(path):
#     ada_files = []

#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)

#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")

#     return ada_files

# #analyzer class
# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units

#     @staticmethod
#     def is_global_object(obj):
#         """Return True if an ObjectDecl is global (not inside a subprogram or block)"""
#         parent = obj.parent
#         while parent:
#             if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#                 return False
#             parent = parent.parent
#         return True

#     def extract(self):
#         result = {}

#         # --- First pass: collect global variables and constants from .ads files ---
#         global_nodes = set()
#         global_constants = set()
#         for unit in self.units:
#             if unit.filename.endswith(".ads"):
#                 for obj in unit.root.findall(lal.ObjectDecl):
#                     if self.is_global_object(obj):
#                         for ident in obj.f_ids:
#                             name = ident.text
#                             if obj.f_has_constant.kind_name == "ConstantPresent":
#                                 global_constants.add(name)
#                             else:
#                                 global_nodes.add(name)

#         # --- Second pass: analyze each subprogram ---
#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "global_constants": {},
#                 "local_variables": {}
#             }

#             for subp in unit.root.findall(lal.SubpBody):
#                 subp_name = subp.f_subp_spec.f_subp_name.text
#                 file_vars["global_variables"][subp_name] = set()
#                 file_vars["global_constants"][subp_name] = set()
#                 file_vars["local_variables"][subp_name] = set()

#                 # Collect local variables
#                 for obj in subp.findall(lal.ObjectDecl):
#                     for ident in obj.f_ids:
#                         file_vars["local_variables"][subp_name].add(ident.text)

#                 # Check usage of global variables/constants
#                 for name_node in subp.findall(lal.Name):
#                     name_text = name_node.text
#                     if name_text in global_nodes:
#                         file_vars["global_variables"][subp_name].add(name_text)
#                     elif name_text in global_constants:
#                         file_vars["global_constants"][subp_name].add(name_text)

#             result[unit.filename] = file_vars

#         # --- Convert sets to lists for JSON serialization ---
#         serializable_result = {}
#         for filename, file_vars in result.items():
#             serializable_result[filename] = {
#                 "global_variables": {k: list(v) for k, v in file_vars["global_variables"].items()},
#                 "global_constants": {k: list(v) for k, v in file_vars["global_constants"].items()},
#                 "local_variables": {k: list(v) for k, v in file_vars["local_variables"].items()},
#             }

#         return serializable_result




# import os
# import libadalang as lal

# # -------------------------------
# # Collect all Ada files recursively
# # -------------------------------
# def collect_ada_files(path):
#     ada_files = []

#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")

#     return ada_files


# # -------------------------------
# # Analyzer class
# # -------------------------------
# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units

#     @staticmethod
#     def is_global_object(obj):
#         """Return True if ObjectDecl is global (not inside a subprogram or block)"""
#         parent = obj.parent
#         while parent:
#             if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#                 return False
#             parent = parent.parent
#         return True

#     @staticmethod
#     def get_type(obj):
#         """Return semantic type of a variable/constant"""
#         try:
#             # Use p_type for semantic type resolution
#             type_node = obj.p_type
#             if type_node:
#                 return type_node.text
#         except Exception:
#             pass
#         return "Unknown"

#     def extract(self):
#         result = {}

#         # --- First pass: collect global variables and constants from .ads files ---
#         global_vars_types = {}
#         global_consts_types = {}
#         for unit in self.units:
#             if unit.filename.endswith(".ads"):
#                 for obj in unit.root.findall(lal.ObjectDecl):
#                     if self.is_global_object(obj):
#                         type_name = self.get_type(obj)
#                         for ident in obj.f_ids:
#                             name = ident.text
#                             if obj.f_has_constant.kind_name == "ConstantPresent":
#                                 global_consts_types[name] = type_name
#                             else:
#                                 global_vars_types[name] = type_name

#         # --- Second pass: analyze each subprogram ---
#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "global_constants": {},
#                 "local_variables": {}
#             }

#             for subp in unit.root.findall(lal.SubpBody):
#                 subp_name = subp.f_subp_spec.f_subp_name.text
#                 file_vars["global_variables"][subp_name] = {}
#                 file_vars["global_constants"][subp_name] = {}
#                 file_vars["local_variables"][subp_name] = {}

#                 # Local variables
#                 for obj in subp.findall(lal.ObjectDecl):
#                     type_name = self.get_type(obj)
#                     for ident in obj.f_ids:
#                         file_vars["local_variables"][subp_name][ident.text] = type_name

#                 # Globals/constants used in this subprogram
#                 for name_node in subp.findall(lal.Name):
#                     name_text = name_node.text
#                     if name_text in global_vars_types:
#                         file_vars["global_variables"][subp_name][name_text] = global_vars_types[name_text]
#                     elif name_text in global_consts_types:
#                         file_vars["global_constants"][subp_name][name_text] = global_consts_types[name_text]

#             result[unit.filename] = file_vars

#         return result


# # -------------------------------
# # Example usage
# # -------------------------------
# if __name__ == "__main__":
#     path = "/path/to/your/ada/project"
#     ada_files = collect_ada_files(path)
#     print(f"Found {len(ada_files)} Ada files.")

#     ctx = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([path]))
#     units = [ctx.get_from_file(f) for f in ada_files]

#     analyzer = VariablesAnalyzer(units)
#     output = analyzer.extract()

#     import json
#     print(json.dumps(output, indent=4))



# import os
# import libadalang as lal

# #collecting all Ada files recursively
# def collect_ada_files(path):
#     ada_files = []

#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)

#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")

#     return ada_files


# #analyzer class
# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units

#     @staticmethod
#     def is_global_object(obj):
#         """Return True if an ObjectDecl is global (not inside a subprogram or block)"""
#         parent = obj.parent
#         while parent:
#             if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#                 return False
#             parent = parent.parent
#         return True

#     #  TYPE EXTRACTION (your logic integrated)
#     @staticmethod
#     def get_type(node):
#         # Declared type
#         type_expr = node.f_type_expr.text if node.f_type_expr else "Unknown"

#         # Resolved type
#         try:
#             resolved_type = node.p_type
#             resolved_type_name = resolved_type.name.text if resolved_type else None
#         except:
#             resolved_type_name = None

#         # Prefer resolved type, fallback to declared
#         return resolved_type_name if resolved_type_name else type_expr

#     def extract(self):
#         result = {}

#         # --- First pass: collect global variables and constants WITH TYPES ---
#         global_nodes = {}
#         global_constants = {}

#         for unit in self.units:
#             if unit.filename.endswith(".ads"):
#                 for obj in unit.root.findall(lal.ObjectDecl):
#                     if self.is_global_object(obj):
#                         var_type = self.get_type(obj)

#                         for ident in obj.f_ids:
#                             name = ident.text
#                             if obj.f_has_constant.kind_name == "ConstantPresent":
#                                 global_constants[name] = var_type
#                             else:
#                                 global_nodes[name] = var_type

#         # --- Second pass: analyze each subprogram ---
#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "global_constants": {},
#                 "local_variables": {}
#             }

#             for subp in unit.root.findall(lal.SubpBody):
#                 subp_name = subp.f_subp_spec.f_subp_name.text

#                 # use dict instead of set
#                 file_vars["global_variables"][subp_name] = {}
#                 file_vars["global_constants"][subp_name] = {}
#                 file_vars["local_variables"][subp_name] = {}

#                 # Collect local variables WITH TYPE
#                 for obj in subp.findall(lal.ObjectDecl):
#                     var_type = self.get_type(obj)

#                     for ident in obj.f_ids:
#                         file_vars["local_variables"][subp_name][ident.text] = var_type

#                 # Check usage of global variables/constants
#                 for name_node in subp.findall(lal.Name):
#                     name_text = name_node.text

#                     if name_text in global_nodes:
#                         file_vars["global_variables"][subp_name][name_text] = global_nodes[name_text]

#                     elif name_text in global_constants:
#                         file_vars["global_constants"][subp_name][name_text] = global_constants[name_text]

#             result[unit.filename] = file_vars

#         return result

# test*************************************


# import os
# import libadalang as lal


# # ---------------------------
# # Collect Ada files
# # ---------------------------
# def collect_ada_files(path):
#     ada_files = []

#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)

#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")

#     return ada_files


# # ---------------------------
# # Analyzer
# # ---------------------------
# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units
#         self.type_defs = self.collect_type_defs()

#     # ---------------------------
#     # GLOBAL CHECK
#     # ---------------------------
#     @staticmethod
#     def is_global_object(obj):
#         parent = obj.parent
#         while parent:
#             if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#                 return False
#             parent = parent.parent
#         return True


#     @staticmethod
#     def get_type(node):
#         try:
#             if node.f_type_expr:
#                 declared = node.f_type_expr.text
#             else:
#                 declared = "Unknown"
#         except:
#             declared = "Unknown"
    
#         try:
#             resolved = node.p_type
#             if resolved and hasattr(resolved, "name") and resolved.name:
#                 return resolved.name.text
#         except:
#             pass
        
#         return declared

#     # ---------------------------
#     # COLLECT TYPE DEFINITIONS
#     # ---------------------------
    
#     def collect_type_defs(self):
#         type_defs = {}

#         for unit in self.units:
#             if not unit.root:
#                 continue

#             for td in unit.root.findall(lal.TypeDecl):

#                 if not td or not td.f_name:
#                     continue

#                 type_name = td.f_name.text

#                 try:
#                     tdef = td.f_type_def

#                     # ---------------------------
#                     # RECORD TYPE
#                     # ---------------------------
#                     if isinstance(tdef, lal.RecordTypeDef):
#                         fields = {}

#                         for comp in tdef.findall(lal.ComponentDecl):
#                             if not comp.f_component_def:
#                                 continue

#                             ftype = (
#                                 comp.f_component_def.f_type_expr.text
#                                 if comp.f_component_def.f_type_expr
#                                 else "Unknown"
#                             )

#                             for name in comp.f_ids:
#                                 fields[name.text] = ftype

#                         type_defs[type_name] = {
#                             "kind": "record",
#                             "fields": fields
#                         }

#                     # ---------------------------
#                     # ARRAY TYPE
#                     # ---------------------------
#                     elif isinstance(tdef, lal.ArrayTypeDef):
#                         try:
#                             elem = tdef.f_component_type.f_type_expr.text
#                         except:
#                             elem = "Unknown"

#                         type_defs[type_name] = {
#                             "kind": "array",
#                             "element": elem
#                         }

#                     # ---------------------------
#                     # ALIAS / DERIVED
#                     # ---------------------------
#                     else:
#                         try:
#                             base = td.p_type.name.text
#                         except:
#                             base = "Unknown"

#                         type_defs[type_name] = {
#                             "kind": "alias",
#                             "base": base
#                         }

#                 except:
#                     type_defs[type_name] = {"kind": "unknown"}

#         return type_defs

#     #  return type_name
#     def resolve_full_type(self, type_name, depth=0):
#         if not type_name or depth > 5:
#             return type_name or "Unknown"

#         if type_name not in self.type_defs:
#             return type_name

#         entry = self.type_defs[type_name]

#         # ---------------------------
#         # ALIAS
#         # ---------------------------
#         if entry["kind"] == "alias":
#             return {
#                 type_name: self.resolve_full_type(entry["base"], depth + 1)
#             }

#         # ---------------------------
#         # ARRAY
#         # ---------------------------
#         elif entry["kind"] == "array":
#             return {
#                 type_name: self.resolve_full_type(entry["element"], depth + 1)
#             }

#         # ---------------------------
#         # RECORD
#         # ---------------------------
#         elif entry["kind"] == "record":
#             resolved_fields = {}

#             for f, t in entry["fields"].items():
#                 resolved_fields[f] = self.resolve_full_type(t, depth + 1)

#             return {type_name: resolved_fields}

#         return type_name

#     # ---------------------------
#     # GET FULL EXPRESSION TEXT
#     # ---------------------------
#     @staticmethod
#     def get_full_name(node):
#         try:
#             return node.text
#         except:
#             return None

#     # ---------------------------
#     # GET NODE TYPE SAFELY
#     # ---------------------------
#     @staticmethod
#     def get_node_type(node):
#         try:
#             typ = node.p_type
#             # return typ.name.text if typ else "Unknown"
#             if typ and hasattr(typ, "name") and typ.name:
#                 return self.resolve_full_type(typ.name.text)
#             return "Unknown"
#         except:
#             return "Unknown"
    
#     # ---------------------------
#     # MAIN EXTRACTION
#     # ---------------------------
#     def extract(self):
#         result = {}

#         global_vars = {}
#         global_consts = {}

#         # ---------------------------
#         # PASS 1: GLOBALS
#         # ---------------------------
#         for unit in self.units:
#             if unit.filename.endswith(".ads"):
#                 for obj in unit.root.findall(lal.ObjectDecl):
#                     if self.is_global_object(obj):
#                         base_type = self.get_type(obj)
#                         resolved_type = self.resolve_full_type(base_type)

#                         for ident in obj.f_ids:
#                             name = ident.text

#                             if obj.f_has_constant.kind_name == "ConstantPresent":
#                                 global_consts[name] = resolved_type
#                             else:
#                                 global_vars[name] = resolved_type
    
#         # ---------------------------
#         # PASS 2: SUBPROGRAMS
#         # ---------------------------
#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "global_constants": {},
#                 "local_variables": {}
#             }

#             for subp in unit.root.findall(lal.SubpBody):
#                 # subp_name = subp.f_subp_spec.f_subp_name.text
#                 subp_name = (
#                     subp.f_subp_spec.f_subp_name.text
#                     if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                     else "UNKNOWN_SUBP"
#                 )
#                 file_vars["global_variables"][subp_name] = {}
#                 file_vars["global_constants"][subp_name] = {}
#                 file_vars["local_variables"][subp_name] = {}

#                 # ---------------------------
#                 # LOCAL VARIABLES
#                 # ---------------------------
#                 for obj in subp.findall(lal.ObjectDecl):
#                     base_type = self.get_type(obj)
#                     resolved_type = self.resolve_full_type(base_type)

#                     for ident in obj.f_ids:
#                         file_vars["local_variables"][subp_name][ident.text] = resolved_type

#                 # ---------------------------
#                 # GLOBAL USAGE
#                 # ---------------------------
#                 for name_node in subp.findall(lal.Name):
#                     name = name_node.text

#                     if name in global_vars:
#                         file_vars["global_variables"][subp_name][name] = global_vars[name]

#                     elif name in global_consts:
#                         file_vars["global_constants"][subp_name][name] = global_consts[name]

#                 # ---------------------------
#                 # COMPLEX EXPRESSIONS (A(I).Field)
#                 # ---------------------------
        

#                 for node in subp.findall(lal.Expr):
#                      try:
#                          text = node.text
#                      except:
#                          continue
                     
#                      # Only keep meaningful expressions
#                      if "." in text or "(" in text:
#                          try:
#                              typ = node.p_type
#                             #  typ_name = typ.name.text if typ and typ.name else "Unknown"
#                              if typ and hasattr(typ, "name") and typ.name:
#                                  typ_name = self.resolve_full_type(typ.name.text)
#                              else:
#                                 typ_name = "Unknown"
#                          except:
#                              typ_name = "Unknown"

#                          file_vars["local_variables"][subp_name][text] = typ_name

#             result[unit.filename] = file_vars

#         return result


# # ---------------------------
# # RUNNER
# # ---------------------------
# def run_analysis(path):
#     ada_files = collect_ada_files(path)

#     ctx = lal.AnalysisContext()
#     units = []

#     for f in ada_files:
#         try:
#             unit = ctx.get_from_file(f)
#             if unit.root:
#                 units.append(unit)
#         except Exception as e:
#             print(f"Error parsing {f}: {e}")

#     analyzer = VariablesAnalyzer(units)
#     return analyzer.extract()


# # ---------------------------
# # ENTRY POINT
# # ---------------------------
# if __name__ == "__main__":
#     project_path = "/your/project/path"

#     result = run_analysis(project_path)

#     import json
#     print(json.dumps(result, indent=4))

#******************************************************************************
# Main ************************************************************************
#******************************************************************************

# import os
# import libadalang as lal
# import json

# # ---------------------------
# # Collect Ada files
# # ---------------------------
# def collect_ada_files(path):
#     ada_files = []
#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")
#     return ada_files


# # ---------------------------
# # Parse a type expression node into structured dict
# # ---------------------------
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


# # ---------------------------
# # Analyzer
# # ---------------------------
# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units
#         self.type_defs = self.collect_type_defs()

#     # ---------------------------
#     # GLOBAL CHECK
#     # ---------------------------
#     @staticmethod
#     def is_global_object(obj):
#         parent = obj.parent
#         while parent:
#             if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#                 return False
#             parent = parent.parent
#         return True

#     # ---------------------------
#     # COLLECT TYPE DEFINITIONS AND SUBTYPES
#     # ---------------------------
#     def collect_type_defs(self):
#         type_defs = {}

#         for unit in self.units:
#             if not unit.root:
#                 continue

#             # TYPE DECLARATIONS
#             for td in unit.root.findall(lal.TypeDecl):
#                 if not td or not td.f_name:
#                     continue
#                 type_name = td.f_name.text
#                 try:
#                     tdef = td.f_type_def

#                     if isinstance(tdef, lal.RecordTypeDef):
#                         fields = {}
#                         for comp in tdef.findall(lal.ComponentDecl):
#                             if not comp.f_component_def:
#                                 continue
#                             ftype = get_structured_type(comp.f_component_def)
#                             for name in comp.f_ids:
#                                 fields[name.text] = ftype
#                         type_defs[type_name] = {"kind": "record", "fields": fields}

#                     elif isinstance(tdef, lal.ArrayTypeDef):
#                         try:
#                             elem = parse_type_expr(tdef.f_component_type.f_type_expr)
#                         except Exception:
#                             elem = {"type": "Unknown"}
#                         indices = []
#                         try:
#                             for idx in tdef.f_indices.f_list:
#                                 indices.append(idx.text.strip())
#                         except Exception:
#                             pass
#                         type_defs[type_name] = {
#                             "kind": "array",
#                             "element": elem,
#                             "indices": indices
#                         }

#                     elif isinstance(tdef, lal.SignedIntTypeDef):
#                         try:
#                             r = tdef.f_range.f_range
#                             range_text = r.text.strip() if r else ""
#                             if range_text.lower().startswith("range "):
#                                 range_text = range_text[6:].strip()
#                             type_defs[type_name] = {
#                                 "kind": "integer",
#                                 "range": range_text
#                             }
#                         except Exception:
#                             type_defs[type_name] = {"kind": "integer"}

#                     elif isinstance(tdef, lal.ModIntTypeDef):
#                         try:
#                             mod = tdef.f_expr.text.strip()
#                             type_defs[type_name] = {"kind": "modular", "modulus": mod}
#                         except Exception:
#                             type_defs[type_name] = {"kind": "modular"}

#                     else:
#                         # Alias / derived
#                         try:
#                             base = td.p_type.p_defining_name.text
#                         except Exception:
#                             try:
#                                 base = tdef.text.strip() if tdef.text else "Unknown"
#                             except Exception:
#                                 base = "Unknown"
#                         type_defs[type_name] = {"kind": "alias", "base": base}

#                 except Exception:
#                     type_defs[type_name] = {"kind": "unknown"}

#             # SUBTYPE DECLARATIONS
#             for st in unit.root.findall(lal.SubtypeDecl):
#                 if not st.f_name:
#                     continue
#                 subtype_name = st.f_name.text
#                 try:
#                     parsed = parse_type_expr(st.f_type_expr)
#                     type_defs[subtype_name] = {"kind": "subtype", "resolved": parsed}
#                 except Exception:
#                     type_defs[subtype_name] = {"kind": "unknown"}

#         return type_defs

#     # ---------------------------
#     # RESOLVE TYPE NAME → structured dict
#     # ---------------------------
#     def resolve_type_name(self, type_name, depth=0):
#         if not type_name or depth > 10:
#             return {"type": type_name or "Unknown"}

#         if type_name not in self.type_defs:
#             return {"type": type_name}

#         entry = self.type_defs[type_name]
#         kind = entry.get("kind")

#         if kind == "alias":
#             base = entry.get("base", "Unknown")
#             inner = self.resolve_type_name(base, depth + 1)
#             return {type_name: inner}

#         elif kind == "subtype":
#             return {type_name: entry["resolved"]}

#         elif kind == "array":
#             elem = entry.get("element", {"type": "Unknown"})
#             if isinstance(elem, dict) and "type" in elem:
#                 resolved_elem = self.resolve_type_name(elem["type"], depth + 1)
#             else:
#                 resolved_elem = elem
#             return {
#                 type_name: {
#                     "type": "array",
#                     "element": resolved_elem,
#                     "indices": entry.get("indices", [])
#                 }
#             }

#         elif kind == "record":
#             resolved_fields = {}
#             for f, ftype in entry["fields"].items():
#                 if isinstance(ftype, dict) and "type" in ftype:
#                     t = ftype["type"]
#                     # If the type name exists in our defs, resolve it; else keep structured
#                     if t in self.type_defs:
#                         resolved_fields[f] = self.resolve_type_name(t, depth + 1)
#                     else:
#                         resolved_fields[f] = ftype
#                 else:
#                     resolved_fields[f] = ftype
#             return {type_name: resolved_fields}

#         elif kind in ("integer", "modular"):
#             result = {"type": type_name}
#             if "range" in entry:
#                 result["range"] = entry["range"]
#             if "modulus" in entry:
#                 result["modulus"] = entry["modulus"]
#             return result

#         return {"type": type_name}

#     # ---------------------------
#     # GET TYPE for a node (combines semantic + syntactic + registry)
#     # ---------------------------
#     def get_type(self, node):
#         # First try full semantic/syntactic structured parse
#         structured = get_structured_type(node)
#         base_type = structured.get("type", "Unknown")

#         # If we have extra info (range, etc.) already, trust it
#         if len(structured) > 1:
#             return structured

#         # Try to enrich from our type registry
#         resolved = self.resolve_type_name(base_type)
#         if resolved != {"type": base_type}:
#             return resolved

#         return structured

#     # ---------------------------
#     # MAIN EXTRACTION
#     # ---------------------------
#     def extract(self):
#         result = {}
#         global_vars = {}
#         global_consts = {}

#         # PASS 1: GLOBALS from .ads
#         for unit in self.units:
#             if unit.filename.endswith(".ads"):
#                 for obj in unit.root.findall(lal.ObjectDecl):
#                     if self.is_global_object(obj):
#                         resolved_type = self.get_type(obj)
#                         for ident in obj.f_ids:
#                             name = ident.text
#                             if obj.f_has_constant.kind_name == "ConstantPresent":
#                                 global_consts[name] = resolved_type
#                             else:
#                                 global_vars[name] = resolved_type

#         # PASS 2: SUBPROGRAMS
#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "global_constants": {},
#                 "local_variables": {}
#             }

#             for subp in unit.root.findall(lal.SubpBody):
#                 subp_name = (
#                     subp.f_subp_spec.f_subp_name.text
#                     if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                     else "UNKNOWN_SUBP"
#                 )
#                 file_vars["global_variables"][subp_name] = {}
#                 file_vars["global_constants"][subp_name] = {}
#                 file_vars["local_variables"][subp_name] = {}

#                 # LOCAL VARIABLES
#                 for obj in subp.findall(lal.ObjectDecl):
#                     resolved_type = self.get_type(obj)
#                     for ident in obj.f_ids:
#                         file_vars["local_variables"][subp_name][ident.text] = resolved_type

#                 # GLOBAL USAGE
#                 for name_node in subp.findall(lal.Name):
#                     name = name_node.text
#                     if name in global_vars:
#                         file_vars["global_variables"][subp_name][name] = global_vars[name]
#                     elif name in global_consts:
#                         file_vars["global_constants"][subp_name][name] = global_consts[name]

#             result[unit.filename] = file_vars

#         return result


# # ---------------------------
# # RUNNER
# # ---------------------------
# def run_analysis(project_path):
#     ctx = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([project_path]))
#     ada_files = collect_ada_files(project_path)

#     units = []
#     for f in ada_files:
#         try:
#             unit = ctx.get_from_file(f)
#             if unit.root:
#                 units.append(unit)
#         except Exception as e:
#             print(f"Error parsing {f}: {e}")

#     analyzer = VariablesAnalyzer(units)
#     return analyzer.extract()


# # ---------------------------
# # ENTRY POINT
# # ---------------------------
# if __name__ == "__main__":
#     project_path = "/your/project/path"
#     result = run_analysis(project_path)
#     print(json.dumps(result, indent=4))




# import os
# import libadalang as lal
# import json
# # from variables_analysis import VariablesAnalyzer
# # ---------------------------
# # Collect Ada files
# # ---------------------------
# def collect_ada_files(path):
#     ada_files = []
#     if os.path.isfile(path):
#         if path.endswith((".adb", ".ads")):
#             ada_files.append(path)
#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))
#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")
#     return ada_files


# # ---------------------------
# # Parse a type expression node into structured dict
# # ---------------------------
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
#     #result = resolve_p_type(node)
#     #if result and result.get("type") not in (None, "Unknown", ""):
#     #    return result

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


# # ---------------------------
# # Analyzer
# # ---------------------------
# class VariablesAnalyzer:
#     def __init__(self, units):
#         self.units = units
#         self.type_defs = self.collect_type_defs()

#     # ---------------------------
#     # GLOBAL CHECK
#     # ---------------------------
#     @staticmethod
#     def is_global_object(obj):
#         parent = obj.parent
#         while parent:
#             if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
#                 return False
#             parent = parent.parent
#         return True

#     # ---------------------------
#     # COLLECT TYPE DEFINITIONS AND SUBTYPES
#     # ---------------------------
#     def collect_type_defs(self):
#         type_defs = {}

#         for unit in self.units:
#             if not unit.root:
#                 continue

#             # TYPE DECLARATIONS
#             for td in unit.root.findall(lal.TypeDecl):
#                 if not td or not td.f_name:
#                     continue
#                 type_name = td.f_name.text
#                 try:
#                     tdef = td.f_type_def

#                     if isinstance(tdef, lal.RecordTypeDef):
#                         fields = {}
#                         for comp in tdef.findall(lal.ComponentDecl):
#                             if not comp.f_component_def:
#                                 continue
#                             ftype = get_structured_type(comp.f_component_def)
#                             for name in comp.f_ids:
#                                 fields[name.text] = ftype
#                         type_defs[type_name] = {"kind": "record", "fields": fields}

#                     elif isinstance(tdef, lal.ArrayTypeDef):
#                         try:
#                             elem = parse_type_expr(tdef.f_component_type.f_type_expr)
#                         except Exception:
#                             elem = {"type": "Unknown"}
#                         indices = []
#                         try:
#                             for idx in tdef.f_indices.f_list:
#                                 indices.append(idx.text.strip())
#                         except Exception:
#                             pass
#                         type_defs[type_name] = {
#                             "kind": "array",
#                             "element": elem,
#                             "indices": indices
#                         }

#                     elif isinstance(tdef, lal.SignedIntTypeDef):
#                         try:
#                             r = tdef.f_range.f_range
#                             range_text = r.text.strip() if r else ""
#                             if range_text.lower().startswith("range "):
#                                 range_text = range_text[6:].strip()
#                             type_defs[type_name] = {
#                                 "kind": "integer",
#                                 "range": range_text
#                             }
#                         except Exception:
#                             type_defs[type_name] = {"kind": "integer"}

#                     elif isinstance(tdef, lal.ModIntTypeDef):
#                         try:
#                             mod = tdef.f_expr.text.strip()
#                             type_defs[type_name] = {"kind": "modular", "modulus": mod}
#                         except Exception:
#                             type_defs[type_name] = {"kind": "modular"}

#                     else:
#                         # Alias / derived
#                         try:
#                             base = td.p_type.p_defining_name.text
#                         except Exception:
#                             try:
#                                 base = tdef.text.strip() if tdef.text else "Unknown"
#                             except Exception:
#                                 base = "Unknown"
#                         type_defs[type_name] = {"kind": "alias", "base": base}

#                 except Exception:
#                     type_defs[type_name] = {"kind": "unknown"}

#             # SUBTYPE DECLARATIONS
#             for st in unit.root.findall(lal.SubtypeDecl):
#                 if not st.f_name:
#                     continue
#                 subtype_name = st.f_name.text
#                 try:
#                     parsed = parse_type_expr(st.f_type_expr)
#                     type_defs[subtype_name] = {"kind": "subtype", "resolved": parsed}
#                 except Exception:
#                     type_defs[subtype_name] = {"kind": "unknown"}

#         return type_defs

#     # ---------------------------
#     # RESOLVE TYPE NAME → structured dict
#     # ---------------------------
#     def resolve_type_name(self, type_name, depth=0):
#         if not type_name or depth > 10:
#             return {"type": type_name or "Unknown"}

#         if type_name not in self.type_defs:
#             return {"type": type_name}

#         entry = self.type_defs[type_name]
#         kind = entry.get("kind")

#         if kind == "alias":
#             base = entry.get("base", "Unknown")
#             inner = self.resolve_type_name(base, depth + 1)
#             return {type_name: inner}

#         elif kind == "subtype":
#             return {type_name: entry["resolved"]}

#         elif kind == "array":
#             elem = entry.get("element", {"type": "Unknown"})
#             if isinstance(elem, dict) and "type" in elem:
#                 resolved_elem = self.resolve_type_name(elem["type"], depth + 1)
#             else:
#                 resolved_elem = elem
#             return {
#                 type_name: {
#                     "type": "array",
#                     "element": resolved_elem,
#                     "indices": entry.get("indices", [])
#                 }
#             }

#         elif kind == "record":
#             resolved_fields = {}
#             for f, ftype in entry["fields"].items():
#                 if isinstance(ftype, dict) and "type" in ftype:
#                     t = ftype["type"]
#                     # If the type name exists in our defs, resolve it; else keep structured
#                     if t in self.type_defs:
#                         resolved_fields[f] = self.resolve_type_name(t, depth + 1)
#                     else:
#                         resolved_fields[f] = ftype
#                 else:
#                     resolved_fields[f] = ftype
#             return {type_name: resolved_fields}

#         elif kind in ("integer", "modular"):
#             result = {"type": type_name}
#             if "range" in entry:
#                 result["range"] = entry["range"]
#             if "modulus" in entry:
#                 result["modulus"] = entry["modulus"]
#             return result

#         return {"type": type_name}

#     # ---------------------------
#     # GET TYPE for a node (combines semantic + syntactic + registry)
#     # ---------------------------
#     def get_type(self, node):
#         # First try full semantic/syntactic structured parse
#         structured = get_structured_type(node)
#         base_type = structured.get("type", "Unknown")

#         # If we have extra info (range, etc.) already, trust it
#         if len(structured) > 1:
#             return structured

#         # Try to enrich from our type registry
#         resolved = self.resolve_type_name(base_type)
#         if resolved != {"type": base_type}:
#             return resolved

#         return structured
    
#     # ---------------------------
#     # Optimization for Nested or if/else condtion 
#     # ---------------------------
#     def get_full_type_from_usage(self,node):
#         try:
#             typ = node.p_type
#             if typ and typ.p_defining_name:
#                 return{"type": typ.p_defining_name.text}
#         except Exception:
#             pass
#         return None

#     # ---------------------------
#     # MAIN EXTRACTION
#     # ---------------------------
#     def extract(self):
#         result = {}
#         global_vars = {}
#         global_consts = {}

#         # PASS 1: GLOBALS from .ads
#         for unit in self.units:
#             if unit.filename.endswith(".ads"):
#                 for obj in unit.root.findall(lal.ObjectDecl):
#                     if self.is_global_object(obj):
#                         resolved_type = self.get_type(obj)
#                         for ident in obj.f_ids:
#                             name = ident.text
#                             if obj.f_has_constant.kind_name == "ConstantPresent":
#                                 global_consts[name] = resolved_type
#                             else:
#                                 global_vars[name] = resolved_type

#         # PASS 2: SUBPROGRAMS
#         for unit in self.units:
#             file_vars = {
#                 "global_variables": {},
#                 "global_constants": {},
#                 "local_variables": {}
#             }

#             for subp in unit.root.findall(lal.SubpBody):
#                 subp_name = (
#                     subp.f_subp_spec.f_subp_name.text
#                     if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
#                     else "UNKNOWN_SUBP"
#                 )
#                 file_vars["global_variables"][subp_name] = {}
#                 file_vars["global_constants"][subp_name] = {}
#                 file_vars["local_variables"][subp_name] = {}

#                 # LOCAL VARIABLES
#                 for obj in subp.findall(lal.ObjectDecl):
#                     resolved_type = self.get_type(obj)
#                     for ident in obj.f_ids:
#                         file_vars["local_variables"][subp_name][ident.text] = resolved_type

#                 # GLOBAL USAGE
#                 for name_node in subp.findall(lal.Expr):
#                     text = name_node.text.strip()
#                     if not text or len(text) >100:
#                         continue
#                     resolved = self.get_full_type_from_usage(name_node)
#                     if resolved:
#                         file_vars["global_variables"][subp_name][text] = resolved
#                         continue
#                     if isinstance(name_node, lal.Name):
#                         name = text 
#                         if name in global_vars:
#                             ##file_vars["global_constants"][subp_name][name] = global_vars[name]
#                             file_vars["global_variables"][subp_name][name] = global_vars[name]
#                         elif name in global_consts:
#                             file_vars["global_constants"][subp_name][name] = global_consts[name]


#                     # name = name_node.text
#                     # if name in global_vars:
#                     #     file_vars["global_variables"][subp_name][name] = global_vars[name]
#                     # elif name in global_consts:
#                     #     file_vars["global_constants"][subp_name][name] = global_consts[name]

#             result[unit.filename] = file_vars

#         return result


# # ---------------------------
# # RUNNER
# # ---------------------------
# def run_analysis(project_path):
#     ctx = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([project_path]))
#     ada_files = collect_ada_files(project_path)

#     units = []
#     for f in ada_files:
#         try:
#             unit = ctx.get_from_file(f)
#             if unit.root:
#                 units.append(unit)
#         except Exception as e:
#             print(f"Error parsing {f}: {e}")

#     analyzer = VariablesAnalyzer(units)
#     return analyzer.extract()


# # ---------------------------
# # ENTRY POINT
# # ---------------------------
# if __name__ == "__main__":
#     project_path = "/your/project/path"
#     result = run_analysis(project_path)
#     print(json.dumps(result, indent=4))


###########################################
#Test for caseinsitive
###########################################

import os
import libadalang as lal
import json

ADA_EXTENSIONS = {".adb", ".ads", ".ada"}

def collect_ada_files(path):
    ada_files = []
    seen = set()
    root = Path(path).resolve() if hasattr(path, '__fspath__') else os.path.realpath(path)

    if os.path.isfile(path):
        if os.path.splitext(path)[1].lower() in ADA_EXTENSIONS:
            ada_files.append(path)
        return ada_files

    if not os.path.isdir(path):
        raise FileNotFoundError(f"Invalid path: {path}")

    for dirpath, dirnames, filenames in os.walk(path, followlinks=True):
        dirnames.sort()
        filenames.sort()
        real_dir = os.path.realpath(dirpath)
        if real_dir in seen:
            dirnames.clear()
            continue
        seen.add(real_dir)

        for filename in filenames:
            if os.path.splitext(filename)[1].lower() in ADA_EXTENSIONS:
                full = os.path.join(dirpath, filename)
                real = os.path.realpath(full)
                if real not in seen:
                    seen.add(real)
                    ada_files.append(full)

    return ada_files


def parse_type_expr(node):
    if node is None:
        return {"type": "Unknown"}

    text = node.text.strip() if node.text else ""

    if isinstance(node, lal.SubtypeIndication):
        base = node.f_name.text.strip() if node.f_name else text
        constraint = node.f_constraint

        if constraint is not None:
            if isinstance(constraint, lal.RangeConstraint):
                r = constraint.f_range
                range_text = r.text.strip() if r else ""
                if range_text.lower().startswith("range "):
                    range_text = range_text[6:].strip()
                return {"type": base, "range": range_text}

            elif isinstance(constraint, lal.DigitsConstraint):
                digits = constraint.f_digits.text.strip() if constraint.f_digits else ""
                result = {"type": base, "digits": digits}
                if constraint.f_range:
                    r_text = constraint.f_range.text.strip()
                    if r_text.lower().startswith("range "):
                        r_text = r_text[6:].strip()
                    result["range"] = r_text
                return result

            elif isinstance(constraint, lal.DeltaConstraint):
                delta = constraint.f_delta.text.strip() if constraint.f_delta else ""
                result = {"type": base, "delta": delta}
                if constraint.f_range:
                    r_text = constraint.f_range.text.strip()
                    if r_text.lower().startswith("range "):
                        r_text = r_text[6:].strip()
                    result["range"] = r_text
                return result

            elif isinstance(constraint, lal.IndexConstraint):
                indices = [c.text.strip() for c in constraint.f_list if c.text]
                return {"type": base, "index_constraint": indices}

            elif isinstance(constraint, lal.DiscriminantConstraint):
                assocs = [a.text.strip() for a in constraint.f_constraints if a.text]
                return {"type": base, "discriminant_constraint": assocs}

        return {"type": base}

    if isinstance(node, lal.AnonymousType):
        if node.f_type_decl:
            return parse_type_def_node(node.f_type_decl.f_type_def)
        return {"type": text or "Unknown"}

    if text:
        return {"type": text}
    return {"type": "Unknown"}


def parse_type_def_node(tdef):
    if tdef is None:
        return {"type": "Unknown"}

    if isinstance(tdef, lal.ArrayTypeDef):
        try:
            elem = parse_type_expr(tdef.f_component_type.f_type_expr)
        except Exception:
            elem = {"type": "Unknown"}
        indices = []
        try:
            for idx in tdef.f_indices.f_list:
                indices.append(idx.text.strip())
        except Exception:
            pass
        return {"type": "array", "element": elem, "indices": indices}

    if isinstance(tdef, lal.RecordTypeDef):
        return {"type": "record"}

    return {"type": tdef.text.strip() if tdef.text else "Unknown"}


def resolve_p_type(node):
    try:
        typ = node.p_type
        if typ is None:
            return None
        name = typ.p_defining_name
        if name is None:
            return None
        base_name = name.text.strip()

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


def get_structured_type(node):
    try:
        type_expr = node.f_type_expr
        if type_expr:
            parsed = parse_type_expr(type_expr)
            if parsed.get("type") not in (None, "Unknown", ""):
                return parsed
    except Exception:
        pass

    try:
        if node.f_type_expr and node.f_type_expr.text:
            return {"type": node.f_type_expr.text.strip()}
    except Exception:
        pass

    return {"type": "Unknown"}


class VariablesAnalyzer:
    def __init__(self, units):
        self.units = units
        self.type_defs = self.collect_type_defs()

    @staticmethod
    def is_global_object(obj):
        parent = obj.parent
        while parent:
            if isinstance(parent, (lal.SubpBody, lal.SubpDecl, lal.BlockStmt)):
                return False
            parent = parent.parent
        return True

    def collect_type_defs(self):
        type_defs = {}

        for unit in self.units:
            if not unit.root:
                continue

            for td in unit.root.findall(lal.TypeDecl):
                if not td or not td.f_name:
                    continue
                # ✅ Normalize to lowercase key
                type_name = td.f_name.text
                key = type_name.lower()
                try:
                    tdef = td.f_type_def

                    if isinstance(tdef, lal.RecordTypeDef):
                        fields = {}
                        for comp in tdef.findall(lal.ComponentDecl):
                            if not comp.f_component_def:
                                continue
                            ftype = get_structured_type(comp.f_component_def)
                            for name in comp.f_ids:
                                fields[name.text.lower()] = ftype
                        type_defs[key] = {"kind": "record", "fields": fields}

                    elif isinstance(tdef, lal.ArrayTypeDef):
                        try:
                            elem = parse_type_expr(tdef.f_component_type.f_type_expr)
                        except Exception:
                            elem = {"type": "Unknown"}
                        indices = []
                        try:
                            for idx in tdef.f_indices.f_list:
                                indices.append(idx.text.strip())
                        except Exception:
                            pass
                        type_defs[key] = {
                            "kind": "array",
                            "element": elem,
                            "indices": indices
                        }

                    elif isinstance(tdef, lal.SignedIntTypeDef):
                        try:
                            r = tdef.f_range.f_range
                            range_text = r.text.strip() if r else ""
                            if range_text.lower().startswith("range "):
                                range_text = range_text[6:].strip()
                            type_defs[key] = {"kind": "integer", "range": range_text}
                        except Exception:
                            type_defs[key] = {"kind": "integer"}

                    elif isinstance(tdef, lal.ModIntTypeDef):
                        try:
                            mod = tdef.f_expr.text.strip()
                            type_defs[key] = {"kind": "modular", "modulus": mod}
                        except Exception:
                            type_defs[key] = {"kind": "modular"}

                    else:
                        try:
                            base = td.p_type.p_defining_name.text
                        except Exception:
                            try:
                                base = tdef.text.strip() if tdef.text else "Unknown"
                            except Exception:
                                base = "Unknown"
                        type_defs[key] = {"kind": "alias", "base": base}

                except Exception:
                    type_defs[key] = {"kind": "unknown"}

            for st in unit.root.findall(lal.SubtypeDecl):
                if not st.f_name:
                    continue
                # ✅ Normalize to lowercase key
                subtype_name = st.f_name.text
                key = subtype_name.lower()
                try:
                    parsed = parse_type_expr(st.f_type_expr)
                    type_defs[key] = {"kind": "subtype", "resolved": parsed}
                except Exception:
                    type_defs[key] = {"kind": "unknown"}

        return type_defs

    def resolve_type_name(self, type_name, depth=0):
        if not type_name or depth > 10:
            return {"type": type_name or "Unknown"}

        # ✅ Normalize lookup key, preserve original for output
        key = type_name.lower()

        if key not in self.type_defs:
            return {"type": type_name}

        entry = self.type_defs[key]
        kind = entry.get("kind")

        if kind == "alias":
            base = entry.get("base", "Unknown")
            inner = self.resolve_type_name(base, depth + 1)
            return {type_name: inner}

        elif kind == "subtype":
            return {type_name: entry["resolved"]}

        elif kind == "array":
            elem = entry.get("element", {"type": "Unknown"})
            if isinstance(elem, dict) and "type" in elem:
                resolved_elem = self.resolve_type_name(elem["type"], depth + 1)
            else:
                resolved_elem = elem
            return {
                type_name: {
                    "type": "array",
                    "element": resolved_elem,
                    "indices": entry.get("indices", [])
                }
            }

        elif kind == "record":
            resolved_fields = {}
            for f, ftype in entry["fields"].items():
                if isinstance(ftype, dict) and "type" in ftype:
                    # ✅ Normalize field type lookup
                    t = ftype["type"].lower()
                    if t in self.type_defs:
                        resolved_fields[f] = self.resolve_type_name(ftype["type"], depth + 1)
                    else:
                        resolved_fields[f] = ftype
                else:
                    resolved_fields[f] = ftype
            return {type_name: resolved_fields}

        elif kind in ("integer", "modular"):
            result = {"type": type_name}
            if "range" in entry:
                result["range"] = entry["range"]
            if "modulus" in entry:
                result["modulus"] = entry["modulus"]
            return result

        return {"type": type_name}

    def get_type(self, node):
        structured = get_structured_type(node)
        base_type = structured.get("type", "Unknown")

        if len(structured) > 1:
            return structured

        # ✅ Normalize before resolving
        resolved = self.resolve_type_name(base_type.lower())
        if resolved != {"type": base_type.lower()}:
            return resolved

        return structured

    def get_full_type_from_usage(self, node):
        try:
            typ = node.p_type
            if typ and typ.p_defining_name:
                return {"type": typ.p_defining_name.text}
        except Exception:
            pass
        return None

    def extract(self):
        result = {}
        global_vars = {}
        global_consts = {}

        # PASS 1: GLOBALS from .ads — store with lowercase keys
        for unit in self.units:
            if unit.filename.endswith(".ads"):
                for obj in unit.root.findall(lal.ObjectDecl):
                    if self.is_global_object(obj):
                        resolved_type = self.get_type(obj)
                        for ident in obj.f_ids:
                            name = ident.text
                            # ✅ Store with lowercase key
                            if obj.f_has_constant.kind_name == "ConstantPresent":
                                global_consts[name.lower()] = resolved_type
                            else:
                                global_vars[name.lower()] = resolved_type

        # PASS 2: SUBPROGRAMS
        for unit in self.units:
            file_vars = {
                "global_variables": {},
                "global_constants": {},
                "local_variables": {}
            }

            for subp in unit.root.findall(lal.SubpBody):
                subp_name = (
                    subp.f_subp_spec.f_subp_name.text
                    if subp.f_subp_spec and subp.f_subp_spec.f_subp_name
                    else "UNKNOWN_SUBP"
                )
                file_vars["global_variables"][subp_name] = {}
                file_vars["global_constants"][subp_name] = {}
                file_vars["local_variables"][subp_name] = {}

                for obj in subp.findall(lal.ObjectDecl):
                    resolved_type = self.get_type(obj)
                    for ident in obj.f_ids:
                        file_vars["local_variables"][subp_name][ident.text] = resolved_type

                for name_node in subp.findall(lal.Expr):
                    text = name_node.text.strip()
                    if not text or len(text) > 100:
                        continue
                    resolved = self.get_full_type_from_usage(name_node)
                    if resolved:
                        file_vars["global_variables"][subp_name][text] = resolved
                        continue
                    if isinstance(name_node, lal.Name):
                        # ✅ Normalize lookup, preserve original name in output
                        name_key = text.lower()
                        if name_key in global_vars:
                            file_vars["global_variables"][subp_name][text] = global_vars[name_key]
                        elif name_key in global_consts:
                            file_vars["global_constants"][subp_name][text] = global_consts[name_key]

            result[unit.filename] = file_vars

        return result


def run_analysis(project_path):
    ctx = lal.AnalysisContext(unit_provider=lal.UnitProvider.auto([project_path]))
    ada_files = collect_ada_files(project_path)

    units = []
    for f in ada_files:
        try:
            unit = ctx.get_from_file(f)
            if unit.root:
                units.append(unit)
        except Exception as e:
            print(f"Error parsing {f}: {e}")

    analyzer = VariablesAnalyzer(units)
    return analyzer.extract()


if __name__ == "__main__":
    project_path = "/your/project/path"
    result = run_analysis(project_path)
    print(json.dumps(result, indent=4))