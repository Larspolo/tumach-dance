// The login of the studio app with a code by email (#19).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { createAuth, SESSION_DAYS } from "../src/lib/auth";
import { emailTransport } from "../src/lib/email";

const NINA = "nina@example.test";
const BASE = "http://localhost:3000";
let dir: string;
let emailLog: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-auth-"));
  emailLog = join(dir, "email.log");
  vi.stubEnv("STUDIO_EMAIL", NINA.toUpperCase());
  vi.stubEnv("EMAIL_LOG_FILE", emailLog);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function setup(base = BASE) {
  const db = openDb(":memory:");
  const auth = createAuth(db, base);
  const post = (path: string, body: object, headers: Record<string, string> = {}) =>
    auth.handler(
      new Request(`${base}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: base, ...headers },
        body: JSON.stringify(body),
      }),
    );
  const sendCode = (email: string, headers?: Record<string, string>) =>
    post("/email-otp/send-verification-otp", { email, type: "sign-in" }, headers);
  const logIn = (email: string, otp: string) => post("/sign-in/email-otp", { email, otp });
  const rows = (table: string) => db.$client.prepare(`SELECT * FROM "${table}"`).all() as Record<string, unknown>[];
  return { db, auth, sendCode, logIn, rows };
}

function emails(): { to: string; subject: string; text: string }[] {
  try {
    return readFileSync(emailLog, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

function lastCode(): string {
  const code = emails()
    .at(-1)
    ?.text.match(/\b\d{6}\b/)?.[0];
  if (!code) throw new Error("no code in the email log");
  return code;
}

function sessionCookie(response: Response): string {
  const cookie = response.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!cookie) throw new Error("no session cookie");
  return cookie;
}

test("the allowed email gets a code of 6 digits, and the code gives a session", async () => {
  const { auth, sendCode, logIn } = setup();
  const sent = await sendCode("Nina@Example.test", { "accept-language": "nl-NL,nl;q=0.9" });
  expect(sent.status).toBe(200);
  expect(emails()).toHaveLength(1);
  expect(emails()[0].to).toBe(NINA);
  expect(emails()[0].subject).toContain("Je TUMACH-code");

  const response = await logIn(NINA, lastCode());
  expect(response.status).toBe(200);
  const cookie = sessionCookie(response).split(";")[0];
  const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
  expect(session?.user.email).toBe(NINA);
});

test("another email gets no code, no account and no session, with the same answer as the allowed email", async () => {
  const { sendCode, logIn, rows } = setup();
  const allowed = await sendCode(NINA);
  const other = await sendCode("someone@example.test");
  expect(other.status).toBe(allowed.status);
  expect(await other.json()).toEqual(await allowed.json());
  expect(emails().map((e) => e.to)).toEqual([NINA]);
  expect(rows("verification")).toHaveLength(1);

  const response = await logIn("someone@example.test", lastCode());
  expect(response.status).toBe(400);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(rows("user")).toEqual([]);
  expect(rows("session")).toEqual([]);
});

test("no STUDIO_EMAIL: nobody gets a code", async () => {
  vi.stubEnv("STUDIO_EMAIL", "");
  const { sendCode, rows } = setup();
  expect((await sendCode(NINA)).status).toBe(200);
  expect(emails()).toEqual([]);
  expect(rows("verification")).toEqual([]);
});

test("a wrong code gives no session, and after 5 tries the right code does not work either", async () => {
  const { sendCode, logIn, rows } = setup();
  await sendCode(NINA);
  const code = lastCode();
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i += 1) expect((await logIn(NINA, wrong)).status).toBeGreaterThanOrEqual(400);
  const response = await logIn(NINA, code);
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(response.headers.getSetCookie()).toEqual([]);
  expect(rows("session")).toEqual([]);
});

test("the code is stored as a hash and expires after 10 minutes", async () => {
  const { sendCode, logIn, rows, db } = setup();
  const before = Date.now();
  await sendCode(NINA);
  const [row] = rows("verification");
  expect(String(row.value)).not.toContain(lastCode());
  const expiresAt = Number(row.expires_at);
  expect(expiresAt - before).toBeGreaterThanOrEqual(10 * 60_000 - 1_000);
  expect(expiresAt - before).toBeLessThanOrEqual(10 * 60_000 + 5_000);

  db.$client.prepare("UPDATE verification SET expires_at = ?").run(Date.now() - 1);
  const response = await logIn(NINA, lastCode());
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect(rows("session")).toEqual([]);
});

test("the session cookie is HttpOnly and lasts at least 180 days; Secure on the https site only", async () => {
  for (const [base, secure] of [
    ["http://localhost:3000", false],
    ["https://tumach.dance", true],
  ] as const) {
    const { sendCode, logIn, rows } = setup(base);
    await sendCode(NINA);
    const cookie = sessionCookie(await logIn(NINA, lastCode()));
    const attributes = cookie.split(";").map((part) => part.trim().toLowerCase());
    expect(attributes).toContain("httponly");
    expect(attributes.includes("secure")).toBe(secure);
    const maxAge = Number(attributes.find((a) => a.startsWith("max-age="))?.split("=")[1]);
    expect(maxAge).toBeGreaterThanOrEqual(SESSION_DAYS * 24 * 60 * 60);
    const [session] = rows("session");
    expect(Number(session.expires_at) - Date.now()).toBeGreaterThanOrEqual(SESSION_DAYS * 24 * 60 * 60_000 - 60_000);
  }
});

test("the live server has no log transport for email: with no Mailgun key it refuses to send a code", async () => {
  expect(() => emailTransport({ NODE_ENV: "production" })).toThrow(/MAILGUN_API_KEY/);
  expect(emailTransport({ NODE_ENV: "production", EMAIL_TRANSPORT: "log" })).toBe("log");
  expect(emailTransport({ NODE_ENV: "production", MAILGUN_API_KEY: "k", MAILGUN_DOMAIN: "mg.example" })).toBe(
    "mailgun",
  );
  expect(emailTransport({ NODE_ENV: "development" })).toBe("log");

  vi.stubEnv("NODE_ENV", "production");
  const { sendCode } = setup();
  expect((await sendCode(NINA)).status).toBe(500);
  expect((await sendCode("someone@example.test")).status).toBe(500);
  expect(emails()).toEqual([]);
});
