"""The flow brake counts only the queued runs of the quick CI (#106)."""
import sys
import types

sys.path.insert(0, "framework/tools")
import usage  # noqa: E402


def test_read_flow_asks_only_ci_yml(monkeypatch):
    asked = []
    fake = types.SimpleNamespace(pages=lambda path: [], api=lambda path: asked.append(path) or {"total_count": 0})
    monkeypatch.setitem(sys.modules, "dashboard", fake)
    usage.read_flow(0)
    assert asked == ["actions/workflows/ci.yml/runs?status=queued&per_page=1"]
