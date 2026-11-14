"""framework/tools/pacer.py with `starts = "session"` in `[pacing]`: a starter session of the hub starts the runs, so the
pacer plans and logs each cycle and sends no call (the hub, decision A2 of 2026-11-13)."""
import json

import pacer
from test_pacer_script import run, server  # noqa: F401  (fixture)


def test_the_setting_turns_the_plan_mode_on():
    assert pacer.starter({"pacing": {"starts": "session"}}) is True
    assert pacer.starter({"pacing": {"starts": "api"}}) is False
    assert pacer.starter({"pacing": {}}) is False and pacer.starter({}) is False


def test_the_pacer_plans_and_logs_but_sends_no_call(monkeypatch, server, capsys, tmp_path):  # noqa: F811
    url, got = server
    env = {"PACER_URL_MAIN": f"{url}/main", "PACER_TOKEN_MAIN": "tm", "PACER_URL_HAIKU": f"{url}/haiku",
           "PACER_TOKEN_HAIKU": "th"}
    log = tmp_path / "pacer.jsonl"
    assert run(monkeypatch, 3, {"haiku": 1, "deep": 1}, env, ["--log", str(log)], plan_only=True) == 0
    assert got == []                                                     # no call, also for a task with a URL
    out = capsys.readouterr().out
    assert "the starter session starts them" in out and "no URL" not in out
    record = json.loads(log.read_text().splitlines()[-1])
    assert (record["starts"], record["k"], record["plan"]) == ("session", 3, {"haiku": 1, "deep": 1})
    assert record["started"] == {"haiku": 0, "deep": 0, "main": 0} and record["problems"] == []


def test_without_the_setting_the_record_has_no_starts_key(monkeypatch, server, tmp_path):  # noqa: F811
    url, got = server
    log = tmp_path / "pacer.jsonl"
    assert run(monkeypatch, 1, {"haiku": 0, "deep": 0}, {"PACER_URL_MAIN": f"{url}/main", "PACER_TOKEN_MAIN": "tm"},
               ["--log", str(log)]) == 0
    assert [p for p, *_ in got] == ["/main"]
    assert "starts" not in json.loads(log.read_text().splitlines()[-1])
