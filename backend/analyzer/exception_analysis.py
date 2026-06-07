# exception_analysis.py — detailed exception handler info.
import libadalang as lal


class ExceptionAnalyzer:
    def __init__(self, units):
        self.units = units

    def detect(self) -> dict:
        result = {}

        for unit in self.units:
            for subp in unit.root.findall(lal.SubpBody):
                try:
                    subp_name = subp.f_subp_spec.f_subp_name.text
                except Exception:
                    subp_name = "UNKNOWN"

                handlers_info = []
                for handler in subp.findall(lal.ExceptionHandler):
                    try:
                        line = handler.sloc_range.start.line
                    except Exception:
                        line = 0

                    exc_names = []
                    is_catch_all = False
                    try:
                        for exc in handler.f_exc_name:
                            txt = exc.text.strip()
                            exc_names.append(txt)
                            if txt.lower() == "others":
                                is_catch_all = True
                        if not exc_names:
                            is_catch_all = True
                    except Exception:
                        is_catch_all = True

                    is_silent = False
                    try:
                        stmts = list(handler.f_stmts)
                        if len(stmts) == 1 and isinstance(stmts[0], lal.NullStmt):
                            is_silent = True
                    except Exception:
                        pass

                    handlers_info.append({
                        "line":         line,
                        "exceptions":   exc_names if exc_names else ["others"],
                        "is_catch_all": is_catch_all,
                        "is_silent":    is_silent,
                    })

                if handlers_info:
                    key = f"{unit.filename}::{subp_name}"
                    result[key] = {
                        "subprogram":    subp_name,
                        "file":          unit.filename,
                        "handler_count": len(handlers_info),
                        "handlers":      handlers_info,
                    }
                # Legacy compat: flat count by subp name
                result[subp_name] = len(handlers_info)

        return result
