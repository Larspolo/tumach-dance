// The short note of Nina for the home page with its end date (#653).
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import {
  getNewsNote,
  NEWS_MAX,
  type NewsNote,
  parseNewsNote,
  removeNewsNote,
  saveNewsNote,
  shownNewsNote,
} from "../src/lib/news-note";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-20T12:00");

describe("storage", () => {
  test("there is no note at first", () => {
    expect(getNewsNote(db)).toBeNull();
  });

  test("save, read, change and remove", () => {
    saveNewsNote(db, { text: "Closed for the holidays", until: "2026-12-24" });
    expect(getNewsNote(db)).toEqual({ text: "Closed for the holidays", until: "2026-12-24" });

    saveNewsNote(db, { text: "Open again", until: null });
    expect(getNewsNote(db)).toEqual({ text: "Open again", until: null });

    removeNewsNote(db);
    expect(getNewsNote(db)).toBeNull();
  });
});

describe("parseNewsNote", () => {
  test("a good note: the text trimmed, the date kept", () => {
    expect(parseNewsNote("  Hello  ", "2026-11-01", NOW)).toEqual({
      note: { text: "Hello", until: "2026-11-01" },
    });
  });

  test("no end date is null", () => {
    expect(parseNewsNote("Hello", null, NOW)).toEqual({ note: { text: "Hello", until: null } });
    expect(parseNewsNote("Hello", "", NOW)).toEqual({ note: { text: "Hello", until: null } });
  });

  test("empty text (also only spaces) is an error", () => {
    expect(parseNewsNote("", null, NOW)).toEqual({ error: "empty" });
    expect(parseNewsNote("   ", "2026-11-01", NOW)).toEqual({ error: "empty" });
  });

  test("a text of more than NEWS_MAX characters is an error", () => {
    expect(parseNewsNote("a".repeat(NEWS_MAX), null, NOW)).toEqual({
      note: { text: "a".repeat(NEWS_MAX), until: null },
    });
    expect(parseNewsNote("a".repeat(NEWS_MAX + 1), null, NOW)).toEqual({ error: "long" });
  });

  test("a date that is not a real date is an error", () => {
    expect(parseNewsNote("Hello", "2026-02-30", NOW)).toEqual({ error: "date" });
    expect(parseNewsNote("Hello", "2026-13-01", NOW)).toEqual({ error: "date" });
    expect(parseNewsNote("Hello", "25-11-2026", NOW)).toEqual({ error: "date" });
  });

  test("a date before today is an error, today is not", () => {
    expect(parseNewsNote("Hello", "2026-10-19", NOW)).toEqual({ error: "date" });
    expect(parseNewsNote("Hello", "2026-10-20", NOW)).toEqual({ note: { text: "Hello", until: "2026-10-20" } });
  });
});

describe("shownNewsNote", () => {
  const note = (until: string | null): NewsNote => ({ text: "Hello", until });

  test("without an end date it shows always", () => {
    expect(shownNewsNote(note(null), at("2020-01-01T00:00"))).toBe("Hello");
    expect(shownNewsNote(note(null), at("2099-12-31T23:59"))).toBe("Hello");
  });

  test("it shows until the end of the last day, not from the next day 00:00", () => {
    expect(shownNewsNote(note("2026-11-01"), at("2026-11-01T23:59"))).toBe("Hello");
    expect(shownNewsNote(note("2026-11-01"), at("2026-11-02T00:00"))).toBeNull();
  });

  test("the change to winter time (2026-10-25): the last day ends at 00:00 of the next day", () => {
    expect(shownNewsNote(note("2026-10-25"), at("2026-10-25T23:59"))).toBe("Hello");
    expect(shownNewsNote(note("2026-10-25"), at("2026-10-26T00:00"))).toBeNull();
  });

  test("the change to summer time (2027-03-28): the last day ends at 00:00 of the next day", () => {
    expect(shownNewsNote(note("2027-03-28"), at("2027-03-28T23:59"))).toBe("Hello");
    expect(shownNewsNote(note("2027-03-28"), at("2027-03-29T00:00"))).toBeNull();
  });
});
