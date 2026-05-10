# harness_generator.py
# Generates Ada test harness procedure templates from the subprogram index.

class TestHarnessGenerator:
    """
    Generates test harness Ada procedure stubs for every subprogram
    found in the subprogram_index produced by SubprogramIndexer.

    subprogram_index format (from indexer.py):
    {
        "file.adb": [
            {
                "name": "Add",
                "parameters": ["A, B : Integer"],
                "return_type": "Integer",   # None for procedures
                "start_line": 2,
                "end_line": 5
            },
            ...
        ]
    }
    """

    def __init__(self, subprogram_index: dict):
        self.subprogram_index = subprogram_index

    def generate(self) -> dict:
        harness_data = {}

        for filename, subprograms in self.subprogram_index.items():
            harness_data[filename] = []

            for sub in subprograms:
                name = sub.get("name", "Unknown")
                return_type = sub.get("return_type")          # None → procedure
                parameters = sub.get("parameters", [])        # list of "Name : Type" strings
                is_function = return_type is not None and return_type.strip() != ""

                test_name = f"Test_{name}"

                # Build parameter declarations for the harness
                param_decls = []
                param_names = []
                for param_str in parameters:
                    # param_str looks like "A, B : Integer" or "X : in out Float"
                    parts = param_str.split(":")
                    if len(parts) >= 2:
                        names_part = parts[0].strip()
                        type_part = ":".join(parts[1:]).strip()
                        # Strip mode keywords (in, out, in out)
                        import re
                        type_clean = re.sub(r"^\s*(in\s+out|in|out)\s+", "", type_part, flags=re.IGNORECASE).strip()
                        for n in names_part.split(","):
                            n = n.strip()
                            if n:
                                param_decls.append(f"   {n} : {type_clean} := <>;")
                                param_names.append(n)
                    else:
                        # Fallback: use raw string
                        param_decls.append(f"   -- param: {param_str}")

                param_decl_block = "\n".join(param_decls) if param_decls else "   -- No parameters"
                param_call = ", ".join(param_names) if param_names else ""

                if is_function:
                    template = (
                        f"procedure {test_name} is\n"
                        f"   -- Input parameters\n"
                        f"{param_decl_block}\n"
                        f"   Result : {return_type};\n"
                        f"begin\n"
                        f"   -- TODO: set input values\n"
                        f"   Result := {name}({param_call});\n"
                        f"   -- TODO: assert Result = expected_value\n"
                        f"end {test_name};"
                    )
                else:
                    template = (
                        f"procedure {test_name} is\n"
                        f"   -- Input parameters\n"
                        f"{param_decl_block}\n"
                        f"begin\n"
                        f"   -- TODO: set input values\n"
                        f"   {name}({param_call});\n"
                        f"   -- TODO: assert expected side effects\n"
                        f"end {test_name};"
                    )

                harness_data[filename].append({
                    "test_name": test_name,
                    "original_subprogram": name,
                    "is_function": is_function,
                    "return_type": return_type,
                    "parameters": parameters,
                    "template": template,
                })

        return harness_data
