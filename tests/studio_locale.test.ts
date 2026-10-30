// The language of the studio app (#19): the cookie of the public site, else the browser, else English.
import { expect, test } from "vitest";
import { studioLocale } from "../src/i18n/studio";

test("the studio app takes the language of the public site, else of the browser, else English", () => {
  expect(studioLocale(new Headers({ cookie: "a=1; NEXT_LOCALE=sl", "accept-language": "nl" }))).toBe("sl");
  expect(studioLocale(new Headers({ cookie: "NEXT_LOCALE=de", "accept-language": "de-DE,nl;q=0.8" }))).toBe("nl");
  expect(studioLocale(new Headers({ "accept-language": "SL-si" }))).toBe("sl");
  expect(studioLocale(new Headers({ "accept-language": "fr" }))).toBe("en");
  expect(studioLocale(new Headers())).toBe("en");
});

test("the studio app takes the best language of the browser by its q values (#43)", () => {
  const locale = (accept: string, cookie?: string) =>
    studioLocale(new Headers({ "accept-language": accept, ...(cookie ? { cookie } : {}) }));
  expect(locale("nl-NL,nl;q=0.9")).toBe("nl");
  expect(locale("sl")).toBe("sl");
  expect(locale("de-DE")).toBe("en");
  expect(locale("")).toBe("en");
  expect(locale("sl", "NEXT_LOCALE=nl")).toBe("nl");
  expect(locale("en;q=0.2,nl;q=0.8")).toBe("nl");
});
