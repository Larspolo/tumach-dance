// The health of the site says whether the server can send email (#413): a production server with no keys cannot,
// and the site watch then tells Lars before a dancer misses an email.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import { openDb } from "../src/db";
import { healthStatus } from "../src/lib/health";

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-health-email-"));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// An empty backup folder and a fresh start: the backup does not decide here, only the email does.
function status(env: NodeJS.ProcessEnv) {
  const now = new Date();
  return healthStatus(openDb(":memory:"), { dir, now, startedAt: now, env });
}

test("production with no email keys has no email and is not ok", () => {
  expect(status({ NODE_ENV: "production" })).toEqual({ ok: false, backupAt: null, email: false });
});

test("production with the email keys can send email", () => {
  expect(status({ NODE_ENV: "production", MAILGUN_API_KEY: "key", MAILGUN_DOMAIN: "mg.example" })).toEqual({
    ok: true,
    backupAt: null,
    email: true,
  });
});

test("the test environment can send email (the log transport)", () => {
  expect(status({ NODE_ENV: "test" }).email).toBe(true);
});

test("EMAIL_TRANSPORT=log in production can send email", () => {
  expect(status({ NODE_ENV: "production", EMAIL_TRANSPORT: "log" })).toEqual({ ok: true, backupAt: null, email: true });
});
