import { describe, expect, it } from "vitest";
import { withFallback } from "../src/i18n/fallback";

describe("withFallback", () => {
  const english = { home: { title: "Welcome", intro: "Dance with us" }, book: "Book" };

  it("gives the English value for a key the locale misses", () => {
    const dutch = { home: { title: "Welkom" } };
    expect(withFallback(dutch, english).book).toBe("Book");
  });

  it("gives the English value for a nested key the locale misses", () => {
    const dutch = { home: { title: "Welkom" }, book: "Boek" };
    expect(withFallback(dutch, english).home.intro).toBe("Dance with us");
  });

  it("keeps the value of the locale for a key both have", () => {
    const dutch = { home: { title: "Welkom" }, book: "Boek" };
    expect(withFallback(dutch, english)).toEqual({
      home: { title: "Welkom", intro: "Dance with us" },
      book: "Boek",
    });
  });
});
