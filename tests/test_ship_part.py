"""`ship_pr.py --part` refuses a closing word for its ticket (#470)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "framework" / "tools"))
import ship_pr  # noqa: E402


def test_does_not_close_is_refused(tmp_path):
    assert ship_pr.closer("Fix the form.\nThis PR does not close #453.\n", 453, part=True) == "This PR does not close #453."
    body = tmp_path / "b.md"
    body.write_text("This PR does not close #453.\n")
    assert ship_pr.main(["453", "--part", "--body", str(body), "--title", "t"]) == 2


def test_part_of_is_accepted():
    assert ship_pr.closer("Part of #453\nSee `closes #453` in code.\n", 453, part=True) is None
