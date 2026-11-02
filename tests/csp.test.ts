// The Content-Security-Policy of the site (#491).
import { expect, test } from "vitest";
import { contentSecurityPolicy, makeNonce } from "../src/lib/csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `));

test("a page allows only the scripts with its nonce", () => {
  const csp = contentSecurityPolicy("abc");
  expect(directive(csp, "default-src")).toBe("default-src 'self'");
  expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic'");
  expect(directive(csp, "worker-src")).toBe("worker-src 'self'");
  expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
});

test("no script-src allows inline scripts or eval in production", () => {
  for (const csp of [contentSecurityPolicy("abc"), contentSecurityPolicy()]) {
    expect(directive(csp, "script-src")).not.toContain("unsafe");
  }
  expect(directive(contentSecurityPolicy(), "script-src")).toBe("script-src 'self'");
});

test("development allows eval for the error stacks of React", () => {
  expect(directive(contentSecurityPolicy("abc", true), "script-src")).toContain("'unsafe-eval'");
});

test("each nonce is new and has 128 bits", () => {
  const a = makeNonce();
  expect(a).not.toBe(makeNonce());
  expect(atob(a)).toHaveLength(16);
});

test("the proxy gives each page a new nonce, in the response and in the request to the page", async () => {
  const { NextRequest } = await import("next/server");
  const { default: proxy } = await import("../src/proxy");
  const nonces = [];
  for (const path of ["/en", "/en/book", "/studio/login", "/en/book"]) {
    const response = await proxy(new NextRequest(`http://localhost:3000${path}`));
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(response.headers.get("x-middleware-request-content-security-policy"), path).toBe(csp);
    const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce, path).toBeTruthy();
    nonces.push(nonce);
  }
  expect(new Set(nonces).size).toBe(nonces.length);
});
