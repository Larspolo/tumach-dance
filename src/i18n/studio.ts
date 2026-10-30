// The language of the studio app (#19). Its pages have no locale in the address: Nina keeps one address on her
// phone. The language is the one of the public site (the `NEXT_LOCALE` cookie of next-intl), else the first
// language of the browser that the site has, else English. Each studio page and layout calls `setStudioLocale()`:
// a `headers()` call in `request.ts` would make the static pages (not found) dynamic.
import { headers } from "next/headers";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "./routing";

export type Locale = (typeof routing.locales)[number];

export function studioLocale(headers: Headers): Locale {
  const cookie = headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === "NEXT_LOCALE")?.[1];
  if (hasLocale(routing.locales, cookie)) return cookie;
  for (const range of (headers.get("accept-language") ?? "").split(",")) {
    const language = range.split(";")[0].trim().split("-")[0].toLowerCase();
    if (hasLocale(routing.locales, language)) return language;
  }
  return routing.defaultLocale;
}

/** Set the language of a studio page or layout from its request (next-intl `setRequestLocale`). */
export async function setStudioLocale(): Promise<Locale> {
  const locale = studioLocale(await headers());
  setRequestLocale(locale);
  return locale;
}
