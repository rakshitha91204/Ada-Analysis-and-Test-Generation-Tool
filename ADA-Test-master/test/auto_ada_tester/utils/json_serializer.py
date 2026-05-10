# json_serializer.py
# Utility to safely serialize analysis results to JSON,
# handling non-serializable types (sets, Path objects, etc.)

import json
from pathlib import Path


def _make_serializable(obj):
    """
    Recursively convert non-JSON-serializable types to serializable ones.
    - set  → sorted list
    - Path → str
    - objects with __dict__ → dict
    """
    if isinstance(obj, dict):
        return {k: _make_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_make_serializable(i) for i in obj]
    if isinstance(obj, set):
        return sorted(_make_serializable(i) for i in obj)
    if isinstance(obj, Path):
        return str(obj)
    if hasattr(obj, "__dict__"):
        return _make_serializable(obj.__dict__)
    return obj


def to_json(data: dict, indent: int = 4) -> str:
    """Serialize analysis result dict to a JSON string."""
    return json.dumps(_make_serializable(data), indent=indent)


def write_json(data: dict, filepath: str, indent: int = 4) -> None:
    """Write analysis result dict to a JSON file."""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(to_json(data, indent=indent))


def read_json(filepath: str) -> dict:
    """Read a JSON file and return as dict."""
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)
