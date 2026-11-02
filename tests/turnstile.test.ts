// Cloudflare Turnstile on the public forms (#564).
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { contentSecurityPolicy } from "../src/lib/csp";
import { TURNSTILE_FIELD, turnstileReason, turnstileSiteKey } from "../src/lib/turnstile";

const form = (token?: string) => {
  const f = new FormData();
  if (token !== undefined) f.set(TURNSTILE_FIELD, token);
  return f;
};
const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SITE_KEY", "site");
  vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");
});
afterEach(() => vi.unstubAllEnvs());

test("with no keys the check is off", async () => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "");
  const fetcher = answer({ success: false });
  expect(await turnstileReason(form(), "1.2.3.4", fetcher)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  expect(turnstileSiteKey()).toBe("");
});

test("the site key shows only with a secret", () => {
  expect(turnstileSiteKey()).toBe("site");
});

test("a good token passes and sends the secret and the address", async () => {
  const fetcher = answer({ success: true });
  expect(await turnstileReason(form("tok"), "1.2.3.4", fetcher)).toBeNull();
  const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(url).toContain("/turnstile/v0/siteverify");
  const body = init.body as URLSearchParams;
  expect(body.get("secret")).toBe("secret");
  expect(body.get("response")).toBe("tok");
  expect(body.get("remoteip")).toBe("1.2.3.4");
});

test("a bad or missing token fails", async () => {
  expect(await turnstileReason(form("tok"), "x", answer({ success: false }))).toBe("turnstile");
  expect(await turnstileReason(form(), "x", answer({ success: true }))).toBe("turnstile");
});

test("an outage of Cloudflare never stops a dancer", async () => {
  const down = vi.fn(async () => {
    throw new Error("down");
  }) as unknown as typeof fetch;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await turnstileReason(form("tok"), "x", down)).toBeNull();
  expect(await turnstileReason(form("tok"), "x", answer({}, 500))).toBeNull();
});

test("the policy allows the script and the frame of Turnstile", () => {
  const csp = contentSecurityPolicy("abc");
  expect(csp).toContain("frame-src https://challenges.cloudflare.com");
  expect(csp).toContain("connect-src 'self' https://challenges.cloudflare.com");
});
