// The guard of the studio app (#19): no session, no data. It runs `src/proxy.ts` as Next.js runs it.
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { isStudioPath, LOGIN_PATH } from "../src/lib/studio-paths";

const BASE = "http://localhost:3000";
const NINA = "nina@example.test";
let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "tumach-guard-"));
  vi.stubEnv("DATABASE_PATH", ":memory:");
  vi.stubEnv("STUDIO_EMAIL", NINA);
  vi.stubEnv("BETTER_AUTH_URL", BASE);
  vi.stubEnv("EMAIL_LOG_FILE", join(dir, "email.log"));
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

/** The address of each page and API route file under a folder of `src/app`. Route groups and slugs: "x". */
function routes(folder: string, file: string): string[] {
  const root = join(process.cwd(), "src/app");
  if (!existsSync(join(root, folder))) return [];
  return readdirSync(join(root, folder), { recursive: true, encoding: "utf8" })
    .filter((path) => path.split(sep).at(-1) === file)
    .map((path) => {
      const parts = relative(root, join(root, folder, path))
        .split(sep)
        .slice(0, -1);
      const segments = parts.filter((p) => !p.startsWith("(")).map((p) => (p.startsWith("[") ? "x" : p));
      return `/${segments.join("/")}`;
    });
}

async function runProxy(path: string, cookie?: string) {
  const { default: proxy } = await import("../src/proxy");
  return proxy(new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie } : {} }));
}

async function logIn(): Promise<string> {
  const { getAuth } = await import("../src/lib/auth");
  const post = (path: string, body: object) =>
    getAuth().handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE },
        body: JSON.stringify(body),
      }),
    );
  await post("/email-otp/send-verification-otp", { email: NINA, type: "sign-in" });
  const otp = readFileSync(join(dir, "email.log"), "utf8").match(/\b\d{6}\b/)?.[0];
  const response = await post("/sign-in/email-otp", { email: NINA, otp });
  const cookie = response.headers.getSetCookie().find((c) => c.includes("session_token="));
  if (!cookie) throw new Error("no session cookie");
  return cookie.split(";")[0];
}

const pages = routes("studio", "page.tsx").filter((path) => path !== LOGIN_PATH);
// No studio API route yet: the guard covers the whole prefix, so a future one is covered too.
const apiRoutes = [...routes("api/studio", "route.ts"), "/api/studio/bookings"];

test("the test finds the studio pages, and each studio page and API route is a studio path", () => {
  expect(pages).toContain("/studio");
  expect(routes("studio", "page.tsx")).toContain(LOGIN_PATH);
  for (const path of [...pages, ...apiRoutes]) expect(isStudioPath(path)).toBe(true);
  for (const path of ["/en", "/nl/studios", "/api/auth/get-session", "/studiox"])
    expect(isStudioPath(path)).toBe(false);
});

test("the proxy runs for each studio API route (its matcher)", async () => {
  const { config } = await import("../src/proxy");
  expect(config.matcher).toContain("/api/studio/:path*");
});

test("with no session, each studio page goes to the login page", async () => {
  for (const path of pages) {
    const response = await runProxy(path);
    expect(response.status, path).toBe(307);
    expect(new URL(response.headers.get("location") ?? "").pathname, path).toBe(LOGIN_PATH);
  }
});

test("with no session or a false cookie, a studio API route answers 401", async () => {
  for (const path of apiRoutes) {
    expect((await runProxy(path)).status, path).toBe(401);
    expect((await runProxy(path, "better-auth.session_token=forged.value")).status, path).toBe(401);
  }
});

test("the login page opens with no session", async () => {
  const response = await runProxy(LOGIN_PATH);
  expect(response.headers.get("x-middleware-next")).toBe("1");
});

test("with the session of Nina, the studio pages and API routes open", async () => {
  const cookie = await logIn();
  for (const path of [...pages, ...apiRoutes]) {
    const response = await runProxy(path, cookie);
    expect(response.headers.get("x-middleware-next"), path).toBe("1");
  }
});

test("the public pages still get the locale of next-intl", async () => {
  const response = await runProxy("/");
  expect(response.status).toBe(307);
  expect(new URL(response.headers.get("location") ?? "").pathname).toBe("/en");
});
