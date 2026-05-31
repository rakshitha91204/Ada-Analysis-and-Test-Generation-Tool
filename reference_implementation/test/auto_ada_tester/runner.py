# # runner.py
# import sys
# from analyzer.project_loader import ProjectLoader
# from analyzer.indexer import SubprogramIndexer
# from analyzer.callgraph import CallGraphBuilder
# from analyzer.globals_analysis import GlobalRWDetector
# from analyzer.complexity import ComplexityAnalyzer
# from analyzer.deadcode import DeadCodeDetector
# from output_writer import OutputWriter
# # ROOT = Path(__file__).resolve().parents[2]
# # if str(ROOT) not in sys.path:
# #     sys.path.insert(0, str(ROOT))
# def run_analysis(files):

#     loader = ProjectLoader(files)
#     units = loader.load_units()

#     indexer = SubprogramIndexer(units)
#     subprograms = indexer.index()

#     callgraph = CallGraphBuilder(units).build()
#     globals_rw = GlobalRWDetector(units).detect()
#     complexity = ComplexityAnalyzer(units).compute()

#     deadcode = DeadCodeDetector(callgraph).detect_unused_subprograms()

#     output = {
#         "subprogram_index": subprograms,
#         "call_graph": callgraph,
#         "global_read_write": globals_rw,
#         "cyclomatic_complexity": complexity,
#         "dead_code": deadcode
#     }

#     OutputWriter().write(output)


# runner.py

# import os
# import sys
# from pathlib import Path
# from analyzer.project_loader import ProjectLoader
# from analyzer.indexer import SubprogramIndexer
# from analyzer.callgraph import CallGraphBuilder
# from analyzer.globals_analysis import GlobalRWDetector
# from analyzer.complexity import ComplexityAnalyzer
# from analyzer.deadcode import DeadCodeDetector
# from output_writer import OutputWriter
# from analyzer.control_flow_extractor import ControlFlowExtractor
# ROOT = Path(__file__).resolve().parents[2]
# if str(ROOT) not in sys.path:
#     sys.path.insert(0, str(ROOT))

# from analyzer.variables_analysis import VariablesAnalyzer
# from analyzer.loop_analysis import LoopAnalyzer
# from analyzer.exception_analysis import ExceptionAnalyzer
# from analyzer.concurrency import ConcurrencyAnalyzer
# from analyzer.logical_error import LogicalErrorDetector
# from analyzer.performance import PerformanceAnalyzer

# from generators.harness_generator import TestHarnessGenerator
# from generators.mock_generator import MockStubGenerator
# # from generators.
# # ==============================
# # 🔥 GIVE YOUR ADA PATH HERE
# # ==============================
# # path = "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/"   # <-- CHANGE THIS

# # path = "/home/ssss/Desktop/Libadalang/unit_test/AdaScope/test/ada_files/attachments"
# # path = "/home/ssss/Desktop/Libada_test_project/Rakshitha/src"
# path = "/home/oops/Downloads/test"

# def collect_ada_files(path):
#     ada_files = []

#     if os.path.isfile(path):
#         ada_files.append(path)

#     elif os.path.isdir(path):
#         for root, _, files in os.walk(path):
#             for file in files:
#                 if file.endswith((".adb", ".ads")):
#                     ada_files.append(os.path.join(root, file))

#     else:
#         raise FileNotFoundError(f"Invalid path: {path}")

#     return ada_files


# def run_analysis(files):

#     loader = ProjectLoader(files)
#     units = loader.load_units()

#     subprograms = SubprogramIndexer(units).index()
#     callgraph = CallGraphBuilder(units).build()
#     globals_rw = GlobalRWDetector(units).detect()
#     complexity = ComplexityAnalyzer(units).compute()
#     deadcode = DeadCodeDetector(callgraph).detect_unused_subprograms()

#     variables_info = VariablesAnalyzer(units).extract()
#     control_flow_extractor = ControlFlowExtractor(units).run()
#     loops_info = LoopAnalyzer(units).detect()
#     exceptions_info = ExceptionAnalyzer(units).detect()
#     concurrency_info = ConcurrencyAnalyzer(units).analyze()
#     logical_errors = LogicalErrorDetector(units).detect()
#     performance_warnings = PerformanceAnalyzer(units).analyze()
#     test_harness_data = TestHarnessGenerator(subprograms).generate()
#     mock_stub_data = MockStubGenerator(callgraph).generate()


#     output = {
#         "file_paths": files,
#         "subprogram_index": subprograms,
#         "call_graph": callgraph,
#         "global_read_write": globals_rw,
#         "cyclomatic_complexity": complexity,
#         "dead_code": deadcode,
#         "variables_info": variables_info,
#         "control_flow_extractor": control_flow_extractor,
#         "loop_info": loops_info,
#         "exceptions_info": exceptions_info,
#         "cocurrency_info":concurrency_info,
#         "logical_errors": logical_errors,
#         "performance_warnings": performance_warnings,
#         "test_harness_data": test_harness_data,
#         "mock_stub_data": mock_stub_data,
        
#     }

#     OutputWriter().write(output)


# if __name__ == "__main__":

