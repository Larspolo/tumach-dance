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
- Better Auth limits `/sign-in/*` to 3 tries per 10 seconds: one code login per Playwright test, or the next login gets "Something went wrong" (429, #26).
- Next.js adds an empty `role="alert"` (the route announcer): check an error by its text, not by `getByRole("alert")` (#26).
- Headless Chromium has no push service: `pushManager.subscribe` fails. A browser test stubs `PushManager.prototype.subscribe` (`e2e/push.spec.ts`, #25).
- Better Auth email-otp sends at most 3 codes a minute: a browser test that needs a session uses `storageState: STUDIO_SESSION` of `e2e/studio.setup.ts`, not its own login (#23).
- A layout `metadata.icons` replaces the icon of `src/app/icon.png`: give it an `icon` too, or the browser asks `/favicon.ico` (404, console error; #71).
- `merge_main.py --push` of a PR whose quick CI is green lets Automerge merge it in about a minute: run the browser tests of the PR on the merged tree before that push, not after (#60 merged with a broken passkey test, #83).
- The browser tests add rows to `out/e2e/tumach.db` and never clear it: delete `out/e2e` before a second `npx playwright test`, or `book.spec.ts` fails (#5).
- `PRAGMA journal_mode = WAL` ignores the busy timeout: two starts on a new database get `SQLITE_BUSY`. Use `setWalMode` of `src/db/wal.ts`; a race test of processes waits for one start instant, else it passes by chance (#180).
