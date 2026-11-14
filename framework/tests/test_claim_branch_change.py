"""framework/tools/claim.py: a run that changes its branch after the claim keeps its claim. A run claimed with `--or`
on the branch of its first candidate, made a branch for the ticket that it got, and its next beat stopped it as
"another run" (street-quiz #43, 2026-11-14)."""
import claim
from test_claim import clones, run, tool  # noqa: F401  (clones is a fixture)
from test_claim_takeover import old


def branch(d, name):
    run("git", "symbolic-ref", "HEAD", f"refs/heads/{name}", cwd=d)


def test_a_beat_on_a_new_branch_keeps_the_claim(clones, monkeypatch):  # noqa: F811
    a, _, _ = clones
    assert tool(a, "7").returncode == 0                            # the claim names run-0
    branch(a, "agent/7-new-name")
    assert tool(a, "7", "--beat").stdout.strip() == "beat claim/7"
    monkeypatch.chdir(a)
    assert claim.subject("claim/7").startswith("Beat #7 by agent/7-new-name")
    assert tool(a, "7", "--beat").returncode == 0                  # the claim has the new name from now on
    assert tool(a, "7", "--release").stdout.strip() == "released claim/7"


def test_the_second_candidate_of_a_claim_stays_with_the_run(clones):  # noqa: F811
    a, b, _ = clones
    branch(a, "agent/7-first-candidate")
    assert tool(b, "7").returncode == 0                            # another run was first for #7
    r = tool(a, "7", "--or", "8")
    assert r.returncode == 0 and "claimed claim/8" in r.stdout
    branch(a, "agent/8-the-ticket")
    assert tool(a, "8", "--beat").stdout.strip() == "beat claim/8"
    r = tool(a, "7", "--beat")                                     # #7 is still the ticket of the other run
    assert r.returncode != 0 and "belongs to another run" in r.stderr


def test_a_run_with_no_claim_gets_no_claim_by_a_branch_change(clones):  # noqa: F811
    a, b, _ = clones
    assert tool(a, "7").returncode == 0
    branch(b, "agent/7-other")
    r = tool(b, "7", "--beat")
    assert r.returncode != 0 and "belongs to another run" in r.stderr


def test_a_takeover_by_another_run_ends_the_old_claim(clones):  # noqa: F811
    a, b, _ = clones
    assert old(a, "7").returncode == 0                             # the claim of run-0 is stale at once
    assert tool(b, "7", "--takeover").stdout.strip().startswith("claimed claim/7-2")
    branch(a, "agent/7-late")
    r = tool(a, "7", "--beat")
    assert r.returncode != 0 and "belongs to another run" in r.stderr


def test_a_release_forgets_the_claim(clones, monkeypatch):  # noqa: F811
    a, _, _ = clones
    assert tool(a, "7").returncode == 0
    monkeypatch.chdir(a)
    assert claim.remembered(7) == "run-0"
    assert tool(a, "7", "--release").returncode == 0
    assert claim.remembered(7) is None
