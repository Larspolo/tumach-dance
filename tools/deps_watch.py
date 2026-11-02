"""Open one ticket when a library of the image has a known security problem (#412).

    python3 tools/deps_watch.py            # the Deps watch workflow: each Monday
    python3 tools/deps_watch.py --dry-run  # print the findings, call no API

It runs `npm audit --json` and keeps the findings of `moderate`, `high` and `critical` of the packages of the image:
the `dependencies` of `package.json` and the packages that they need (`npm ls --omit=dev --all --json`, less the
packages that `package-lock.json` marks dev). `npm audit
--omit=dev` of npm 10 still lists `drizzle-kit`, a development dependency: the tool does not trust it.
One open ticket at most (label `deps`); it gets a comment only when the list of findings changed. No finding: nothing
(the open ticket closes with its PR). Env: GITHUB_TOKEN, GITHUB_REPOSITORY. Python standard library only.
"""
import hashlib
import json
import os
import subprocess
import sys
import urllib.request

LABEL = "deps"
LABELS = ["P1", "bug", "size:S", LABEL]
SEVERITIES = ["moderate", "high", "critical"]
TITLE = "Update the libraries with a security problem"
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def npm_json(*args, root=ROOT):
    out = subprocess.run(["npm", *args, "--json"], cwd=root, capture_output=True, text=True)
    return json.loads(out.stdout or "{}")       # npm audit exits 1 when it finds a problem


def read_lock(root=ROOT):
    with open(os.path.join(root, "package-lock.json")) as file:
        return json.load(file)


def production_packages(tree, lock=None):
    """The names of all packages in the tree of `npm ls --omit=dev --all --json`, less the packages that the lock
    marks `dev` or `devOptional`: `npm ls` also lists the optional peers of better-auth (drizzle-kit, vitest)."""
    names, stack = set(), [tree]
    while stack:
        for name, node in (stack.pop().get("dependencies") or {}).items():
            names.add(name)
            stack.append(node or {})
    for path, entry in ((lock or {}).get("packages") or {}).items():
        if entry.get("dev") or entry.get("devOptional"):
            name = path.rsplit("node_modules/", 1)[-1]
            if not any(p.rsplit("node_modules/", 1)[-1] == name and not (e.get("dev") or e.get("devOptional"))
                       for p, e in lock["packages"].items() if p):
                names.discard(name)
    return names


def advisories(name, vulns, seen=None):
    """The advisory links of a package: its own, else those of the packages that it gets the problem from."""
    seen = seen or set()
    if name in seen or name not in vulns:
        return []
    seen.add(name)
    links = []
    for via in vulns[name].get("via", []):
        found = [via.get("url")] if isinstance(via, dict) else advisories(via, vulns, seen)
        links += [link for link in found if link and link not in links]
    return links


def fix_text(fix):
    if fix is True:
        return "`npm audit fix`"
    if isinstance(fix, dict):
        major = " (major version)" if fix.get("isSemVerMajor") else ""
        return f"{fix.get('name')} {fix.get('version')}{major}"
    return "none yet"


def findings(audit, tree, lock=None):
    """[{package, severity, links, fix}] of the production packages, sorted by name."""
    vulns, keep = audit.get("vulnerabilities") or {}, production_packages(tree, lock)
    return [{"package": name, "severity": v.get("severity"), "links": advisories(name, vulns),
             "fix": fix_text(v.get("fixAvailable"))}
            for name, v in sorted(vulns.items()) if name in keep and v.get("severity") in SEVERITIES]


def mark(found):
    return hashlib.sha256(json.dumps(found, sort_keys=True).encode()).hexdigest()[:12]


def table(found):
    rows = ["| Package | Severity | Advisory | Fix |", "|---|---|---|---|"]
    rows += [f"| `{f['package']}` | {f['severity']} | {' '.join(f['links']) or '-'} | {f['fix']} |" for f in found]
    return "\n".join(rows)


def ticket_body(found):
    return "\n".join([
        "## Goal", "The libraries of the image have no known security problem of severity moderate or more.", "",
        "## Context",
        "The Deps watch workflow (`tools/deps_watch.py`) found these problems in the packages of the image "
        "(`dependencies` of `package.json` and the packages that they need):", "", table(found), "",
        "Update with `npx -y npm@11 install --save-exact <package>@<version>` (`docs/LEARNINGS.md`: npm 10 drops the "
        "`libc` fields of `package-lock.json`). A fix of a major version can need code changes: read its notes.", "",
        "## Acceptance criteria",
        "- [ ] `python3 tools/deps_watch.py --dry-run` finds no problem.", "- [ ] The fast and browser tests pass.", "",
        "## Verify", "Level 3 (the build and the browser tests).", "",
        f"<!-- deps-watch: {mark(found)} -->",
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

    def create(self, title, body):
        return self.call("POST", "/issues", {"title": title, "body": body, "labels": LABELS})

    def comment(self, number, body):
        return self.call("POST", f"/issues/{number}/comments", {"body": body})


def watch(github, found):
    """The action that it took: "none", "opened #N", "same #N" or "updated #N"."""
    if not found:
        return "none"
    tag = f"<!-- deps-watch: {mark(found)} -->"
    tickets = github.open_tickets()
    if not tickets:
        return f"opened #{github.create(TITLE, ticket_body(found))['number']}"
    ticket = tickets[0]
    texts = [ticket.get("body") or ""] + [c.get("body") or "" for c in github.comments(ticket["number"])]
    if any(tag in t for t in texts):
        return f"same #{ticket['number']}"
    github.comment(ticket["number"], "The findings changed.\n\n" + table(found) + "\n\n" + tag)
    return f"updated #{ticket['number']}"


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    found = findings(npm_json("audit"), npm_json("ls", "--omit=dev", "--all"), read_lock())
    if "--dry-run" in argv:
        print(table(found) if found else "deps watch: no finding")
        return
    repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not (repo and token):
        sys.exit("deps_watch: set GITHUB_REPOSITORY and GITHUB_TOKEN")
    print(f"deps watch: {watch(GitHub(repo, token), found)}")


if __name__ == "__main__":
    main()
