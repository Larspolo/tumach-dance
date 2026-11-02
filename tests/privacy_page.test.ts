// The privacy page (#226): the months of `KEEP_MONTHS` in each language, and each text in the 3 languages.
import { createTranslator } from "next-intl";
import { expect, test } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import { KEEP_MONTHS } from "../src/lib/booking-privacy";

const all = { en, nl };

test.each(Object.entries(all))("%s: the keep text shows the number of months", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "Privacy" });
  expect(t("keep", { months: 7 })).toContain("7");
  expect(t("keep", { months: KEEP_MONTHS })).toContain(String(KEEP_MONTHS));
  expect(t("keep", { months: 1 })).toMatch(/^1 /);
});

test("each privacy text is in English and Dutch", () => {
  const keys = Object.keys(en.Privacy).sort();
  expect(Object.keys(nl.Privacy).sort()).toEqual(keys);
  for (const m of Object.values(all)) {
    expect(m.Footer.privacy).toBeTruthy();
    expect(m.Book.privacy).toBeTruthy();
  }
});
