"""Watch the live site from GitHub (#263, option A; owner, 2026-10-31) and give the agents the error text.

    python3 tools/site_watch.py     # the Site watch workflow: each cycle of the pacer loop (10 minutes)

It reads `/api/health` (the database, the backup, the version of the image and the last server errors of
`src/lib/site-errors.ts`) and the home page `/en`. When one of them does not answer 200 in two checks one minute apart,
it opens one ticket with the label `site-down` (P0, bug): the answers, the error text and the newest merges, so that a
run can find and fix the cause. The agents cannot read the log of the home server: tumach.dance gave 500 for hours on
2026-10-31, and only Lars could see why. A changed error adds a comment to the open ticket. When the site answers
again, the watch closes the ticket. The watch never fails its own job: the ticket is the message.

Each watch also keeps the `/api/health` answer of the live site and of the preview on the branch `metrics` (#460):
`site/YYYY-MM-DD.jsonl`, one line per site when its answer changed (the first watch of a day writes both). The failed
emails show there (`email: <kind>` in `errors`), so a run reads why an email did not go out with git, with no server
log and no step by Lars:

    git fetch -q origin metrics && git show origin/metrics:site/2026-11-02.jsonl | tail -5

Env: SITE_URL (default https://tumach.dance), PREVIEW_URL (default https://preview.tumach.dance), GITHUB_TOKEN,
GITHUB_REPOSITORY. Python standard library only.
"""
import datetime
import hashlib
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

PATHS = ["/api/health", "/en"]
LABEL = "site-down"
LABELS = ["P0", "bug", "size:S", LABEL]
RETRY_SECONDS = 60
GRACE_MINUTES = 30      # a fix PR closes the ticket at its merge; the home server gets its image some minutes later
BODY_CHARS = 1500
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
METRICS = "metrics"     # the orphan branch of the logs (`framework/tools/metrics_log.py`)
LOG_DIR = "site"
HEALTH_KEYS = ("ok", "email", "backupAt", "version", "errors")
TEXT_CHARS = 300        # the start of an answer that is no JSON (a proxy page, a time-out)


