import { defineRouting } from "next-intl/routing";

// The choice of a language stays one year (#314): with no `maxAge`, next-intl sets a session cookie.
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: ["en", "nl"],
  defaultLocale: "en",
  localeCookie: { maxAge: LOCALE_COOKIE_MAX_AGE },
});
