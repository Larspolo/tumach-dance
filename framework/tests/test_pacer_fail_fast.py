"""A failed cycle of pacer.yml in a run that a person started ends red at once: a try after a fix of a secret needs no
10-minute wait (2026-10-30, the setup of the secrets of tumach-dance). A run of the loop or of the cron waits 10 minutes
and starts the next run, so a broken secret makes no fast loop of red runs."""
import os
import subprocess

import pytest
from test_pacer_restart import WORKFLOW, commit, git, loop_script


@pytest.fixture
def failing(tmp_path):
    """(the checkout of the run, the bin directory with fake gh and sleep, and a python3 whose cycle call fails)."""
    remote, run = tmp_path / "remote.git", tmp_path / "run"
    git("init", "-q", "--bare", "-b", "main", str(remote), cwd=tmp_path)
    git("clone", "-q", f"file://{remote}", str(run), cwd=tmp_path)
    for k, v in (("user.name", "t"), ("user.email", "t@t")):
        git("config", k, v, cwd=run)
    commit(run, WORKFLOW, "text\n")
    bin_, log = tmp_path / "bin", tmp_path / "calls"
    bin_.mkdir()
    for name, code in (("gh", "0"), ("sleep", "0"), ("python3", '$(case "$*" in (*--switch*) echo 0;; (*) echo 1;; esac)')):
        f = bin_ / name
        f.write_text(f'#!/bin/sh\necho "{name} $*" >> {log}\nexit {code}\n')
        f.chmod(0o755)
    return run, bin_, log


def cycle(failing, tmp_path, event, actor):
    run, bin_, log = failing
    env = {**os.environ, "PATH": f"{bin_}:{os.environ['PATH']}", "RUNNER_TEMP": str(tmp_path),
           "GITHUB_REPOSITORY": "o/r", "GITHUB_EVENT_NAME": event, "GITHUB_ACTOR": actor}
    r = subprocess.run(["bash", "-e", "-c", loop_script()], cwd=run, env=env, capture_output=True, text=True, timeout=60)
    return r.returncode, [c for c in log.read_text().splitlines() if not c.startswith("python3")]


def test_a_run_of_a_person_ends_at_once(failing, tmp_path):
    assert cycle(failing, tmp_path, "workflow_dispatch", "Larspolo") == (1, [])


@pytest.mark.parametrize("event, actor", [("workflow_dispatch", "github-actions[bot]"), ("schedule", "Larspolo")])
def test_a_run_of_the_loop_waits_and_starts_the_next_run(failing, tmp_path, event, actor):
    assert cycle(failing, tmp_path, event, actor) == (1, ["sleep 600", "gh workflow run pacer.yml --repo o/r --ref main"])
