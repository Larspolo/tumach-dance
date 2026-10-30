#!/bin/bash
# Install the Python and Node dependencies in a Claude Code cloud session, so that tests and lint work.
set -euo pipefail

# The merge driver of game/data/*.jsonl (.gitattributes, #2004): merge the lines by "name", not by union. Also local.
# A copy in the git directory: an older branch that merges main does not have framework/tools/merge_jsonl.py in its tree.
( cd "${CLAUDE_PROJECT_DIR:-.}" && gd=$(git rev-parse --path-format=absolute --git-common-dir) &&
  cp framework/tools/merge_jsonl.py framework/tools/merge_json.py "$gd/" && git config merge.jsonl.driver "python3 $gd/merge_jsonl.py %O %A %B" \
  && git config merge.json.driver "python3 $gd/merge_json.py %O %A %B" ) || true   # merge.json: messages/*.json (#131)

# The Bash tool of a cloud session has no TMPDIR: "$TMPDIR/x.py" was "/x.py" (#2032).
if [ -n "${CLAUDE_ENV_FILE:-}" ] && [ -z "${TMPDIR:-}" ]; then
  echo "export TMPDIR=/tmp" >> "$CLAUDE_ENV_FILE"
fi

# The Claude account of the run (#4236, docs/COLLABORATORS.md): the variable AGENT_ACCOUNT of the cloud environment
# of each collaborator. framework/tools/claim.py, framework/tools/report.py and framework/tools/usage.py write it into their lines.
if [ -n "${AGENT_ACCOUNT:-}" ]; then
  ( cd "${CLAUDE_PROJECT_DIR:-.}" && git config tumach-dance.account "$AGENT_ACCOUNT" ) || true
fi

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# scripts/cloud-setup.sh puts Node 24 in /usr/local/bin, but the PATH of the image has /opt/node22/bin first: the npm 10
# of Node 22 drops the `libc` fields of package-lock.json (2026-10-30). Put /usr/local/bin first, also for the agent.
if [ -x /usr/local/bin/node ] && [ "$(command -v node)" != /usr/local/bin/node ] &&
   /usr/local/bin/node -e 'process.exit(process.versions.node.split(".")[0] >= 24 ? 0 : 1)' 2>/dev/null; then
  export PATH="/usr/local/bin:$PATH"
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo 'export PATH="/usr/local/bin:$PATH"' >> "$CLAUDE_ENV_FILE"
  fi
fi

PIP="python3 -m pip install --quiet --disable-pip-version-check --root-user-action=ignore"
$PIP -r requirements-dev.txt

# The Node packages of package-lock.json: again only when the lock file is newer than the last install.
if [ -f package-lock.json ] && ! [ node_modules/.package-lock.json -nt package-lock.json ]; then
  npm ci --no-audit --no-fund --silent || true
fi
# The Playwright browser of the version in package-lock.json (verify skill, levels 3 and 4); it skips a browser that is there.
if [ -x node_modules/.bin/playwright ]; then
  npx playwright install chromium >/dev/null 2>&1 || true
fi

# The environment runs the setup script that the owner pasted. Tell the agent when it is older than the repository.
# One environment can serve more projects (#1964): it then has the version file of another project. With no version
# file of this project, tell the agent only when a need of SETUP_NEEDS (a command, a path or a path pattern) is missing.
want=$(sed -n 's/^SETUP_VERSION=\([0-9]*\).*/\1/p' scripts/cloud-setup.sh)
have=$(cat /etc/tumach-dance-setup-version 2>/dev/null || echo none)
read -ra needs <<< "$(sed -n 's/^SETUP_NEEDS="\([^"]*\)".*/\1/p' scripts/cloud-setup.sh)"
missing=""
for n in "${needs[@]}"; do
  compgen -G "$n" >/dev/null || command -v "$n" >/dev/null || missing="$missing $n"
done
if [ "$have" != "$want" ] && { [ "$have" != none ] || [ -n "$missing" ]; }; then
  echo "tumach-dance: the cloud environment runs setup script version $have, scripts/cloud-setup.sh is version $want" \
       "(missing:${missing:- none})." \
       "If no open ticket asks the owner to paste it, make one (needs-human, P1, size:S) with the steps" \
       "of framework/docs/STEERING.md, section 'Setup script (faster start)'."
fi
