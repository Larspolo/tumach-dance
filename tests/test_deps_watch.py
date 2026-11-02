"""Tests of tools/deps_watch.py (#412): fixed audit and `npm ls` JSON, a fake GitHub."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import deps_watch  # noqa: E402

TREE = {"dependencies": {"next": {"dependencies": {"postcss": {}}}}}


def audit(*vulns):
    return {"vulnerabilities": {name: {"severity": sev, "via": [{"url": f"https://ghsa/{name}"}],
                                       "fixAvailable": {"name": name, "version": "9.0.0", "isSemVerMajor": True}}
                                for name, sev in vulns}}


class FakeGitHub:
    def __init__(self, tickets=None, comments=None):
        self.tickets, self.saved, self.created, self.commented = tickets or [], comments or [], [], []

    def open_tickets(self):
        return self.tickets

    def comments(self, number):
        return self.saved

    def create(self, title, body):
        self.created.append((title, body))
        return {"number": 7}

    def comment(self, number, body):
        self.commented.append(body)


def test_moderate_finding_of_a_production_package_opens_one_ticket():
    github = FakeGitHub()
    found = deps_watch.findings(audit(("postcss", "moderate")), TREE)
    assert deps_watch.watch(github, found) == "opened #7"
    title, body = github.created[0]
    assert title == deps_watch.TITLE and "`postcss`" in body and "https://ghsa/postcss" in body
    assert "(major version)" in body and "npm@11 install --save-exact" in body


def test_finding_of_only_a_development_package_opens_none():
    github = FakeGitHub()
    assert deps_watch.watch(github, deps_watch.findings(audit(("drizzle-kit", "high")), TREE)) == "none"
    assert not github.created


def test_low_finding_opens_none():
    github = FakeGitHub()
    assert deps_watch.watch(github, deps_watch.findings(audit(("next", "low")), TREE)) == "none"
    assert not github.created


def test_same_findings_give_no_comment_and_no_second_ticket():
    found = deps_watch.findings(audit(("postcss", "moderate")), TREE)
    github = FakeGitHub(tickets=[{"number": 5, "body": deps_watch.ticket_body(found)}])
    assert deps_watch.watch(github, found) == "same #5"
    assert not github.created and not github.commented


def test_changed_findings_give_one_comment():
    old = deps_watch.findings(audit(("postcss", "moderate")), TREE)
    github = FakeGitHub(tickets=[{"number": 5, "body": deps_watch.ticket_body(old)}])
    new = deps_watch.findings(audit(("postcss", "moderate"), ("next", "critical")), TREE)
    assert deps_watch.watch(github, new) == "updated #5"
    assert len(github.commented) == 1 and "`next`" in github.commented[0] and not github.created


def test_advisory_link_of_a_package_that_gets_the_problem_from_another():
    vulns = {"a": {"via": ["b"]}, "b": {"via": [{"url": "https://ghsa/b"}, "a"]}}
    assert deps_watch.advisories("a", vulns) == ["https://ghsa/b"]


def test_optional_peer_that_the_lock_marks_dev_opens_none():
    tree = {"dependencies": {"better-auth": {"dependencies": {"drizzle-kit": {"dependencies": {"esbuild": {}}}}}}}
    lock = {"packages": {"": {}, "node_modules/better-auth": {},
                         "node_modules/drizzle-kit": {"devOptional": True}, "node_modules/esbuild": {"devOptional": True}}}
    github = FakeGitHub()
    found = deps_watch.findings(audit(("drizzle-kit", "moderate"), ("esbuild", "moderate")), tree, lock)
    assert deps_watch.watch(github, found) == "none"
