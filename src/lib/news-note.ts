// The short note of Nina for the home page, with an optional end date (#653): one row of `settings`.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "../db";
import { settings } from "../db/schema";
import { TIME_ZONE } from "./hours";

export type NewsNote = { text: string; until: string | null };

/** The most characters of the note. */
export const NEWS_MAX = 280;

const KEY = "newsNote";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The note as stored, or null when there is none. */
export function getNewsNote(db: Db): NewsNote | null {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  return row ? (JSON.parse(row.value) as NewsNote) : null;
}

/** Store the note in place of the old one. */
export function saveNewsNote(db: Db, note: NewsNote): void {
  const row = { key: KEY, value: JSON.stringify(note), updatedAt: Date.now() };
  db.insert(settings)
    .values(row)
    .onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt } })
    .run();
}

/** Remove the note: the home page shows none. */
export function removeNewsNote(db: Db): void {
  db.delete(settings).where(eq(settings.key, KEY)).run();
}

/**
 * Check a note from the form: the trimmed text, and `until` (a date `YYYY-MM-DD` in Europe/Amsterdam, or empty for no
 * end). `now` (epoch ms) decides whether a date is in the past. Returns the note, or the error as a key.
 */
export function parseNewsNote(
  text: string,
  until: string | null,
  now: number = Date.now(),
): { note: NewsNote } | { error: "empty" | "long" | "date" } {
  const trimmed = text.trim();
  if (trimmed === "") return { error: "empty" };
  if (trimmed.length > NEWS_MAX) return { error: "long" };
  const day = until === null || until.trim() === "" ? null : until.trim();
  if (day !== null) {
    if (!DATE.test(day)) return { error: "date" };
    const date = DateTime.fromISO(day, { zone: TIME_ZONE });
    if (!date.isValid) return { error: "date" };
    const today = DateTime.fromMillis(now, { zone: TIME_ZONE }).toISODate();
    if (day < (today ?? day)) return { error: "date" };
  }
  return { note: { text: trimmed, until: day } };
}

/**
 * The text to show on the home page at `now` (epoch ms), or null: it shows until the end of the day `until`
 * (inclusive, the next day 00:00 Europe/Amsterdam is the end), and always when there is no end date.
 */
export function shownNewsNote(note: NewsNote, now: number): string | null {
  if (note.until === null) return note.text;
  const end = DateTime.fromISO(note.until, { zone: TIME_ZONE }).plus({ days: 1 }).startOf("day").toMillis();
  return now < end ? note.text : null;
}
