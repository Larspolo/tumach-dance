# Pitfalls

Lessons for some tickets only (moved from `docs/LEARNINGS.md`, #459). Read the section of your topic.

## Browser tests

- The browser tests fail at random on a console error for `/favicon.ico` when a site has no icon: `src/app/icon.png` (#19).
- Better Auth limits `/sign-in/*` to 3 tries per 10 seconds: one code login per Playwright test, or the next login gets "Something went wrong" (429, #26).
- Next.js adds an empty `role="alert"` (the route announcer): check an error by its text, not by `getByRole("alert")` (#26).
- Headless Chromium has no push service: `pushManager.subscribe` fails. A browser test stubs `PushManager.prototype.subscribe` (`e2e/push.spec.ts`, #25).
- Better Auth email-otp sends at most 3 codes a minute: a browser test that needs a session uses `storageState: STUDIO_SESSION` of `e2e/studio.setup.ts`, not its own login (#23).
- The headless shell of Playwright gives `Notification.permission` "denied" after `grantPermissions` (`permissions.query`: "granted"). A test of a permission uses `test.use({ channel: "chromium" })` (#188).
- A browser test that books on the first day of `/book` (today) fails in the evening: today has one or two free times left. Choose the last day (`e2e/book.spec.ts`, #313).
- `globals.css` has `scroll-behavior: smooth`: `window.scrollTo(0, 0)` before a screenshot animates, and the image catches the page halfway. Use `{ top: 0, behavior: "instant" }` (#453).
- With `javaScriptEnabled: false`, a `click()` just after a `fill()` low on the page can wait 30 s on "element is not stable": the smooth scroll to the field still runs, and each retry starts a new one. Wait until `window.scrollY` stops (`scrollEnds` of `e2e/book-email-typo-nojs.spec.ts`, #508).

## Database

- Drizzle `migrate()` (better-sqlite3) reads the last migration before its `BEGIN`: two starts at once fail ("table already exists"). Use `runMigrations` of `src/db/migrate.ts` (#14).
- `PRAGMA journal_mode = WAL` ignores the busy timeout: two starts on a new database get `SQLITE_BUSY`. Use `setWalMode` of `src/db/wal.ts`; a race test of processes waits for one start instant, else it passes by chance (#180).
- `drizzle-kit generate` of a new `.notNull()` column with no default gives `ALTER TABLE ADD ... NOT NULL`: SQLite refuses it. Rebuild the table in the migration (`drizzle/0014_outstanding_junta.sql`, #164).

## Next.js

- A `headers()` call in `src/i18n/request.ts` gives a 500 on each not-found page (static to dynamic). Read the request in the page (`setStudioLocale`, #19).
- A layout `metadata.icons` replaces the icon of `src/app/icon.png`: give it an `icon` too, or the browser asks `/favicon.ico` (404, console error; #71).
- Next.js 16 `src/proxy.ts` cuts a request body at 10 MB (`experimental.proxyClientMaxBodySize`), also when `serverActions.bodySizeLimit` is larger: set both (`next.config.ts`, #173).
- Lighthouse mobile (simulated) counts each request that ends before the first paint, and on a local server the first paint comes after the scripts: the LCP of a page follows its bytes of fonts and JavaScript. `subsets` of `next/font` is only the preload; `NextIntlClientProvider` with no `messages` puts all the texts in each page (#453).
- `pkill -f "next start"` misses the server: its process is `next-server`. A server that still runs on the port answers with the old build (#453).
- The LCP median of 3 Lighthouse runs of one build moves up to 0.5 s from run to run: compare a change with `--runs 5` of main and of the branch, one after the other (#491).
- The CSP nonce reaches the page only in the request headers: `NextResponse.next({ request: { headers } })`. A plain `NextResponse.next()` (`studio-guard.ts`) drops it, and the scripts of the page do not run. The CSP of `src/proxy.ts` replaces the one of `next.config.ts` (one header, #491).

## Photos

- sharp: `withExif({ IFD0: { Orientation } })` does not set the orientation of a test photo; `withMetadata({ orientation: 6 })` does (`tests/photos.test.ts`, #171).

## Home server

- A Proxmox VM of CPU type `kvm64` has no SSE4 (host: N100): sharp failed at the start. VM 110 is `host` now (`docs/ENVIRONMENT.md`).
