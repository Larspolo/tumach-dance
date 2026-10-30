#!/bin/bash
# The setup script of the cloud environment: the owner pastes it into the environment settings (framework/docs/SYSTEM.md).
# It runs as root before Claude Code starts, and the cloud keeps the result as a snapshot for some days. It does not
# read the repository: the SessionStart hook (.claude/hooks/session-start.sh) runs `npm ci` and the pip install.
# It must not fail: each step ends with `|| true`.
set -u
SETUP_VERSION=1   # raise it with each change: the SessionStart hook compares it with /etc/tumach-dance-setup-version
SETUP_NEEDS="node npm"    # the commands or paths that it installs: the hook checks them with the setup script of another project

PIP="python3 -m pip install --quiet --disable-pip-version-check --root-user-action=ignore"
$PIP numpy "pytest>=8" "ruff>=0.6" || true

# Node 24 (package.json "engines": Vitest needs 22.12 or newer); the image can have an older Node. `n` gets it from nodejs.org.
node -e 'process.exit(process.versions.node.split(".")[0] >= 24 ? 0 : 1)' 2>/dev/null ||
  { npm install -g --silent n && n 24; } || true

# The system libraries of the Playwright browser (verify skill, levels 3 and 4). The hook installs the browser itself:
# it must match the Playwright version of package-lock.json.
npx -y playwright install-deps chromium || true

echo "$SETUP_VERSION" > /etc/tumach-dance-setup-version || true
