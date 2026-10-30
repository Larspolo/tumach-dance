// The login of the studio app (#19): Better Auth with its email OTP plugin. Nina types her email, gets a code of
// 6 digits by email (`src/lib/email.ts`) and types it; the session then lasts 180 days and renews when she uses the
// app. Only `STUDIO_EMAIL` of the `.env` logs in. After a code login, Nina can add a passkey on the device (#26):
// the passkey plugin of Better Auth (SimpleWebAuthn). Its relying party ID is the host of `baseURL`, so the preview
// and the live site have separate passkeys.
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { createTranslator } from "next-intl";
import { type Db, getDb } from "../db";
import * as schema from "../db/schema";
import { studioLocale } from "../i18n/studio";
import { emailTransport, sendEmail } from "./email";

const DAY = 24 * 60 * 60;
export const SESSION_DAYS = 180;
export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;

/** The email of Nina, in lower case. Empty: nobody logs in. */
export function studioEmail(env: NodeJS.ProcessEnv = process.env): string {
  return (env.STUDIO_EMAIL ?? "").trim().toLowerCase();
}

function isStudioEmail(email: unknown): boolean {
  return typeof email === "string" && studioEmail() !== "" && email.trim().toLowerCase() === studioEmail();
}

async function sendCode(email: string, otp: string, headers: Headers | undefined): Promise<void> {
  const locale = studioLocale(headers ?? new Headers());
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const t = createTranslator({ locale, messages, namespace: "LoginEmail" });
  await sendEmail({
    to: email,
    subject: t("subject", { code: otp }),
    text: t("text", { code: otp, minutes: CODE_MINUTES }),
  });
}

/** `baseURL`: the address of the site (`BETTER_AUTH_URL`); with https, the session cookie is `Secure`. */
export function createAuth(db: Db, baseURL = process.env.BETTER_AUTH_URL) {
  return betterAuth({
    appName: "TUMACH studio",
    baseURL,
    database: drizzleAdapter(db, { provider: "sqlite", schema }),
    session: { expiresIn: SESSION_DAYS * DAY, updateAge: DAY },
    telemetry: { enabled: false },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/email-otp/send-verification-otp") {
          // No email key on the live site: refuse the login for each email the same way.
          emailTransport();
          // Another email: no code, and the same answer as for a sent code.
          if (!isStudioEmail(ctx.body?.email)) return ctx.json({ success: true });
        }
        if (ctx.path === "/sign-in/email-otp" && !isStudioEmail(ctx.body?.email)) {
          throw APIError.fromStatus("BAD_REQUEST", { message: "Invalid OTP", code: "INVALID_OTP" });
        }
      }),
    },
    databaseHooks: {
      // A second guard: no route of Better Auth makes an account for another email.
      user: { create: { before: async (user) => (isStudioEmail(user.email) ? undefined : false) } },
    },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: CODE_MINUTES * 60,
        allowedAttempts: CODE_TRIES,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type === "sign-in" && isStudioEmail(email)) await sendCode(email, otp, ctx?.headers);
        },
      }),
      // Only a logged-in session adds a passkey (the default `requireSession`). The origin is the site, not a header.
      passkey({ rpName: "TUMACH studio", origin: baseURL ? new URL(baseURL).origin : null }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

const cache = globalThis as unknown as { tumachAuth?: Auth };

/** The auth of the server. The first call opens the database (not at import: `next build` must not create it). */
export function getAuth(): Auth {
  cache.tumachAuth ??= createAuth(getDb());
  return cache.tumachAuth;
}

/** The session of the request, or null. */
export async function getStudioSession(headers: Headers) {
  return getAuth().api.getSession({ headers });
}
