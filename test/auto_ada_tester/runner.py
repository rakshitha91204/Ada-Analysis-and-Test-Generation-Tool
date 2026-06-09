# runner.py — Ada static analysis runner.
import os
import sys
from pathlib import Path

from analyzer.project_loader import ProjectLoader
from analyzer.indexer import SubprogramIndexer
from analyzer.callgraph import CallGraphBuilder
from analyzer.globals_analysis import GlobalRWDetector
from analyzer.complexity import ComplexityAnalyzer
from analyzer.deadcode import DeadCodeDetector
from analyzer.control_flow_extractor import ControlFlowExtractor
from analyzer.variables_analysis import VariablesAnalyzer
from analyzer.loop_analysis import LoopAnalyzer
from analyzer.exception_analysis import ExceptionAnalyzer
from analyzer.concurrency import ConcurrencyAnalyzer
from analyzer.logical_error import LogicalErrorDetector
from analyzer.performance import PerformanceAnalyzer
from generators.harness_generator import TestHarnessGenerator
from generators.mock_generator import MockStubGenerator
from output_writer import OutputWriter

ADA_EXTENSIONS = {".adb", ".ads", ".ada"}


def collect_ada_files(root_path: str) -> list:
    """Recursively collect all Ada source files, deduplicating via realpath."""
    ada_files = []
    seen = set()
    root = Path(root_path).resolve()

    if root.is_file():
        if root.suffix.lower() in ADA_EXTENSIONS:
            ada_files.append(str(root))
        return ada_files

    if not root.is_dir():
        raise FileNotFoundError(f"Invalid path: {root_path}")

    for dirpath, dirnames, filenames in os.walk(str(root), followlinks=True):
        dirnames.sort()
        filenames.sort()
        real_dir = os.path.realpath(dirpath)
        if real_dir in seen:
            dirnames.clear()
            continue
        seen.add(real_dir)
        for filename in filenames:
            file_path = os.path.join(dirpath, filename)
            real = os.path.realpath(file_path)
            if real not in seen and Path(filename).suffix.lower() in ADA_EXTENSIONS:
                seen.add(real)
                ada_files.append(file_path)

    return ada_files


def run_analysis(files: list):
    loader = ProjectLoader(files)
    units = loader.load_units()

    subprograms = SubprogramIndexer(units).index()
    callgraph = CallGraphBuilder(units).build()

    public_subps = set()
    for fp in files:
        if fp.endswith(".ads"):
            for subps in subprograms.values():
                for s in subps:
                    public_subps.add(s["name"])

    globals_rw = GlobalRWDetector(units).detect()
    complexity = ComplexityAnalyzer(units).compute()
    deadcode = DeadCodeDetector(callgraph, public_subps).detect_unused_subprograms()
    variables_info = VariablesAnalyzer(units).extract()
    control_flow = ControlFlowExtractor(units).run()
    loops_info = LoopAnalyzer(units).detect()
    exceptions_info = ExceptionAnalyzer(units).detect()
    concurrency_info = ConcurrencyAnalyzer(units).analyze()
    logical_errors = LogicalErrorDetector(units).detect()
    performance_warnings = PerformanceAnalyzer(units).analyze()
    test_harness_data = TestHarnessGenerator(subprograms).generate()
    mock_stub_data = MockStubGenerator(callgraph, subprograms).generate()

    output = {
        "file_paths": files,
        "subprogram_index": subprograms,
        "call_graph": callgraph,
        "global_read_write": globals_rw,
        "cyclomatic_complexity": complexity,
        "dead_code": deadcode,
        "variables_info": variables_info,
        "control_flow_extractor": control_flow,
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
    import sys as _sys
    path = Path(_sys.argv[1]) if len(_sys.argv) > 1 else Path(__file__).parent / "testada_caseinsensitive"

    ada_files = collect_ada_files(str(path))

    if not ada_files:
        print("[WARNING] No Ada files found. Check your path.")
        sys.exit(1)

    print(f"[INFO] Found {len(ada_files)} Ada file(s). Starting analysis...")
    run_analysis(ada_files)
