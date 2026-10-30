"""The guard fetches main first: a stale local ref of main does not list the commits of main as own (#183)."""
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "framework", "tools"))
import claim  # noqa: E402


def git(cwd, *a):
    return subprocess.run(["git", *a], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()


def commit(cwd, message):
    git(cwd, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "--allow-empty", "-m", message)


def test_stale_main_ref_passes(tmp_path, monkeypatch):
    remote, clone = tmp_path / "remote", tmp_path / "clone"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(remote))
    git(tmp_path, "clone", "-q", str(remote), str(clone))
    commit(clone, "start")
    git(clone, "push", "-q", "origin", "HEAD:main")
    old = git(clone, "rev-parse", "HEAD")
    commit(clone, "Merged ticket\n\nCloses #7")
    git(clone, "push", "-q", "origin", "HEAD:main")
    git(clone, "update-ref", "refs/remotes/origin/main", old)  # the local ref of main is stale
    git(clone, "checkout", "-q", "-b", "work")
    commit(clone, "My ticket\n\nCloses #9")
    monkeypatch.chdir(clone)
    assert claim.foreign(9, base="origin/main") == []
    commit(clone, "Other ticket\n\nCloses #8")
    assert [m for m, _ in claim.foreign(9, base="origin/main")] == [8]
