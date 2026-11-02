"""`ship_pr.py` refuses prose that closes a ticket other than its own (#472: PR #471 closed #453 with "closed #453")."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "framework" / "tools"))
import ship_pr  # noqa: E402


def test_other_ticket_in_prose_is_refused(tmp_path):
    text = "Refuse a closing word.\nPR #468 closed #453 with a quote.\n\nCloses #470\n"
    assert ship_pr.closer(text, 470) == "PR #468 closed #453 with a quote."
    body = tmp_path / "b.md"
    body.write_text(text)
    assert ship_pr.main(["470", "--body", str(body), "--title", "t"]) == 2


def test_colon_form_is_refused():
    assert ship_pr.closer("Fixes: #12\nCloses #470\n", 470) == "Fixes: #12"


def test_own_ticket_and_code_pass():
    text = "Closes #470\nPart of #446\nSee `closes #453` and\n```\nfixes #12\n```\nfixed #470 too\n"
    assert ship_pr.closer(text, 470) is None


def test_part_refuses_own_ticket():
    assert ship_pr.closer("Part of #453\nThis does not close #453.\n", 453, part=True) == "This does not close #453."
    assert ship_pr.closer("Part of #453\nCloses #12\n", 453, part=True) == "Closes #12"


def test_message_is_checked_before_the_commit(tmp_path):
    msg = tmp_path / "m.txt"
    msg.write_text("Fix the guard\n\nResolves #9.\n\nCloses #470\n")
    assert ship_pr.main(["470", "--message", str(msg)]) == 2
