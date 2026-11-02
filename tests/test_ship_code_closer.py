"""`ship_pr.py` refuses a closing word for another ticket also in code (#474: PR #473 closed #453 from a code span)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "framework" / "tools"))
import ship_pr  # noqa: E402


def test_code_span_is_refused():
    line = "The body of PR #471 quoted `PR #468 closed #453`."
    assert ship_pr.closer(f"{line}\n\nCloses #472\n", 472) == line


def test_code_block_is_refused():
    assert ship_pr.closer("Fix it.\n```\nfixes #12\n```\nCloses #472\n", 472) == "fixes #12"


def test_own_ticket_and_part_of_pass():
    assert ship_pr.closer("See `closes #472`.\nPart of #446\nCloses #472\n", 472) is None


def test_part_refuses_own_ticket_in_code():
    assert ship_pr.closer("Part of #453\nSee `closes #453`.\n", 453, part=True) == "See `closes #453`."
