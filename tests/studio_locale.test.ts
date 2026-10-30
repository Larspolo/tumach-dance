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
