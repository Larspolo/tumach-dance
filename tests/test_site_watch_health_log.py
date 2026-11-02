"""tools/site_watch.py (#460): each watch keeps the /api/health answer of the live site and of the preview on the branch
`metrics` (`site/YYYY-MM-DD.jsonl`, one line per site when it changed), and a run reads it with git."""
import datetime
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import site_watch  # noqa: E402

NOW = datetime.datetime(2026, 11, 2, 10, 0, tzinfo=datetime.timezone.utc)
LIVE = json.dumps({"ok": True, "backupAt": "2026-11-02T03:00:00.000Z", "email": True, "version": "c0ffee1abc"})
MAIL_ERROR = {"where": "email: request", "message": "Error: Email: Mailgun answered 401: Forbidden",
              "at": "2026-11-02T09:58:00.000Z"}
PREVIEW = json.dumps({"ok": True, "backupAt": None, "email": True, "version": "c0ffee1abc", "errors": [MAIL_ERROR]})


def git(root, *args):
    out = subprocess.run(["git", "-C", root, *args], capture_output=True, text=True)
    assert out.returncode == 0, out.stderr
    return out.stdout


def repos(tmp_path):
    """A bare remote with no branch metrics, and a clone of it (the checkout of the workflow)."""
    remote, work = str(tmp_path / "remote.git"), str(tmp_path / "work")
    subprocess.run(["git", "init", "-q", "--bare", remote], check=True)
    subprocess.run(["git", "init", "-q", work], check=True)
    git(work, "remote", "add", "origin", remote)
    for key, value in (("user.name", "watch"), ("user.email", "watch@example.invalid")):
        git(work, "config", key, value)
    return remote, work


def records(answers, now=NOW):
    """The records of both sites, with a stub of fetch: {url: (status, text)}."""
    get = lambda url: answers[url]
    return [site_watch.health_record("live", "https://tumach.dance", get, now),
            site_watch.health_record("preview", "https://preview.tumach.dance/", get, now)]


def log(remote, day="2026-11-02"):
    """The log of a day as a run reads it: a fetch of the branch metrics and `git show`."""
    return [json.loads(line) for line in git(remote, "show", f"metrics:site/{day}.jsonl").splitlines()]


ANSWERS = {"https://tumach.dance/api/health": (200, LIVE), "https://preview.tumach.dance/api/health": (200, PREVIEW)}


def test_a_record_has_the_status_and_the_health_fields():
    live, preview = records(ANSWERS)
    assert live == {"at": "2026-11-02T10:00:00Z", "site": "live", "status": 200, "ok": True,
                    "email": True, "backupAt": "2026-11-02T03:00:00.000Z", "version": "c0ffee1abc"}
    assert preview["site"] == "preview" and preview["errors"] == [MAIL_ERROR]


def test_an_answer_that_is_no_json_keeps_the_start_of_its_text():
    answers = {**ANSWERS, "https://preview.tumach.dance/api/health": (0, "URLError: timed out " + "x" * 400)}
    preview = records(answers)[1]
    assert preview["status"] == 0 and preview["text"].startswith("URLError: timed out")
    assert len(preview["text"]) == site_watch.TEXT_CHARS and "ok" not in preview


def test_the_first_watch_starts_the_branch_with_both_sites(tmp_path):
    remote, work = repos(tmp_path)
    assert site_watch.log_health(records(ANSWERS), root=work) == 2
    lines = log(remote)
    assert [r["site"] for r in lines] == ["live", "preview"]
    assert lines[1]["errors"][0]["where"] == "email: request"


def test_the_same_answer_adds_no_line_and_a_change_adds_one(tmp_path):
    remote, work = repos(tmp_path)
    site_watch.log_health(records(ANSWERS), root=work)
    later = NOW + datetime.timedelta(minutes=10)
    assert site_watch.log_health(records(ANSWERS, later), root=work) == 0
    assert len(log(remote)) == 2
    down = {**ANSWERS, "https://preview.tumach.dance/api/health": (503, json.dumps({"ok": False, "email": False}))}
    assert site_watch.log_health(records(down, later), root=work) == 1
    lines = log(remote)
    assert len(lines) == 3 and lines[2] == {"at": "2026-11-02T10:10:00Z", "site": "preview", "status": 503,
                                            "ok": False, "email": False}


def test_a_new_day_gets_its_own_file_and_other_files_stay(tmp_path):
    remote, work = repos(tmp_path)
    site_watch.log_health(records(ANSWERS), root=work)
    assert site_watch.log_health(records(ANSWERS, NOW + datetime.timedelta(days=1)), root=work) == 2
    assert len(log(remote, "2026-11-03")) == 2 and len(log(remote)) == 2


def test_a_push_of_another_job_first_keeps_its_file(tmp_path):
    remote, work = repos(tmp_path)
    site_watch.log_health(records(ANSWERS), root=work)
    other = str(tmp_path / "other")
    subprocess.run(["git", "clone", "-q", "--branch", "metrics", remote, other], check=True)
    for key, value in (("user.name", "pacer"), ("user.email", "pacer@example.invalid")):
        git(other, "config", key, value)
    os.makedirs(os.path.join(other, "pacer"))
    with open(os.path.join(other, "pacer", "2026-11-02.jsonl"), "w") as f:
        f.write("{}\n")
    git(other, "add", ".")
    git(other, "commit", "-q", "-m", "pacer")
    git(other, "push", "-q", "origin", "metrics")
    down = {**ANSWERS, "https://tumach.dance/api/health": (503, json.dumps({"ok": False}))}
    assert site_watch.log_health(records(down), root=work) == 1
    assert git(remote, "show", "metrics:pacer/2026-11-02.jsonl") == "{}\n"
    assert len(log(remote)) == 3


def test_no_remote_gives_none_and_no_error(tmp_path):
    work = str(tmp_path / "alone")
    subprocess.run(["git", "init", "-q", work], check=True)
    assert site_watch.log_health(records(ANSWERS), root=work) is None
