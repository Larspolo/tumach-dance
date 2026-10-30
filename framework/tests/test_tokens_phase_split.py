"""`tokens.phases()` splits each call at its tool result (#189): the run time of a tool goes to the phase of its call,
the time in which the model writes the next call goes to the phase of that next call."""
import tokens


def at(seconds):
    return f"2026-10-30T12:{seconds // 60:02d}:{seconds % 60:02d}.000Z"


def call(seconds, uid, name, **inp):
    return {"type": "assistant", "timestamp": at(seconds),
            "message": {"id": uid, "content": [{"type": "tool_use", "id": uid, "name": name, "input": inp}]}}


def result(seconds, uid, text="ok"):
    return {"type": "user", "timestamp": at(seconds),
            "message": {"content": [{"type": "tool_result", "tool_use_id": uid, "content": text}]}}


CLAIM = [call(0, "a", "Bash", command="python3 framework/tools/claim.py 7"), result(60, "a", "claimed claim/7")]


def test_the_writing_time_of_an_edit_goes_to_code_not_to_the_read_before_it():
    recs = CLAIM + [call(60, "b", "Bash", command="cat x.py"), result(61, "b"),
                    call(301, "c", "Edit", file_path="x.py"), result(302, "c")]
    got = tokens.phases(recs)[7]
    assert round(got["read"] * 60) == 1                               # the cat ran 1 s
    assert round(got["code"] * 60) == 241                             # 240 s to write the edit, 1 s to apply it


def test_a_slow_tool_gives_its_run_time_to_the_phase_of_its_call():
    recs = CLAIM + [call(60, "b", "Bash", command="python3 -m pytest -n auto"), result(660, "b"),
                    call(670, "c", "Read", file_path="y.py"), result(671, "c")]
    got = tokens.phases(recs)[7]
    assert round(got["verify"] * 60) == 600
    assert round(got["read"] * 60) == 11


def test_a_call_with_no_result_keeps_the_time_to_the_next_call():
    recs = CLAIM + [call(60, "b", "Bash", command="cat x.py"), call(120, "c", "Edit", file_path="x.py")]
    got = tokens.phases(recs)[7]
    assert round(got["read"] * 60) == 60 and got["code"] == 0


def test_parallel_calls_do_not_count_a_time_twice():
    recs = CLAIM + [call(60, "b", "Bash", command="cat x.py"), call(61, "c", "Read", file_path="y.py"),
                    result(65, "b"), result(70, "c"), call(100, "d", "Edit", file_path="x.py"), result(101, "d")]
    got = tokens.phases(recs)[7]
    assert round(sum(got.values()) * 60) == 101                       # the wall time from the claim to the last result


def test_an_adopted_claim_of_a_pacer_brief_is_a_claim():
    recs = [call(0, "a", "Bash", command="python3 framework/tools/claim.py 188 --adopt pacer-r22aa86165f"),
            result(2, "a", "adopted claim/188: #188 is yours"),
            call(60, "b", "Edit", file_path="x.py"), result(61, "b"),
            call(120, "c", "Bash", command="python3 framework/tools/claim.py 189"), result(122, "c", "claimed claim/189"),
            call(180, "d", "Read", file_path="y.py"), result(181, "d")]
    got = tokens.phases(recs)
    assert list(got) == [188, 189]
    assert round(got[188]["code"] * 60) == 59


def test_the_calls_line_names_the_top_reads():
    recs = [call(0, "a", "Bash", command="cat x.py"), call(1, "b", "Bash", command="cat x.py"),
            call(2, "c", "Read", file_path="y.py"), call(3, "d", "Edit", file_path="x.py")]
    line = tokens.calls_line(recs)
    assert line.split(" · ")[-1].startswith("read top 2x ")
