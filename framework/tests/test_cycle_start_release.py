"""framework/tools/cycle_start.py starts the run in a project with no release.py (#17, as usage.py and report.py, #1963)."""
import sys

import cycle_start as start


def test_a_project_without_release_py_gets_no_release_checks(monkeypatch):
    monkeypatch.setitem(sys.modules, "release", None)                  # `import release` raises ImportError
    assert start.due_checks() == []
