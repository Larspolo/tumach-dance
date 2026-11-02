// The text of a locale, with English as the fallback (#95).
import { expect, test } from "vitest";
import { localText } from "../src/lib/local-text";

test("localText gives the text of the locale", () => {
  const texts = { en: "Salsa", nl: "Salsa voor iedereen" };
  expect(localText(texts, "nl")).toBe("Salsa voor iedereen");
  expect(localText(texts, "en")).toBe("Salsa");
});

test("localText gives the English text when the locale has none", () => {
  expect(localText({ en: "Salsa", nl: "Salsa" }, "en")).toBe("Salsa");
  expect(localText({ en: "Salsa" }, "nl")).toBe("Salsa");
});
