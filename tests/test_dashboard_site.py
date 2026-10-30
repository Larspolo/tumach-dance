"""The dashboard page shows the roadmap goals and the sections of #1 (#118)."""
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import dashboard_site  # noqa: E402

ROADMAP = """# Roadmap

## 1. Show the studio

- [x] `site:skeleton` The home page
  - detail
- [ ] `site:languages` Three languages
- [ ] `site:photos` Photos
"""
EPICS = [{"number": 40, "title": "Languages <script>alert(1)</script>", "html_url": "https://github.com/x/y/issues/40",
          "body": "Roadmap: `site:languages`", "sub_issues_summary": {"total": 5, "completed": 2}}]


def test_goals_states():
    out = dashboard_site.goals_html(ROADMAP, EPICS)
    assert "1. Show the studio" in out
    assert "<code>site:skeleton</code> The home page: <span class=\"done\">done</span>" in out
    assert "in work: 2 of 5" in out
    assert "<code>site:photos</code> Photos: <span class=\"todo\">not started</span>" in out
    assert "detail" not in out


def test_title_escaped():
    out = dashboard_site.goals_html(ROADMAP, EPICS)
    assert "<script>" not in out
    assert "&lt;script&gt;" in out


def test_sections_only_shown_ones():
    body = "<!-- agent-state -->\n## Agent status\n\n### Waiting for you\n- #1 a\n\n### Accounts\n| x |\n\n" \
           "### Recently done\n- #2 b\n\n### Process changes\n- none\n"
    out = dashboard_site.sections(body)
    assert "### Waiting for you\n- #1 a" in out and "### Recently done\n- #2 b" in out
    assert "Accounts" not in out and "Process changes" not in out


def test_page_has_refresh_and_time():
    now = datetime.datetime(2026, 10, 30, 21, 0, tzinfo=datetime.timezone.utc)
    out = dashboard_site.page(ROADMAP, EPICS, "<h3>Working on</h3>", now)
    assert '<meta http-equiv="refresh" content="300">' in out
    assert "2026-10-30 21:00 UTC" in out and "<h3>Working on</h3>" in out
    assert "<script" not in out.lower().replace("&lt;script", "")
