"""A held, idle PR: the run asks the owner to remove `hold` when its checks are green (#581)."""
import datetime
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "framework", "tools"))
import cycle_start as start  # noqa: E402

NOW = datetime.datetime(2026, 11, 2, 12, 0, tzinfo=datetime.timezone.utc)
ISSUES = {581: {"number": 581, "labels": [{"name": "in-progress"}]}}


def held_pr(minutes=40):
    created = (NOW - datetime.timedelta(minutes=minutes)).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {"number": 90, "head": {"ref": "claude/x-1"}, "body": "Closes #581", "created_at": created,
            "updated_at": created, "labels": [{"name": "hold"}]}


GREEN = [("quick", "completed", "success"), ("browser", "completed", "success")]


def test_a_held_idle_pr_with_green_checks_asks_the_owner_to_remove_hold():
    line = start.pr_work(held_pr(), ISSUES, GREEN, None, NOW)
    assert "ask the owner to remove `hold`" in line
    assert "green" in line
    assert "#581" in line


def test_a_held_idle_pr_with_a_red_browser_check_names_it():
    checks = [("quick", "completed", "success"), ("browser", "completed", "failure")]
    line = start.pr_work(held_pr(), ISSUES, checks, None, NOW)
    assert "browser" in line
    assert "ask the owner" not in line
    assert "add `needs-human` to #581 with the reason" in line


def test_a_held_pr_with_a_live_claim_or_recent_change_needs_no_work():
    assert start.pr_work(held_pr(minutes=5), ISSUES, GREEN, None, NOW) is None
    beat = (3, "Beat #581 by claude/x-1")
    assert start.pr_work(held_pr(), ISSUES, GREEN, beat, NOW) is None
