#!/usr/bin/env python3
"""Git merge driver for the text files `messages/*.json`: merge the keys of the JSON objects, not the lines (#131).

Two tickets that each add a text at the same place of a language file give a line conflict, also when the keys are
different. This driver merges the three versions key by key, also in nested objects (`merge_jsonl.value`): a key
that one side changed takes that side; new keys of both sides stay, in the order of ours with the new keys of
theirs after their neighbour above. A key that both sides changed to different values is a conflict: the text merge
of `git merge-file` (conflict markers) and exit code 1. A file that does not parse also falls back to that merge.

    python3 framework/tools/merge_json.py BASE OURS THEIRS     # git: merge.json.driver "python3 framework/tools/merge_json.py %O %A %B"

The result goes into OURS, with an indent of 2 spaces and a newline at the end (the format of Biome).
"""
import json
import subprocess
import sys

from merge_jsonl import Conflict, value


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def main(argv):
    base, ours, theirs = argv[1:4]
    try:
        merged = value(load(base), load(ours), load(theirs))
    except (ValueError, Conflict):                       # no JSON, or a key changed on both sides: the text merge
        r = subprocess.run(["git", "merge-file", "-L", "ours", "-L", "base", "-L", "theirs", ours, base, theirs])
        return 1 if r.returncode else 0
    with open(ours, "w", encoding="utf-8") as f:
        f.write(json.dumps(merged, ensure_ascii=False, indent=2) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
