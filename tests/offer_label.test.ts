// The label of an offer (#384): the kind, the minutes and the price in euro, in English and Dutch.
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import { offerLabel } from "../src/lib/offer-label";

const strip = (s: string) => s.replace(/\s/g, " ");

describe("offerLabel", () => {
  it("names a lesson in English with the price in euro", () => {
    const t = createTranslator({ locale: "en", messages: en, namespace: "Book" });
    expect(strip(offerLabel(t, "en", { kind: "lesson", minutes: 60, priceCents: 5500 }))).toBe(
      "Private lesson, 60 min · €55.00",
    );
  });

  it("names a rental in Dutch with the price in euro", () => {
    const t = createTranslator({ locale: "nl", messages: nl, namespace: "Book" });
    expect(strip(offerLabel(t, "nl", { kind: "rental", minutes: 90, priceCents: 2550 }))).toBe(
      `${nl.Book.rental.replace("{minutes}", "90")} · € 25,50`,
    );
  });
});
