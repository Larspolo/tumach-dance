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
- sharp: `withExif({ IFD0: { Orientation } })` does not set the orientation of a test photo; `withMetadata({ orientation: 6 })` does (`tests/photos.test.ts`, #171).
- `PRAGMA journal_mode = WAL` ignores the busy timeout: two starts on a new database get `SQLITE_BUSY`. Use `setWalMode` of `src/db/wal.ts`; a race test of processes waits for one start instant, else it passes by chance (#180).
- The headless shell of Playwright gives `Notification.permission` "denied" after `grantPermissions` (`permissions.query`: "granted"). A test of a permission uses `test.use({ channel: "chromium" })` (#188).
- Next.js 16 `src/proxy.ts` cuts a request body at 10 MB (`experimental.proxyClientMaxBodySize`), also when `serverActions.bodySizeLimit` is larger: set both (`next.config.ts`, #173).
- `drizzle-kit generate` of a new `.notNull()` column with no default gives `ALTER TABLE ADD ... NOT NULL`: SQLite refuses it. Rebuild the table in the migration (`drizzle/0014_outstanding_junta.sql`, #164).
- A Proxmox VM of CPU type `kvm64` has no SSE4 (host: N100): sharp failed at the start. VM 110 is `host` now (`docs/ENVIRONMENT.md`).
- A browser test that books on the first day of `/book` (today) fails in the evening: today has one or two free times left. Choose the last day (`e2e/book.spec.ts`, #313).
