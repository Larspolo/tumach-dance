"""The run start moves a stale clean checkout to the newest main (#105)."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "framework", "tools"))
import cycle_start  # noqa: E402


def git(cwd, *a):
    return subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()


def commit(cwd, name):
    open(os.path.join(cwd, name), "w").write(name)
    git(cwd, "add", name)
    git(cwd, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", name)


def setup(tmp_path, monkeypatch):
    remote, work, other = tmp_path / "r.git", tmp_path / "w", tmp_path / "o"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(remote))
    git(tmp_path, "clone", "-q", str(remote), str(work))
    git(work, "checkout", "-q", "-b", "main")
    commit(work, "a")
    git(work, "push", "-q", "origin", "main")
    git(work, "checkout", "-q", "-b", "claude/session")
    git(tmp_path, "clone", "-q", str(remote), str(other))
    monkeypatch.chdir(work)
    return work, other


def advance(other):
    commit(other, "b")
    commit(other, "c")
    git(other, "push", "-q", "origin", "main")


def test_clean_branch_behind_moves(tmp_path, monkeypatch):
    work, other = setup(tmp_path, monkeypatch)
    advance(other)
    line, moved = cycle_start.checkout("origin", "main")
    head = git(work, "rev-parse", "--short", "HEAD")
    assert moved and line == f"Checkout: moved to {head} (2 commits behind)"
    assert git(work, "rev-parse", "HEAD") == git(other, "rev-parse", "HEAD")
    assert git(work, "branch", "--show-current") == "claude/session"


def test_own_commit_does_not_move(tmp_path, monkeypatch):
    work, other = setup(tmp_path, monkeypatch)
    advance(other)
    commit(work, "mine")
    before = git(work, "rev-parse", "HEAD")
    line, moved = cycle_start.checkout("origin", "main")
    assert not moved and line == "Checkout: 2 commits behind origin/main: update before you work"
    assert git(work, "rev-parse", "HEAD") == before


def test_at_remote_head_prints_nothing(tmp_path, monkeypatch):
    setup(tmp_path, monkeypatch)
    assert cycle_start.checkout("origin", "main") == (None, False)
