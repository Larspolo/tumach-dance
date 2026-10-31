# tumach-dance – guide for Claude Code

tumach-dance is the website of TUMACH, the dance studio of Nina in Amsterdam (tumach.dance). It shows the studio,
lets dancers book a private lesson or the studio, and gives Nina a phone app to approve the bookings and set her hours.

The owner is **Larspolo**. Nina is the user of the studio app; she is not technical. The agent system:
`framework/docs/SYSTEM.md`. The project values: `agent.toml`. The direction: `steering/project/PRINCIPLES.md`.

## Commands

| Task | Command |
|---|---|
| Install | `python3 -m pip install -r requirements-dev.txt && npm ci` |
| Lint | `ruff check . && npx @biomejs/biome check .` (`--write` fixes the format) |
| Fast tests | `python3 -m pytest -q && npx vitest run` (one file: `npx vitest run tests/a.test.ts`) |
| Slow tests | `npx playwright test` (browser tests and the screenshots of a PR) |
| Development server | `npm run dev` (the owner's `/try`) |

Put scratch output in the scratchpad or in `out/`. Never commit a database, a `.env` file or the data of a dancer.

## Code map

Next.js 16 (App Router) in TypeScript with next-intl (`src/i18n/`, locale proxy `src/proxy.ts`). Keep this map up to date.

- `src/app/[locale]/` – the public pages (home, classes, book, the cancel link of a dancer `booking/cancel`, privacy) in each language.
- `src/app/studio/` – Nina's studio app: login, bookings, the week (`week.ts`), hours, offers, photos, the page "For Nina". No locale in its
  address (`src/i18n/studio.ts`). `src/proxy.ts` guards `/studio/*` and `/api/studio/*` (`src/lib/studio-guard.ts`).
- `src/app/api/` – the route handlers (push, email, payment, the answers of Nina).
- `src/components/` – shared page parts (the "test site" banner).
- `src/lib/` – the logic with no page: open hours to free slots, bookings, email, push, payment, the calendar feed (`calendar-*.ts`, the calendar file of a booking `booking-ics.ts`, route `src/app/api/calendar/`), the timer of the booking reminders (`booking-timer.ts`), the cancel link and its rule (`booking-cancel.ts`), the questions for Nina of a ticket (`nina-question.ts`).
  `auth.ts`: the
  login (Better Auth, code by email); `email.ts`: send an email. The settings of the server: `.env.example`.
- `src/db/` – the database schema and access (SQLite on the home server, Drizzle). `drizzle/` – the SQL migrations
  (`npm run db:generate` after a change of `src/db/schema.ts`); `src/instrumentation.ts` applies them at the start.
- `messages/` – the texts, one file per language (`en`, `nl`, `sl`).
- `public/` – the images, the app icons (`public/icons/`, made by `scripts/make-icons.ts`) and the service worker
  (push). The app manifest: `src/app/manifest.ts`.
- `tests/` – Vitest tests (`*.test.ts`) and pytest tests of the agent tools. `e2e/` – Playwright tests.
- `Dockerfile`, `deploy/` – the image and the compose files of the home server (preview and live).
- `scripts/restore.mjs` – restore the data of one night on the server (`node scripts/restore.mjs <date>`, plain Node: the image has no TypeScript).
- `tools/` – the specific agent tools: `dashboard_site.py` builds the owner's dashboard page (GitHub Pages).
- `framework/`, `.claude/`, `steering/` – the agent system.

## Rules of the domain

- **P1, simple and phone first:** few settings with good defaults; Nina does each daily task in a few taps on her
  phone; dancers book with no account (`steering/project/PRINCIPLES.md`).
- **P2:** take only the look of the current tumach.dance ("simple and chill"): its colors, fonts, space and layout
  (a copy with placeholder texts: `docs/design/current-site.html`). Never copy its texts. Write a sensible text
  yourself; ask Nina only when no text is a good option (her tagline is hers).
- Each text the user sees is in `messages/` in English, Dutch and Slovenian. Never put a text in the code.
- All times are Europe/Amsterdam time. Store an instant in UTC; test the change to and from summer time.
- The preview and the live site have separate data and keys. The preview shows a "test site" banner and sends
  email only to Nina and Lars.
- A payment goes only through the page of a payment provider. The site never sees a card or a bank number.
- Use the feature of Next.js, the browser or a well-known library first (login, push, forms, translations); write own
  code only when none does the job, and say why in the PR.

@framework/CLAUDE.md
@docs/LEARNINGS.md
