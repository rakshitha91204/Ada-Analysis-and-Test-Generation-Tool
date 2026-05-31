# harness_generator.py
import json
class TestHarnessGenerator:
    def generate_harness(json_file):
        with open(json_file) as f:
            analysis = json.load(f)

        for file_path, subprogs in analysis["subprogram_index"].items():
            for sub in subprogs:
                print(f"Generating harness for {sub['name']}...")
                # Use parameters and locals
                # Example: generate empty calls with default values
                for param in sub["parameters"]:
                    pass
    def __init__(self, subprogram_index):
        """
        subprogram_index expected format:
        {
            "file.adb": [
                {"name": "Proc1", "type": "procedure"},
                {"name": "Func1", "type": "function"}
            ]
        }
        """
        self.subprogram_index = subprogram_index

    def generate(self):
        harness_data = {}

        for filename, subprograms in self.subprogram_index.items():
            harness_data[filename] = []

            for sub in subprograms:
                name = sub.get("name")
                kind = sub.get("type")

                test_name = f"test_{name}"

                if kind == "function":
                    template = f"""
procedure {test_name} is
    Result : Integer;
begin
    -- TODO: Initialize inputs
    Result := {name}(...);
    -- TODO: Add assertions
end {test_name};
"""
                else:
                    template = f"""
procedure {test_name} is
begin
    -- TODO: Initialize inputs
    {name}(...);
    -- TODO: Add assertions
end {test_name};
"""

                harness_data[filename].append({
                    "test_name": test_name,
                    "original_subprogram": name,
                    "template": template.strip()
                })

        return harness_data