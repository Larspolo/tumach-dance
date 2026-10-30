// The passkey of the studio app (#26): only a logged-in session adds one, and "Not now" stays on the device.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { createAuth } from "../src/lib/auth";
import { PASSKEY_KEY, passkeyChoice, savePasskeyChoice } from "../src/lib/passkey-offer";

const NINA = "nina@example.test";
const BASE = "https://preview.tumach.dance";
let dir: string;
let emailLog: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-passkey-"));
  emailLog = join(dir, "email.log");
  vi.stubEnv("STUDIO_EMAIL", NINA);
  vi.stubEnv("EMAIL_LOG_FILE", emailLog);
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

function request(path: string, init: RequestInit = {}) {
  return new Request(`${BASE}/api/auth${path}`, {
    ...init,
    headers: { "content-type": "application/json", origin: BASE, ...(init.headers as Record<string, string>) },
  });
}

async function logIn(auth: ReturnType<typeof createAuth>): Promise<string> {
  const body = (b: object) => ({ method: "POST", body: JSON.stringify(b) });
  await auth.handler(request("/email-otp/send-verification-otp", body({ email: NINA, type: "sign-in" })));
  const line = readFileSync(emailLog, "utf8").trim().split("\n").at(-1) ?? "{}";
  const otp = JSON.parse(line).text.match(/\b\d{6}\b/)[0];
  const response = await auth.handler(request("/sign-in/email-otp", body({ email: NINA, otp })));
  const cookie = response.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!cookie) throw new Error("no session cookie");
  return cookie.split(";")[0];
}

test("the route that adds a passkey answers 401 without a session", async () => {
  const auth = createAuth(openDb(":memory:"), BASE);
  expect((await auth.handler(request("/passkey/generate-register-options"))).status).toBe(401);
  const verify = request("/passkey/verify-registration", { method: "POST", body: JSON.stringify({ response: {} }) });
  expect((await auth.handler(verify)).status).toBe(401);
});

test("a session gets the options of a passkey for the host of the site", async () => {
  const auth = createAuth(openDb(":memory:"), BASE);
  const cookie = await logIn(auth);
  const response = await auth.handler(request("/passkey/generate-register-options", { headers: { cookie } }));
  expect(response.status).toBe(200);
  const options = await response.json();
  expect(options.rp.id).toBe("preview.tumach.dance");
  expect(options.user.name).toBe(NINA);
});

test('"Not now" and a passkey stay on the device; another value asks again', () => {
  const store = new Map<string, string>();
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
  expect(passkeyChoice(storage)).toBeNull();
  savePasskeyChoice(storage, "notNow");
  expect(passkeyChoice(storage)).toBe("notNow");
  savePasskeyChoice(storage, "added");
  expect(passkeyChoice(storage)).toBe("added");
  store.set(PASSKEY_KEY, "other");
  expect(passkeyChoice(storage)).toBeNull();
});
