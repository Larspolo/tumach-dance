"""framework/tools/merge_json.py merges the language files `messages/*.json` key by key, not line by line (#131)."""
import json
import os
import subprocess

TOOL = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "tools", "merge_json.py"))

BASE = {"Push": {"title": "Push", "on": "On"}, "Week": {"title": "Week"}}


def run(tmp_path, ours, theirs, base=BASE):
    paths = []
    for name, data in (("base", base), ("ours", ours), ("theirs", theirs)):
        p = tmp_path / f"{name}.json"
        p.write_text(data if isinstance(data, str) else json.dumps(data, ensure_ascii=False, indent=2) + "\n")
        paths.append(str(p))
    rc = subprocess.run(["python3", TOOL, *paths]).returncode
    return rc, (tmp_path / "ours.json").read_text()


def test_new_keys_of_both_sides_at_one_place_stay(tmp_path):
    ours = {"Push": {"title": "Push", "on": "On", "off": "Off"}, "Week": {"title": "Week"}}
    theirs = {"Push": {"title": "Push", "on": "On", "denied": "Denied"}, "Week": {"title": "Week"}}
    rc, text = run(tmp_path, ours, theirs)
    assert rc == 0
    assert json.loads(text) == {"Push": {"title": "Push", "on": "On", "off": "Off", "denied": "Denied"},
                                "Week": {"title": "Week"}}
    assert list(json.loads(text)["Push"]) == ["title", "on", "off", "denied"]
    assert text.endswith("}\n") and '\n  "Push": {\n    "title"' in text


def test_a_change_of_one_side_and_a_new_group_of_the_other(tmp_path):
    ours = {"Push": {"title": "Notifications", "on": "On"}, "Week": {"title": "Week"}}
    theirs = {**BASE, "Classes": {"title": "Klassen ë"}}
    rc, text = run(tmp_path, ours, theirs)
    assert rc == 0
    assert json.loads(text) == {**ours, "Classes": {"title": "Klassen ë"}}
    assert "ë" in text


def test_one_key_changed_on_both_sides_is_a_conflict(tmp_path):
    ours = {"Push": {"title": "A", "on": "On"}, "Week": {"title": "Week"}}
    theirs = {"Push": {"title": "B", "on": "On"}, "Week": {"title": "Week"}}
    rc, text = run(tmp_path, ours, theirs)
    assert rc == 1
    assert "<<<<<<< ours" in text


def test_a_file_that_does_not_parse_gets_the_text_merge(tmp_path):
    rc, text = run(tmp_path, "{ bad\n", "{ bad\n", base="{ bad\n")
    assert rc == 0 and text == "{ bad\n"
