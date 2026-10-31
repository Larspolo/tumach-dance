"""Build the owner's dashboard page (GitHub Pages, #118) from the body of the status issue and the roadmap.

    python3 framework/tools/dashboard.py --out out/dashboard.md   # the body (the Dashboard workflow)
    python3 tools/dashboard_site.py out/dashboard.md              # writes out/site/index.html

The section "Goals": each feature of steering/project/ROADMAP.md with its state (done, the epic "N of M", or not
started). The sections of #1: the GitHub Markdown API makes the HTML (links for #72). One file, no JavaScript.
Token: GITHUB_TOKEN (as dashboard.py). Python standard library only.
"""
import argparse
import datetime
import html
import json
import os
import re
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "framework", "tools"))
import dashboard  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SECTIONS = ["Waiting for you", "Working on", "Next up", "Recently done"]
FEATURE = re.compile(r"^- \[([ xX])\] `([^`]+)` (.*)$")

CSS = """
body{font-family:system-ui,sans-serif;margin:0 auto;max-width:44rem;padding:1rem;line-height:1.45;color:#222;
background:#faf8f5}
h1{font-size:1.4rem}h2{font-size:1.15rem;margin-top:1.6rem;border-bottom:1px solid #ddd}h3{font-size:1rem}
ul{padding-left:1.2rem}li{margin:.25rem 0}a{color:#0b5cad}table{border-collapse:collapse;font-size:.9rem}
td,th{border:1px solid #ddd;padding:.2rem .4rem}.done{color:#2a7a2a}.work{color:#a86400}.todo{color:#777}
.time{color:#777;font-size:.85rem}
"""


def goals(roadmap):
    """[(goal title, [(key, text, done)])] of the roadmap text."""
    out = []
    for line in roadmap.splitlines():
        if line.startswith("## "):
            out.append((line[3:].strip(), []))
        elif out and (m := FEATURE.match(line)):
            out[-1][1].append((m.group(2), m.group(3).strip(), m.group(1) != " "))
    return out


def epic_for(key, epics):
    return next((e for e in epics if f"Roadmap: `{key}`" in (e.get("body") or "")), None)


def goals_html(roadmap, epics):
    out = ["<h2>Goals</h2>"]
    for title, features in goals(roadmap):
        out += [f"<h3>{html.escape(title)}</h3>", "<ul>"]
        for key, text, done in features:
            epic = epic_for(key, epics)
            if done:
                state = '<span class="done">done</span>'
            elif epic:
                s = epic.get("sub_issues_summary") or {}
                link = f'<a href="{html.escape(epic["html_url"])}">#{epic["number"]}</a>'
                state = (f'<span class="work">in work: {s.get("completed", 0)} of {s.get("total", 0)}</span> '
                         f"({link} {html.escape(epic['title'])})")
            else:
                state = '<span class="todo">not started</span>'
            out.append(f"<li><code>{html.escape(key)}</code> {html.escape(text)}: {state}</li>")
        out.append("</ul>")
    return "\n".join(out)


def sections(body):
    """The markdown of the sections of #1 that the page shows."""
    parts = re.split(r"^### ", body or "", flags=re.M)
    keep = [p for p in parts[1:] if p.split("\n", 1)[0].strip() in SECTIONS]
    return "\n".join("### " + p.strip() + "\n" for p in keep)


def markdown(text):
    """HTML of GitHub (it removes scripts and makes #72 a link). Not dashboard.api(): the answer is HTML, not JSON,
    and the address is not under repos/."""
    if not text.strip():
        return ""
    data = json.dumps({"text": text, "mode": "gfm", "context": dashboard.REPO})
    token = os.environ.get("GITHUB_TOKEN")
    if not token:                                  # cloud sessions: gh has the credentials
        return subprocess.run(["gh", "api", "markdown", "--input", "-"], input=data, capture_output=True, text=True,
                              check=True).stdout
    req = urllib.request.Request("https://api.github.com/markdown", method="POST", data=data.encode(),
                                 headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
                                          "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as f:
        return f.read().decode()


def page(roadmap, epics, body_html, now):
    stamp = now.astimezone(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="300">
<title>tumach-dance dashboard</title><style>{CSS}</style></head>
<body><h1>tumach-dance dashboard</h1>
<p class="time">Updated {html.escape(stamp)}</p>
{goals_html(roadmap, epics)}
<h2>Status</h2>
{body_html}
</body></html>
"""


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("body", help="the file of dashboard.py --out")
    ap.add_argument("--site", default=os.path.join(ROOT, "out", "site"), help="the output directory")
    a = ap.parse_args(argv)
    with open(a.body, encoding="utf-8") as f:
        body = f.read()
    with open(os.path.join(ROOT, "steering", "project", "ROADMAP.md"), encoding="utf-8") as f:
        roadmap = f.read()
    epics = [e for e in dashboard.api("issues?labels=epic&state=all&per_page=100") if "pull_request" not in e]
    os.makedirs(a.site, exist_ok=True)
    with open(os.path.join(a.site, "index.html"), "w", encoding="utf-8") as f:
        f.write(page(roadmap, epics, markdown(sections(body)), datetime.datetime.now(datetime.timezone.utc)))
    print(f"wrote {a.site}/index.html")
    return 0


if __name__ == "__main__":
    sys.exit(main())