def fetch(url, timeout=20):
    """(status, text) of a GET; status 0 when there is no HTTP answer (DNS, connection, time-out)."""
    request = urllib.request.Request(url, headers={"User-Agent": "tumach-site-watch", "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read(BODY_CHARS * 4).decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, error.read(BODY_CHARS * 4).decode("utf-8", "replace")
    except Exception as error:                              # URLError, a time-out, a reset
        return 0, f"{type(error).__name__}: {error}"


def check(base, get=fetch):
    """[{path, status, text}] for each path of PATHS."""
    return [{"path": path, **dict(zip(("status", "text"), get(base.rstrip("/") + path)))} for path in PATHS]


def healthy(results):
    return all(r["status"] == 200 for r in results)


def health_json(results):
    """The JSON of /api/health, or {} when its answer is no JSON (the server did not start, a proxy page)."""
    text = next((r["text"] for r in results if r["path"] == "/api/health"), "")
    try:
        data = json.loads(text)
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def fingerprint(results):
    """The same failure gives the same mark: the status of each path and the error texts (not their instants)."""
    errors = [(e.get("where"), e.get("message")) for e in health_json(results).get("errors", [])]
    key = json.dumps([[r["path"], r["status"]] for r in results] + errors)
    return hashlib.sha256(key.encode()).hexdigest()[:12]


def commits(root=ROOT, since=None, count=10):
    """The merges on main up to the commit `since` (the version of the image: the cause is in it or before it), else
    the newest merges ("hash date subject"). An unknown version (not in the checkout) gives the newest."""
    def log(*rev):
        out = subprocess.run(["git", "-C", root, "log", "--format=%h %cI %s", *rev], capture_output=True, text=True)
        return out.stdout.strip().splitlines() if out.returncode == 0 else []
    lines = log(f"-{count}", since) if since else []
    return lines or log(f"-{count}") or ["(no commits found)"]


def report(results, base, merges):
    """The Markdown of the answers, the error text and the merges."""
    out = [f"Checked at {time.strftime('%Y-%m-%d %H:%M', time.gmtime())} UTC, two times one minute apart.", ""]
    for r in results:
        text = r["text"].strip()[:BODY_CHARS] or "(empty)"
        out += [f"`GET {base.rstrip('/')}{r['path']}`: **{r['status'] or 'no answer'}**", "", "```", text, "```", ""]
    data = health_json(results)
    for e in data.get("errors", []):
        out.append(f"- Error at `{e.get('where')}` ({e.get('at')}): {e.get('message')}")
    if data.get("version"):
        out.append(f"\nThe site runs the image of commit `{data['version'][:7]}`.")
    out += ["", "The merges up to the version of the image (else the newest; the home server gets each new image "
            "within about 5 minutes):", ""]
    out += [f"- {line}" for line in merges]
    return "\n".join(out)


def ticket_body(results, base, merges, mark):
    return "\n".join([
        "## Goal",
        f"{base} answers again: `/api/health` and the home page give 200.",
        "",
        "## Context",
        "The Site watch workflow (`tools/site_watch.py`) found that the live site does not work. The agents cannot "
        "reach the home server or read its log. Use the error text below. `docs/ENVIRONMENT.md` says how to run the "
        "site on an emulated CPU like the CPU of the server. A start error shows on `/api/health`, and the start "
        "continues (`src/instrumentation.ts`). The earlier answers of the site are on the branch `metrics` "
        "(`git show origin/metrics:site/<YYYY-MM-DD>.jsonl`). When there is no error text and no merge explains the "
        "failure, ask Lars for `docker compose logs site --tail 50` (`needs-human`).",
        "",
        report(results, base, merges),
        "",
        "## Acceptance criteria",
        "- [ ] A test shows the cause, and the fix makes it pass.",
        "- [ ] After the merge and the new image, the Site watch closes this ticket (the site answers 200). The merge "
        "alone closes it too: when the site still fails, the watch opens a new ticket with the new error text.",
        "",
        "## Verify",
        "Level 2 (the build), and the run of the standalone build on the emulated CPU of the server.",
        "",
        f"<!-- site-watch: {mark} -->",
    ])


class GitHub:
    """The few calls of the watch, with the token of the workflow."""

    def __init__(self, repo, token):
        self.base, self.token = f"https://api.github.com/repos/{repo}", token

    def call(self, method, path, data=None):
        request = urllib.request.Request(self.base + path, method=method,
                                         data=json.dumps(data).encode() if data is not None else None,
                                         headers={"Authorization": f"Bearer {self.token}",
                                                  "Accept": "application/vnd.github+json"})
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read() or b"null")

    def open_tickets(self):
        return [i for i in self.call("GET", f"/issues?labels={LABEL}&state=open&per_page=10") or []
                if "pull_request" not in i]

    def comments(self, number):
        return self.call("GET", f"/issues/{number}/comments?per_page=100") or []

    def recently_closed(self, mark, minutes=GRACE_MINUTES, now=None):
        """The number of a ticket with the same failure (mark) that closed less than `minutes` ago, or None."""
        now = now or datetime.datetime.now(datetime.timezone.utc)
        for ticket in self.call("GET", f"/issues?labels={LABEL}&state=closed&sort=updated&direction=desc&per_page=3") or []:
            closed = datetime.datetime.fromisoformat((ticket.get("closed_at") or "1970-01-01T00:00:00Z").replace("Z", "+00:00"))
            if now - closed > datetime.timedelta(minutes=minutes):
                continue
            texts = [ticket.get("body") or ""] + [c.get("body") or "" for c in self.comments(ticket["number"])]
            if any(f"<!-- site-watch: {mark} -->" in t for t in texts):
                return ticket["number"]
        return None

    def create(self, title, body):
        return self.call("POST", "/issues", {"title": title, "body": body, "labels": LABELS})

    def comment(self, number, body):
        return self.call("POST", f"/issues/{number}/comments", {"body": body})

    def close(self, number):
        return self.call("PATCH", f"/issues/{number}", {"state": "closed", "state_reason": "completed"})


def watch(github, base, get=fetch, wait=time.sleep, merges=commits):
    """One watch: the action that it took ("ok", "opened #N", "updated #N", "same #N", "closed #N ...")."""
    results = check(base, get)
    if not healthy(results):
        wait(RETRY_SECONDS)
        results = check(base, get)
    open_tickets = github.open_tickets()
    if healthy(results):
        version = health_json(results).get("version", "")
        for ticket in open_tickets:
            line = f"The site answers again (`/api/health` and the home page: 200, image `{version[:7] or '?'}`)."
            github.comment(ticket["number"], line)
            github.close(ticket["number"])
        return "ok" + "".join(f", closed #{t['number']}" for t in open_tickets)
    mark = fingerprint(results)
    version = health_json(results).get("version")
    lines = merges(since=version) if version else merges()
    if not open_tickets:
        if (closed := github.recently_closed(mark)) is not None:
            return f"wait: #{closed} closed less than {GRACE_MINUTES} minutes ago with the same failure"
        title = f"Fix {base.split('//')[-1].rstrip('/')}: the live site does not work"
        ticket = github.create(title, ticket_body(results, base, lines, mark))
        return f"opened #{ticket['number']}"
    ticket = open_tickets[0]
    texts = [ticket.get("body") or ""] + [c.get("body") or "" for c in github.comments(ticket["number"])]
    if any(f"<!-- site-watch: {mark} -->" in t for t in texts):
        return f"same #{ticket['number']}"
    github.comment(ticket["number"], "The failure changed.\n\n" + report(results, base, lines) + f"\n\n<!-- site-watch: {mark} -->")
    return f"updated #{ticket['number']}"


def health_record(site, base, get=fetch, now=None):
    """The line of the log of one site: its name, the HTTP status and the fields of `/api/health` (the start of the
    text when the answer is no JSON). The text is public: `/api/health` keeps no personal data (`site-errors.ts`)."""
    status, text = get(base.rstrip("/") + "/api/health")
    data = health_json([{"path": "/api/health", "text": text}])
    record = {"at": (now or datetime.datetime.now(datetime.timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ"),
              "site": site, "status": status, **{k: data[k] for k in HEALTH_KEYS if k in data}}
    if not data:
        record["text"] = text.strip()[:TEXT_CHARS]
    return record


def new_lines(old_text, records):
    """The records that differ (all but `at`) from the last line of the same site in `old_text`."""
    last = {}
    for line in old_text.splitlines():
        try:
            rec = json.loads(line)
        except ValueError:
            continue
        if isinstance(rec, dict):
            last[rec.get("site")] = {k: v for k, v in rec.items() if k != "at"}
    return [r for r in records if last.get(r["site"]) != {k: v for k, v in r.items() if k != "at"}]


def log_health(records, root=ROOT, remote="origin", tries=5):
    """Add the changed records to `site/<day>.jsonl` of the branch `metrics`, with no checkout: a commit on the newest
    tip, and again on the new tip when another job pushed first (the pacer logs there too). Gives the number of added
    lines, or None when no push went through."""
    day = records[0]["at"][:10]
    path, ref = f"{LOG_DIR}/{day}.jsonl", f"refs/remotes/{remote}/{METRICS}"
    sh = lambda *a, env=None, data=None: subprocess.run(["git", "-C", root, *a], capture_output=True, text=True,
                                                         timeout=60, input=data, env=env)
    try:
        for _ in range(tries):
            tip = sh("fetch", "-q", "--depth", "1", remote, f"+refs/heads/{METRICS}:{ref}").returncode == 0
            old = sh("show", f"{ref}:{path}") if tip else None
            old_text = old.stdout if old is not None and old.returncode == 0 else ""
            lines = new_lines(old_text, records)
            if not lines:
                return 0
            text = old_text + "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in lines)
            blob = sh("hash-object", "-w", "--stdin", data=text).stdout.strip()
            with tempfile.TemporaryDirectory() as d:
                env = {**os.environ, "GIT_INDEX_FILE": os.path.join(d, "index")}
                if tip:
                    sh("read-tree", ref, env=env)
                sh("update-index", "--add", "--cacheinfo", f"100644,{blob},{path}", env=env)
                tree = sh("write-tree", env=env).stdout.strip()
            message = f"Add the site health {path}: " + ", ".join(f"{r['site']} {r['status']}" for r in lines)
            commit = sh("commit-tree", tree, *(["-p", ref] if tip else []), "-m", message).stdout.strip()
            if commit and sh("push", "-q", remote, f"{commit}:refs/heads/{METRICS}").returncode == 0:
                return len(lines)
    except (subprocess.TimeoutExpired, OSError):
        pass
    return None


def main():
    base = os.environ.get("SITE_URL") or "https://tumach.dance"
    preview = os.environ.get("PREVIEW_URL") or "https://preview.tumach.dance"
    repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not (repo and token):
        sys.exit("site_watch: set GITHUB_REPOSITORY and GITHUB_TOKEN")
    try:
        print(f"site watch {base}: {watch(GitHub(repo, token), base)}")
    except Exception as error:                              # a GitHub error: the next watch tries again
        print(f"site watch {base}: GitHub error: {error}", file=sys.stderr)
    added = log_health([health_record("live", base), health_record("preview", preview)])
    print(f"site health log: {'no push' if added is None else f'{added} new lines'} ({METRICS}:{LOG_DIR}/)")


if __name__ == "__main__":
    main()
