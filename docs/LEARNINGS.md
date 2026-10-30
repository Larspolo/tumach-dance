# Learnings

The agent writes here what it learned the hard way. Each line must save time in a later session.

## Environment and libraries

- `npm --version` 10 (Node 22 of the image, before the hook fix of #16): npm 10 drops the `libc` fields of `package-lock.json`. Install with `npx -y npm@11 install --save-exact`.

## Code

- Luxon: `DateTime.set({ hour })` takes the first instant of a local time that exists twice (end of summer time), `DateTime.fromISO()` the second. `src/lib/hours.ts` uses `set()`.
- Drizzle `migrate()` (better-sqlite3) reads the last migration before its `BEGIN`: two starts at once fail ("table already exists"). Use `runMigrations` of `src/db/migrate.ts` (#14).
- next-intl ESM imports `next/server` with no extension: Vitest needs `server.deps.inline: ["next-intl"]` (#19).
- A `headers()` call in `src/i18n/request.ts` gives a 500 on each not-found page (static to dynamic). Read the request in the page (`setStudioLocale`, #19).
- The browser tests fail at random on a console error for `/favicon.ico` when a site has no icon: `src/app/icon.png` (#19).