#     ada_files = collect_ada_files(path)

#     print(f"Found {len(ada_files)} Ada files.")
#     run_analysis(ada_files)

import os
import sys
from pathlib import Path
from analyzer.project_loader import ProjectLoader
from analyzer.indexer import SubprogramIndexer
from analyzer.callgraph import CallGraphBuilder
from analyzer.globals_analysis import GlobalRWDetector
from analyzer.complexity import ComplexityAnalyzer
from analyzer.deadcode import DeadCodeDetector
from output_writer import OutputWriter
from analyzer.control_flow_extractor import ControlFlowExtractor

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from analyzer.variables_analysis import VariablesAnalyzer
from analyzer.loop_analysis import LoopAnalyzer
from analyzer.exception_analysis import ExceptionAnalyzer
from analyzer.concurrency import ConcurrencyAnalyzer
from analyzer.logical_error import LogicalErrorDetector
from analyzer.performance import PerformanceAnalyzer

from generators.harness_generator import TestHarnessGenerator
from generators.mock_generator import MockStubGenerator

# ==============================
# 🔥 GIVE YOUR ADA PATH HERE
# ==============================
# path = "/home/oops/Desktop/email/test/auto_ada_tester/testada_caseinsensitive"
# path = "testada_caseinsensitive"
path = Path(__file__).parent / "testada_caseinsensitive"

# Ada file extensions to look for
ADA_EXTENSIONS = {".adb", ".ads", ".ada"}


def collect_ada_files(root_path: str) -> list[str]:
    """
    Recursively walks through any directory structure (including nested,
    symlinked, and mixed folders) and collects all Ada source files.

    Handles:
      - Single file input
      - Flat directories
      - Deeply nested project structures
      - Symlinked directories (followlinks=True)
      - Deduplication via seen set (avoids duplicates from symlinks)
    """
    ada_files = []
    seen = set()  # track resolved real paths to avoid duplicates from symlinks

    root = Path(root_path).resolve()

    # Case 1: Single file passed directly
    if root.is_file():
        if root.suffix.lower() in ADA_EXTENSIONS:
            ada_files.append(str(root))
        else:
            print(f"[WARNING] File '{root}' is not an Ada source file (skipping).")
        return ada_files

    # Case 2: Directory — walk recursively, follow symlinks
    if not root.is_dir():
        raise FileNotFoundError(f"[ERROR] Invalid path: {root_path}")

    print(f"[INFO] Scanning for Ada files under: {root}")

    for dirpath, dirnames, filenames in os.walk(root, followlinks=True):
        # Sort for deterministic ordering
        dirnames.sort()
        filenames.sort()

        current_dir = Path(dirpath).resolve()

        # Skip already-visited directories (handles symlink loops)
        if current_dir in seen:
            dirnames.clear()  # don't descend further
            continue
        seen.add(current_dir)

        for filename in filenames:
            file_path = Path(dirpath) / filename
            resolved = file_path.resolve()

            # Skip if already collected via another symlink path
            if resolved in seen:
                continue

            if file_path.suffix.lower() in ADA_EXTENSIONS:
                seen.add(resolved)
                ada_files.append(str(file_path))
                print(f"  [FOUND] {file_path}")

    return ada_files


def run_analysis(files: list[str]):
    loader = ProjectLoader(files)
    units = loader.load_units()

    subprograms = SubprogramIndexer(units).index()
    callgraph = CallGraphBuilder(units).build()
    globals_rw = GlobalRWDetector(units).detect()
    complexity = ComplexityAnalyzer(units).compute()
    deadcode = DeadCodeDetector(callgraph).detect_unused_subprograms()

    variables_info = VariablesAnalyzer(units).extract()
    control_flow_extractor = ControlFlowExtractor(units).run()
    loops_info = LoopAnalyzer(units).detect()
    exceptions_info = ExceptionAnalyzer(units).detect()
    concurrency_info = ConcurrencyAnalyzer(units).analyze()
    logical_errors = LogicalErrorDetector(units).detect()
    performance_warnings = PerformanceAnalyzer(units).analyze()
    test_harness_data = TestHarnessGenerator(subprograms).generate()
    mock_stub_data = MockStubGenerator(callgraph).generate()

    output = {
        "file_paths": files,
        "subprogram_index": subprograms,
        "call_graph": callgraph,
        "global_read_write": globals_rw,
        "cyclomatic_complexity": complexity,
        "dead_code": deadcode,
        "variables_info": variables_info,
        "control_flow_extractor": control_flow_extractor,
        "loop_info": loops_info,
        "exceptions_info": exceptions_info,
        "concurrency_info": concurrency_info,
        "logical_errors": logical_errors,
        "performance_warnings": performance_warnings,
        "test_harness_data": test_harness_data,
        "mock_stub_data": mock_stub_data,
    }

    OutputWriter().write(output)


if __name__ == "__main__":
    ada_files = collect_ada_files(path)

    if not ada_files:
        print("[WARNING] No Ada files found. Check your path.")
        sys.exit(1)

    print(f"\n[INFO] Found {len(ada_files)} Ada file(s). Starting analysis...\n")
    run_analysis(ada_files)