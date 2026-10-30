---
name: verify
description: Verify a change to tumach-dance before commit. Selects the check level (lint and fast tests, the build, browser tests, screenshots for the PR) from the type of change. Use before each commit and when a ticket says "verify".
---

# Verify a change

Do the levels from cheap to expensive that the change needs. Write the result of each check in the PR body.

## Level 1: lint and fast tests (each change)

    ruff check . && npx @biomejs/biome check .
    python3 -m pytest -q && npx vitest run

Both must pass before the commit. `npx @biomejs/biome check --write .` fixes the format. A change of the logic
(`src/lib/`: slots, bookings, times) gets a Vitest test; a time test covers the change to and from summer time.

## Level 2: the build (a change of a page, a dependency or the configuration)

    npm run build

The build also checks the types. A change of `Dockerfile` or `deploy/`: `docker build .` when Docker is there, else
say in the PR that the image build of CI checks it.

## Level 3: browser tests (a change of a page or a flow)

    npx playwright test

A new flow (book a slot, approve a request, an answer of Nina) gets a Playwright test in `e2e/`. Before the first
Playwright test exists, the first ticket that needs one adds `@playwright/test` and `playwright.config.ts`.

## Level 4: images in the PR (each change that a user sees)

1. Make screenshots of each changed page with Playwright: a phone (390×844) and a laptop (1280×800). A change of a
   text: also the pages in Dutch and Slovenian.
2. Look at each image with the Read tool. Compare it with the look of `docs/design/current-site.html` (P2): the
   colors, the fonts, the space, no text that runs out of its box. No text comes from the old site (P2).
3. The GitHub API cannot upload images. Push them as an orphan commit (`git mktree`, `git commit-tree`) to
   `refs/heads/checks/N` (N = the ticket) and link `https://raw.githubusercontent.com/OWNER/NAME/checks/N/FILE.png`
   (`repo` of `agent.toml`) in the PR body. A second set: build the tree from the old tree and the new files, else
   the old links break.
4. Describe in the PR body what each image shows. Never commit images to `main`.
