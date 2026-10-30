// Send an email (#19): through the Mailgun HTTP API with its keys in the `.env`, else to the server log.
// The login code of the studio app uses it, and later the contact form (`site:contact`).
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** `replyTo`: the address that Nina's Reply button of Gmail answers (the contact form, #150). */
export type Email = { to: string; subject: string; text: string; replyTo?: string };

/**
 * "mailgun" with `MAILGUN_API_KEY` and `MAILGUN_DOMAIN`. "log" in development and tests, and with `EMAIL_TRANSPORT=log`
 * (the browser tests run the production build). A production server with no key throws: it never writes a login
 * code to the log of the live site.
 */
export function emailTransport(env: NodeJS.ProcessEnv = process.env): "mailgun" | "log" {
  if (env.MAILGUN_API_KEY && env.MAILGUN_DOMAIN) return "mailgun";
  if (env.NODE_ENV !== "production" || env.EMAIL_TRANSPORT === "log") return "log";
  throw new Error("Email: set MAILGUN_API_KEY and MAILGUN_DOMAIN in the .env of the server");
}

export async function sendEmail(email: Email, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  if (emailTransport(env) === "log") {
    const replyTo = email.replyTo ? ` (reply to ${email.replyTo})` : "";
    console.info(`[email] to ${email.to}${replyTo}: ${email.subject}\n${email.text}`);
    // EMAIL_LOG_FILE: one JSON line per email, so that a browser test can read the code.
    if (env.EMAIL_LOG_FILE) {
      mkdirSync(dirname(env.EMAIL_LOG_FILE), { recursive: true });
      appendFileSync(env.EMAIL_LOG_FILE, `${JSON.stringify(email)}\n`);
    }
    return;
  }
  const domain = env.MAILGUN_DOMAIN as string;
  // The EU account uses https://api.eu.mailgun.net.
  const url = `${env.MAILGUN_API_URL || "https://api.mailgun.net"}/v3/${domain}/messages`;
  const body = new URLSearchParams({
    from: env.EMAIL_FROM || `TUMACH <hello@${domain}>`,
    to: email.to,
    subject: email.subject,
    text: email.text,
    ...(email.replyTo ? { "h:Reply-To": email.replyTo } : {}),
  });
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64")}` },
    body,
  });
  if (!response.ok) throw new Error(`Email: Mailgun answered ${response.status}`);
}
