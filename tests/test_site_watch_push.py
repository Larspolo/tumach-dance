"""tools/site_watch.py (#571): `"push": false` on the live site gives one needs-human issue; `"push": true` closes it."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import site_watch  # noqa: E402

BASE = "https://tumach.dance"
PREVIEW = "https://preview.tumach.dance"


def health(push, status=200):
    return lambda url: (status, json.dumps({"ok": True, "email": True, "push": push}))


class FakeGitHub:
    def __init__(self, tickets=()):
        self.tickets, self.made, self.said, self.shut = list(tickets), [], [], []

    def open_push_tickets(self):
        return self.tickets

    def create(self, title, body, labels):
        self.made.append((title, body, labels))
        return {"number": 600}

    def comment(self, number, body):
        self.said.append((number, body))

    def close(self, number):
        self.shut.append(number)


def run(github, get):
    waits = []
    return site_watch.watch_push(github, BASE, get=get, wait=waits.append, owner="Larspolo"), waits


def test_no_push_on_the_live_site_opens_one_needs_human_issue_after_two_checks():
    github = FakeGitHub()
    out, waits = run(github, health(False))
    assert out == "opened #600" and waits == [site_watch.RETRY_SECONDS]
    title, body, labels = github.made[0]
    assert title == "Nina's phone gets no push on the live site"
    assert labels == ["P2", "bug", "size:S", "needs-human"] and "site-down" not in labels
    assert "## For the owner" in body and "@Larspolo" in body and "Send a test" in body


def test_a_push_in_the_second_check_opens_nothing():
    answers = iter([False, True])
    github = FakeGitHub()
    out, _ = run(github, lambda url: (200, json.dumps({"push": next(answers)})))
    assert out == "push ok" and not github.made


def test_no_second_issue_while_one_is_open():
    github = FakeGitHub([{"number": 599, "title": site_watch.PUSH_TITLE}])
    out, _ = run(github, health(False))
    assert out == "same #599" and not github.made


def test_push_true_closes_the_open_issue():
    github = FakeGitHub([{"number": 599, "title": site_watch.PUSH_TITLE}])
    out, _ = run(github, health(True))
    assert out == "push ok, closed #599" and github.shut == [599] and github.said[0][0] == 599


def test_a_site_that_does_not_answer_gives_no_push_issue():
    github = FakeGitHub()
    out, _ = run(github, health(False, status=503))
    assert out == "push unknown" and not github.made


def test_main_watches_the_push_of_the_live_site_only(monkeypatch):
    seen = []
    monkeypatch.setattr(site_watch, "watch", lambda *a, **k: "ok")
    monkeypatch.setattr(site_watch, "watch_push", lambda gh, base, **k: seen.append(base) or "push ok")
    monkeypatch.setattr(site_watch, "health_record", lambda site, base: {"site": site})
    monkeypatch.setattr(site_watch, "log_health", lambda records: 0)
    monkeypatch.setenv("GITHUB_REPOSITORY", "o/r")
    monkeypatch.setenv("GITHUB_TOKEN", "t")
    monkeypatch.setenv("PREVIEW_URL", PREVIEW)
    monkeypatch.delenv("SITE_URL", raising=False)
    site_watch.main()
    assert seen == [BASE]


def test_the_health_log_keeps_push():
    record = site_watch.health_record("live", BASE, get=health(False))
    assert record["push"] is False
