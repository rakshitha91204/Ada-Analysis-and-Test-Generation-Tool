# exception_analysis.py — exception handler detection.
import libadalang as lal


class ExceptionAnalyzer:
    def __init__(self, units):
        self.units = units

    def detect(self) -> dict:
        """
        Returns flat dict: { "SubpName": int_handler_count, ... }
        The frontend reads exceptions_info as Record<string, number>.
        """
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                count = len(list(subp.findall(lal.ExceptionHandler)))
                result[subp_name] = count

        return result
