# Environment

The project part of the cloud environment of tumach-dance (`framework/docs/STEERING.md`).

## Network

"Allow package managers" gives npm and PyPI. `scripts/allowed-domains.txt` adds:

- `github.com`, `raw.githubusercontent.com`: git, and the links to the images of a PR (`verify` skill, level 4).
- `nodejs.org`: Node 24 for the setup script, when the image has an older Node.
- `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, `playwright.azureedge.net`: the Playwright browser.
- `fonts.googleapis.com`, `fonts.gstatic.com`: the fonts of the site (`next/font` gets them at build time).
- `tumach.dance`: the current site, the reference of the look (a copy: `docs/design/current-site.html`).

An agent that needs another host adds it to the file and opens a `needs-human` ticket for the owner.

## Setup script

`scripts/cloud-setup.sh` installs the Python tools (pytest, ruff, numpy), Node 24 when the image has an older Node,
and the system libraries of the Playwright browser. It does not read the repository. The SessionStart hook
(`.claude/hooks/session-start.sh`) installs `requirements-dev.txt`, runs `npm ci`, and installs the Playwright browser
of the version in `package-lock.json`.

## Resources of the owner

What the owner has for the project: the computer, the devices, the accounts and licenses, the budget and the Claude
plan (the `new-project` skill writes it). Do not plan work that needs a resource that is not here: make a decision
ticket for it.

- **Computer:** Lars has a Mac (macOS, Node 24). `/try` runs `npm run dev` there.
- **Home server:** Lars's server at home (it also runs Home Assistant) hosts the current tumach.dance. The preview and
  the live site run there in Docker. The agents cannot reach it: each step on it is a `needs-human` ticket for Lars
  with numbered steps. A merge must update the preview with no step by Lars (for example an image of CI on GitHub
  Container Registry that the server pulls).
- **Domain and DNS:** tumach.dance, with the DNS at Cloudflare (Lars). The free Cloudflare features (for example a
  tunnel to the home server) are allowed.
- **Email:** a free Mailgun account. Mail to the domain (hello@tumach.dance) goes forward to Nina's Gmail. Use it to
  send the emails of the site (free up to a limit per day).
- **Payment:** Nina has an ING bank account, and no payment provider (Mollie, Stripe) yet. The payment link needs a
  decision ticket: a fee per payment is a cost.
- **Devices of Nina:** a phone and a laptop. Each page of Nina works on both; push must work on an iPhone and on
  Android (an installed web app).
- **Accounts of Nina:** no GitHub account. She answers on the page "For Nina" (`steering/project/PRINCIPLES.md`).
- **Budget:** free services only during development. The live site runs on the home server. Each cost gets a decision
  ticket.
- **Claude plan:** three lanes: the main task, a haiku lane and a deep lane.
