import libadalang as lal
class LogicalErrorDetector:
    def __init__(self, units):
        self.units = units

    def detect(self):
        issues = []

        for unit in self.units:
            for div in unit.root.findall(lal.BinOp):
                if div.f_op.text == "/" and div.f_right.text == "0":
                    issues.append("Possible division by zero")

        return issues

# import libadalang as lal

# class LogicalErrorDetector:
#     def __init__(self, units):
#         self.units = units

#     def detect(self):
#         issues = []

#         for unit in self.units:
#             for div in unit.root.findall(lal.BinOp):
#                 # Ensure this is a division operator
#                 if div.f_op.text == "/":
#                     right = div.f_right
#                     # Check if the right-hand side is a numeric literal
#                     if hasattr(right, "f_val") and right.f_val == "0":
#                         issues.append(f"Possible division by zero in {unit.unit_name}")
#                     # Optional: handle float literals too
#                     elif hasattr(right, "f_val") and right.f_val in ("0.0", "0.0E0"):
#                         issues.append(f"Possible division by zero in {unit.unit_name}")

#         return issues