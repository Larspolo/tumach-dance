// A failing part of the start (2026-10-31): register() must not throw. Next.js stops the start of the server when it
// throws, and then each page gives 500 and /api/health does not answer: the site watch saw no cause.
import { afterEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { clearErrors, siteErrors } from "../src/lib/site-errors";

const db = openDb(":memory:");

afterEach(() => {
  clearErrors();
  vi.unstubAllEnvs();
  vi.doUnmock("../src/db");
  vi.doUnmock("../src/lib/booking-timer");
  vi.doUnmock("../src/lib/backup");
  vi.restoreAllMocks();
  vi.resetModules();
});

async function startWithBrokenBackup() {
  vi.resetModules();
  const bookings = vi.fn();
  vi.doMock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => db }));
  vi.doMock("../src/lib/booking-timer", () => ({ startBookingTimer: bookings }));
  vi.doMock("../src/lib/backup", () => {
    throw new Error('Could not load the "sharp" module using the linux-x64 runtime\nUnsupported CPU');
  });
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("GITHUB_TOKEN", "");
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { register } = await import("../src/instrumentation");
  await register();
  return bookings;
}

test("a failing start part does not stop the start, and the other parts run", async () => {
  const bookings = await startWithBrokenBackup();
  expect(bookings).toHaveBeenCalledWith(db);
  expect(siteErrors()).toEqual([expect.objectContaining({ where: "start: backup timer", start: true })]);
});

test("/api/health answers 503 with the start error and the version", async () => {
  await startWithBrokenBackup();
  vi.stubEnv("SITE_VERSION", "0b82802abc");
  // The health module imports the backup module too: the address must still answer, with the error text.
  const { GET } = await import("../src/app/api/health/route");
  const response = await GET();
  const body = await response.json();
  expect(response.status).toBe(503);
  expect(body.ok).toBe(false);
  expect(body.version).toBe("0b82802abc");
  expect(body.errors.map((e: { where: string }) => e.where)).toEqual(["start: backup timer", "GET /api/health"]);
  expect(body.errors[0].message).toContain("sharp");
});

test("an error of a request is kept with its path and no query", async () => {
  const { onRequestError } = await import("../src/instrumentation");
  const context = {
    routerKind: "App Router",
    routePath: "/[locale]",
    routeType: "render",
    revalidateReason: undefined,
  } as const;
  await onRequestError(new Error("boom"), { path: "/en/book?email=a@b.nl", method: "GET", headers: {} }, context);
  expect(siteErrors()).toEqual([expect.objectContaining({ where: "GET /en/book", message: "Error: boom" })]);
});
