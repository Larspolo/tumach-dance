// The Content-Security-Policy of the site (#491): the browser runs only the scripts of the site.
// `src/proxy.ts` makes a new nonce for each page request; Next.js puts it on its own scripts (the pages are dynamic,
// so a nonce costs no static page). `next.config.ts` sends the policy with no nonce on the other responses.
// Styles keep 'unsafe-inline': `inlineCss` puts the CSS in the HTML (#453) and some parts use a style attribute,
// which a nonce does not allow. An injected style cannot run code.

/** A new random nonce (base64 of 16 random bytes). */
export function makeNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/** The policy. With a nonce, only the scripts with that nonce and the scripts that they load run. */
export function contentSecurityPolicy(nonce?: string, dev = false): string {
  const scripts = nonce ? ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"] : ["'self'"];
  // React uses eval in development only, for the server error stacks.
  if (dev) scripts.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${scripts.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // The service worker of the push (`public/sw.js`): 'strict-dynamic' ignores 'self' in script-src.
    "worker-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
