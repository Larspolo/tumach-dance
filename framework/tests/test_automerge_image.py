"""Automerge starts image.yml after a merge that changes the site: a merge with GITHUB_TOKEN starts no `push` workflow,
so the merges of 2026-10-30 made no site image, and the home server kept the site of #90."""
import json
import os
import re
import subprocess
import sys

import pytest
from test_automerge_failure import FAKE_GH, gate, merge_function

IMAGE = os.path.join(os.path.dirname(__file__), "..", "..", ".github", "workflows", "image.yml")
pytestmark = pytest.mark.skipif(subprocess.run(["which", "jq"], capture_output=True).returncode != 0,
                                reason="the fake gh needs jq")


def ignored():
    """A file in each directory of the paths-ignore of image.yml: a push of only these files makes no image."""
    text = open(IMAGE).read().split("paths-ignore:")[1].split("workflow_dispatch")[0]
    return [p.replace("**", "a.txt") for p in re.findall(r'- "([^"]+)"', text)]


def merged(tmp_path, files):
    """Run merge() for a green PR that merges and changes `files`. Gives ($labels, $image)."""
    (tmp_path / "bin").mkdir()
    gh = tmp_path / "bin" / "gh"
    gh.write_text(FAKE_GH.format(python=sys.executable))
    gh.chmod(0o755)
    (tmp_path / "table.json").write_text(json.dumps({
        "GET repos/o/r/pulls/7/files?per_page=100": [[{"filename": f} for f in files], 0]}))
    pr = json.dumps({"number": 7, "head": {"ref": "agent/7-x", "sha": "abc"}, "labels": [], "body": "A change."})
    script = "\n".join(["R=o/r merged=0 conflict=0 labels=0 image=0 AGENT=true", merge_function(),
                        f"merge '{pr}' abc", 'echo "labels=$labels image=$image"'])
    gate(tmp_path)
    env = dict(os.environ, PATH=f"{tmp_path / 'bin'}:{os.environ['PATH']}", GH_LOG=str(tmp_path / "log"),
               GH_TABLE=str(tmp_path / "table.json"), RUNNER_TEMP=str(tmp_path))
    p = subprocess.run(["bash", "-e", "-c", script], cwd=tmp_path, env=env, capture_output=True, text=True)
    assert p.returncode == 0, p.stderr
    return p.stdout.splitlines()[-1]


def test_a_change_of_the_site_starts_the_image(tmp_path):
    assert merged(tmp_path, ["docs/a.md", "src/app/[locale]/book/page.tsx"]) == "labels=0 image=1"


def test_a_change_of_only_ignored_files_starts_no_image(tmp_path):
    assert len(ignored()) >= 3
    assert merged(tmp_path, ignored()) == "labels=0 image=0"


def test_the_labels_file_starts_both(tmp_path):
    assert merged(tmp_path, [".github/labels.txt"]) == "labels=1 image=1"
