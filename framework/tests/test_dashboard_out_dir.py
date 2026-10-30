"""framework/tools/dashboard.py --out writes into a folder that a fresh checkout does not have (out/ is not in git): the
Dashboard workflow failed on each run after #125 with FileNotFoundError, before its PATCH of the status issue."""
import sys
import types

import dashboard
import feedback


def test_out_makes_its_folder_and_the_issue_updates(monkeypatch, tmp_path):
    status = dict(number=1, title="Agent status", labels=[{"name": dashboard.STATUS}], body="## Agent status\n")
    patches = []

    def api(path, method="GET", data=None):
        if method == "PATCH":
            patches.append(path)
        return dict(status) if path == "issues/1" else []
    monkeypatch.setattr(dashboard, "pages", lambda path, limit=10: [dict(status)] if path == "issues?state=open" else [])
    monkeypatch.setattr(dashboard, "api", api)
    monkeypatch.setattr(feedback, "fetch", lambda: [])
    monkeypatch.setitem(sys.modules, "dashboard_data", types.SimpleNamespace(accounts=lambda: []))
    out = tmp_path / "out" / "dashboard.md"                       # the folder does not exist
    assert dashboard.main(["--out", str(out)]) == 0
    assert "## Agent status" in out.read_text(encoding="utf-8") and patches == ["issues/1"]
