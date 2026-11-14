"""The loop of pacer.yml starts each cycle at a full 10 minutes of the clock. The starter session gets its ticks 2
minutes later, so a tick reads a fresh plan and starts it one time. With a fixed sleep of 600 seconds a cycle took 608
seconds, and the plan moved to the limit of the starter (2026-11-14)."""
import pytest
from test_pacer_restart import calls, loop, repo  # noqa: F401 (repo is a fixture)

FULL = 999_999_600                                              # a time (seconds) at a full 10 minutes


def tools(bin_, log, now):
    """python3 that lets one cycle pass and then gives the stop of the switch; date that gives the time `now`."""
    count = bin_ / "count"
    (bin_ / "python3").write_text(
        f'#!/bin/sh\necho "python3 $*" >> {log}\n'
        f'case "$*" in *--switch*) echo x >> {count}; [ "$(wc -l < {count})" -gt 1 ] && exit 3;; esac\nexit 0\n')
    f = bin_ / "date"
    f.write_text(f'#!/bin/sh\necho {now}\n')
    f.chmod(0o755)


@pytest.mark.parametrize("past, wait", [(0, 600), (8, 592), (430, 170), (540, 60), (541, 659), (599, 601)])
def test_the_loop_sleeps_to_the_next_full_10_minutes(repo, tmp_path, past, wait):  # noqa: F811
    run, _, bin_, log = repo
    tools(bin_, log, FULL + past)
    r = loop(run, bin_, tmp_path)
    assert r.returncode == 0, r.stderr
    sleeps = [c for c in calls(log) if c.startswith("sleep")]
    assert sleeps == [f"sleep {wait}"]                           # one cycle, then the switch stops the loop
    assert (FULL + past + wait) % 600 == 0 and wait >= 60
