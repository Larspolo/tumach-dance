// The texts of the public pages (#257): an agent writes each text, and Nina gives only the tagline (owner,
// 2026-10-31). So no page shows a placeholder, except a key that waits for her answer.
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";

/** The keys that wait for a text of Nina, with the ticket of the question. Remove a key when her text is in. */
const WAITING_FOR_NINA: Record<string, number> = {};

function placeholders(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return value.includes("[Placeholder") ? [prefix] : [];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([k, v]) => placeholders(v, prefix ? `${prefix}.${k}` : k));
}

describe("site texts", () => {
  it.each([
    ["en", en],
    ["nl", nl],
  ])("%s has a placeholder only for a key that waits for Nina", (_lang, messages) => {
    expect(placeholders(messages).sort()).toEqual(Object.keys(WAITING_FOR_NINA).sort());
  });
});
