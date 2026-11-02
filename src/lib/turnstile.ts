// Cloudflare Turnstile on the public forms (#564): a check for bots that a person mostly does not see. Turnstile is
// free (Cloudflare, no limit on the checks). The widget runs with `appearance: "interaction-only"`: it shows a box
// only when Cloudflare is not sure. With no keys (development, tests) the check is off.
// The honeypot, the signed time and the limits (`contact-spam.ts`) stay: they also work with no JavaScript.

export const TURNSTILE_FIELD = "cf-turnstile-response";
export const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";
const VERIFY_URL = `${TURNSTILE_ORIGIN}/turnstile/v0/siteverify`;

/** The public site key, or "" when Turnstile is off. Read at run time: the image has no keys. */
export function turnstileSiteKey(): string {
  return process.env.TURNSTILE_SECRET_KEY ? (process.env.TURNSTILE_SITE_KEY ?? "") : "";
}

/**
 * Why the token of the form fails, or null. Off (no keys): null. No token: "turnstile" (a bot, or a browser with no
 * JavaScript: the form then tells the person to try again). Cloudflare cannot be reached: null, so that an outage of
 * Cloudflare never stops a dancer; the other checks still apply.
 */
export async function turnstileReason(
  form: FormData,
  address: string,
  fetcher: typeof fetch = fetch,
): Promise<"turnstile" | null> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.TURNSTILE_SITE_KEY) return null;
  const token = String(form.get(TURNSTILE_FIELD) ?? "");
  if (!token) return "turnstile";
  const body = new URLSearchParams({ secret, response: token });
  if (address && address !== "unknown") body.set("remoteip", address);
  try {
    const response = await fetcher(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(5000) });
    if (!response.ok) return null;
    const result = (await response.json()) as { success?: boolean };
    return result.success ? null : "turnstile";
  } catch (error) {
    console.warn("Turnstile: no answer from Cloudflare, the form passes", error);
    return null;
  }
}
