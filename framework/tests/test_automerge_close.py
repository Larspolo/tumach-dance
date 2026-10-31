"""Automerge closes the ticket of a merged PR when GitHub did not: #210 stayed open after the merge of PR #213 (#264)."""
import json
import os
import subprocess
import sys

import pytest
from test_automerge_failure import FAKE_GH, gate, merge_function

pytestmark = pytest.mark.skipif(subprocess.run(["which", "jq"], capture_output=True).returncode != 0,
                                reason="the fake gh needs jq")


def calls(tmp_path, state):
    """Run merge() for a green PR with "Closes #5" that merges; the ticket has `state` after the merge. Gives the calls."""
    (tmp_path / "bin").mkdir()
    gh = tmp_path / "bin" / "gh"
    gh.write_text(FAKE_GH.format(python=sys.executable))
    gh.chmod(0o755)
    (tmp_path / "table.json").write_text(json.dumps({"GET repos/o/r/issues/5": [{"state": state, "labels": []}, 0]}))
    pr = json.dumps({"number": 7, "head": {"ref": "agent/5-x", "sha": "abc"}, "labels": [], "body": "Closes #5"})
    script = "\n".join(["R=o/r merged=0 conflict=0 labels=0 image=0 AGENT=true", merge_function(), f"merge '{pr}' abc"])
    gate(tmp_path)
    env = dict(os.environ, PATH=f"{tmp_path / 'bin'}:{os.environ['PATH']}", GH_LOG=str(tmp_path / "log"),
               GH_TABLE=str(tmp_path / "table.json"), RUNNER_TEMP=str(tmp_path))
    p = subprocess.run(["bash", "-e", "-c", script], cwd=tmp_path, env=env, capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    return [json.loads(line) for line in (tmp_path / "log").read_text().splitlines()]


def closes(log):
    return [c for c in log if c[1] == "repos/o/r/issues/5" and "PATCH" in c]


def test_an_open_ticket_closes_after_the_merge(tmp_path):
    log = calls(tmp_path, "open")
    merge = next(i for i, c in enumerate(log) if c[1] == "repos/o/r/pulls/7/merge")
    close = closes(log)
    assert close == [["api", "repos/o/r/issues/5", "-X", "PATCH", "-f", "state=closed", "-f", "state_reason=completed"]]
    assert log.index(close[0]) > merge


def test_a_closed_ticket_gets_no_second_close(tmp_path):
    assert closes(calls(tmp_path, "closed")) == []
