import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";

function keys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("messages", () => {
  it("has the same keys in each language", () => {
    const expected = keys(en).sort();
    expect(keys(nl).sort()).toEqual(expected);
  });
});
