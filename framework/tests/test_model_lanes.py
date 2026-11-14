"""The lanes have the names of their models (owner, 2026-11-14): haiku, sonnet and fable are lanes with a label, and
the runs of the default lane (Opus) take the tickets with no lane label. The lane of the planning work is a setting."""
import claim
import dashboard
import usage

LANES = [("haiku", 2, 0.25), ("sonnet", 3, 0.5), ("fable", 1, 2.5)]     # (name, ready tickets, weight in Opus runs)
RESERVED = ("haiku", "sonnet", "fable")


def issue(n, *names):
    return dict(number=n, title=f"Ticket {n}", labels=[{"name": x} for x in names], body="")


def test_each_model_lane_gets_its_tickets_and_the_default_lane_takes_the_rest_and_the_refill():
    assert usage.plan(10, 0, 10, LANES, False, hi=8, refill=1) == (8, {"haiku": 2, "sonnet": 3, "fable": 1})
    assert usage.plan(4, 0, 6, LANES, False, hi=8, refill=0) == (6, {"haiku": 2, "sonnet": 3, "fable": 1})   # no ticket for the default lane
    assert usage.plan(10, 0, 10, LANES, True) == (0, {"haiku": 0, "sonnet": 0, "fable": 0})                   # paused


def test_a_reserved_duty_lane_gets_the_refill():
    assert usage.plan(10, 0, 10, LANES, False, hi=8, refill=1, refill_lane="fable") == (8, {"haiku": 2, "sonnet": 3, "fable": 2})


def test_a_run_takes_only_the_tickets_of_its_lane():
    issues = [issue(1, "P0", "lane:fable"), issue(2, "P1", "lane:sonnet"), issue(3, "P2"), issue(4, "P3", "lane:haiku")]
    assert [i["number"] for i in dashboard.candidates(issues, reserved=RESERVED)] == [3]
    for lane, number in (("fable", 1), ("sonnet", 2), ("haiku", 4)):
        assert [i["number"] for i in dashboard.candidates(issues, lane=lane, reserved=RESERVED)] == [number]


def test_the_duty_lane_is_a_setting(monkeypatch, capsys):
    monkeypatch.setattr(claim, "who", lambda: "claude/lane-test")          # a branch, not a detached HEAD (#155)
    monkeypatch.setitem(claim.CONFIG["pacing"], "reserved", list(RESERVED))
    monkeypatch.setitem(claim.CONFIG["pacing"], "duty", "fable")
    monkeypatch.setattr(claim, "lane", lambda: "")
    assert claim.duty() == "fable" and not claim.deep_lane()
    assert claim.main(["0", "--refill"]) == 1
    assert "the fable lane does the queue refill" in capsys.readouterr().out
    monkeypatch.setattr(claim, "lane", lambda: " lane fable")
    assert claim.deep_lane()
    monkeypatch.setitem(claim.CONFIG["pacing"], "duty", "opus")           # not a reserved lane: the default lane does the work
    assert not claim.deep_lane()                                          # a Fable run
    monkeypatch.setattr(claim, "lane", lambda: " lane haiku")
    assert not claim.deep_lane()
    monkeypatch.setattr(claim, "lane", lambda: "")
    assert claim.deep_lane()


def test_the_duty_lane_is_deep_with_no_setting(monkeypatch):
    monkeypatch.delitem(claim.CONFIG["pacing"], "duty", raising=False)
    assert claim.duty() == "deep"
