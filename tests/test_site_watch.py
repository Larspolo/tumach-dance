"""tools/site_watch.py: a site that does not work gets one P0 ticket with the error text; a working site closes it."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import site_watch  # noqa: E402

BASE = "https://tumach.dance"
DOWN = json.dumps({"ok": False, "backupAt": None, "version": "89b1b73abc", "errors": [
    {"where": "start: backup timer", "message": "Error: Could not load the sharp module | Wasm SIMD unsupported",
     "at": "2026-10-31T07:19:58.000Z", "start": True}]})
UP = json.dumps({"ok": True, "backupAt": "2026-10-31T03:00:00.000Z", "version": "c0ffee1abc"})


def site(answers):
    """A stub of fetch: {path: (status, text)}."""
    return lambda url: answers[url[len(BASE):]]


class FakeGitHub:
    def __init__(self, open_tickets=(), closed=None):
        self.tickets, self.closed_mark, self.made, self.said, self.shut = list(open_tickets), closed, [], [], []

    def open_tickets(self):
        return self.tickets

    def comments(self, number):
        return [{"body": body} for n, body in self.said if n == number]

    def recently_closed(self, mark):
        return 9 if self.closed_mark == mark else None

    def create(self, title, body):
        self.made.append((title, body))
        return {"number": 300}

    def comment(self, number, body):
        self.said.append((number, body))

    def close(self, number):
        self.shut.append(number)


def merges(since=None):
    return [f"89b1b73 2026-10-31T07:12:00+00:00 Load sharp only for a new photo (#283) (since {since})"]


def watch(github, answers):
    waits = []
    out = site_watch.watch(github, BASE, get=site(answers), wait=waits.append, merges=merges)
    return out, waits


def test_a_site_that_does_not_start_gets_one_ticket_with_the_error_text():
    github = FakeGitHub()
    out, waits = watch(github, {"/api/health": (503, DOWN), "/en": (500, "Internal Server Error")})
    assert out == "opened #300" and waits == [site_watch.RETRY_SECONDS]
    title, body = github.made[0]
    assert title == "Fix tumach.dance: the live site does not work"
    assert "Wasm SIMD unsupported" in body and "start: backup timer" in body
    assert "`GET https://tumach.dance/en`: **500**" in body and "Internal Server Error" in body
    assert "(#283) (since 89b1b73abc)" in body and "image of commit `89b1b73`" in body
    assert body.startswith("## Goal") and "## Acceptance criteria" in body


def test_no_answer_at_all_is_a_failure_too():
    github = FakeGitHub()
    out, _ = watch(github, {"/api/health": (0, "URLError: timed out"), "/en": (0, "URLError: timed out")})
    assert out == "opened #300"
    assert "**no answer**" in github.made[0][1] and "(since None)" in github.made[0][1]


def test_the_same_failure_adds_nothing_and_a_new_failure_adds_one_comment():
    first = {"/api/health": (503, DOWN), "/en": (500, "Internal Server Error")}
    github = FakeGitHub()
    watch(github, first)
    ticket = {"number": 300, "body": github.made[0][1]}
    github = FakeGitHub([ticket])
    assert watch(github, first)[0] == "same #300"
    changed = {"/api/health": (502, "Bad Gateway"), "/en": (502, "Bad Gateway")}
    assert watch(github, changed)[0] == "updated #300"
    assert watch(github, changed)[0] == "same #300"
    assert len(github.said) == 1 and "Bad Gateway" in github.said[0][1]


def test_a_working_site_closes_the_open_ticket():
    github = FakeGitHub([{"number": 300, "body": ""}])
    out, waits = watch(github, {"/api/health": (200, UP), "/en": (200, "<html>")})
    assert out == "ok, closed #300" and waits == [] and github.shut == [300]
    assert "image `c0ffee1`" in github.said[0][1]


def test_one_failed_check_is_not_enough():
    answers = iter([(503, DOWN), (200, "<html>"), (200, UP), (200, "<html>")])
    github = FakeGitHub()
    out = site_watch.watch(github, BASE, get=lambda url: next(answers), wait=lambda s: None, merges=merges)
    assert out == "ok" and github.made == []


def test_no_new_ticket_just_after_a_fix_closed_the_same_failure():
    answers = {"/api/health": (503, DOWN), "/en": (500, "Internal Server Error")}
    mark = site_watch.fingerprint(site_watch.check(BASE, site(answers)))
    github = FakeGitHub(closed=mark)
    out, _ = watch(github, answers)
    assert out.startswith("wait: #9 closed") and github.made == []


def test_recently_closed_finds_the_mark_only_in_the_grace_time():
    import datetime

    class Stub(site_watch.GitHub):
        def __init__(self, tickets):
            super().__init__("o/r", "token")
            self.tickets = tickets

        def call(self, method, path, data=None):
            if "/comments" in path:
                return [{"body": "<!-- site-watch: abc -->"}] if path.startswith("/issues/7/") else []
            return self.tickets

    now = datetime.datetime(2026, 10, 31, 8, 0, tzinfo=datetime.timezone.utc)
    new = {"number": 7, "closed_at": "2026-10-31T07:45:00Z", "body": ""}
    old = {"number": 5, "closed_at": "2026-10-31T06:00:00Z", "body": "<!-- site-watch: abc -->"}
    assert Stub([old, new]).recently_closed("abc", now=now) == 7
    assert Stub([old]).recently_closed("abc", now=now) is None
    assert Stub([new]).recently_closed("other", now=now) is None
