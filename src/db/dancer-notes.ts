// Nina's private note about a dancer (#695, epic #691 `nina:remember`): one note per dancer, found from each booking
// of that dancer. Own code: no library keeps a note per person of a booking table.
//
// The key: one row per dancer key, not a column on each booking. A later booking with the same email or phone then
// finds the note at once, with no copy that can differ, and a forget removes one row. The key follows the rule of
// `dancerWhere()` (`src/lib/same-dancer.ts`), so that the page of a dancer (#621) and the note agree.
import { eq, inArray, isNull } from "drizzle-orm";
import { phoneDigits } from "../lib/same-dancer";
import type { Db } from "./index";
import { bookings, dancerNotes } from "./schema";

/** The most characters of one note (after the trim). */
export const DANCER_NOTE_MAX = 500;

/** The fields of a booking that name its dancer. */
export type DancerRef = { email: string; phone: string };

/**
 * The key of the dancer of a booking: the trimmed email in lower case when the email is not empty, else `phone:` and
 * the phone digits, else `null` (no email and no phone digits: no dancer to keep a note for).
 */
export function dancerKey({ email, phone }: DancerRef): string | null {
  const mail = email.trim().toLowerCase();
  if (mail !== "") return mail;
  const digits = phoneDigits(phone);
  return digits === "" ? null : `phone:${digits}`;
}

/** The note of the dancer of `booking`, or `null`. */
export function getDancerNote(db: Db, booking: DancerRef): string | null {
  const key = dancerKey(booking);
  if (key === null) return null;
  return db.select({ text: dancerNotes.text }).from(dancerNotes).where(eq(dancerNotes.key, key)).get()?.text ?? null;
}

export type SetDancerNoteResult = { ok: true; note: string | null } | { ok: false; reason: "no-dancer" | "too-long" };

/**
 * Store the note of the dancer of `booking`: the text is trimmed; an empty text removes the note (`note: null`). A
 * text longer than `DANCER_NOTE_MAX`, or a booking with no email and no phone digits, stores nothing.
 */
export function setDancerNote(db: Db, booking: DancerRef, text: string, now = Date.now()): SetDancerNoteResult {
  const key = dancerKey(booking);
  if (key === null) return { ok: false, reason: "no-dancer" };
  const note = text.trim();
  if (note.length > DANCER_NOTE_MAX) return { ok: false, reason: "too-long" };
  if (note === "") {
    db.delete(dancerNotes).where(eq(dancerNotes.key, key)).run();
    return { ok: true, note: null };
  }
  db.insert(dancerNotes)
    .values({ key, text: note, updatedAt: now })
    .onConflictDoUpdate({ target: dancerNotes.key, set: { text: note, updatedAt: now } })
    .run();
  return { ok: true, note };
}

/** Remove the notes of the dancers of these bookings (the forget of a dancer, #358); give the number. */
export function forgetDancerNotes(db: Db, refs: DancerRef[]): number {
  const keys = [...new Set(refs.map(dancerKey).filter((key): key is string => key !== null))];
  if (keys.length === 0) return 0;
  return db.delete(dancerNotes).where(inArray(dancerNotes.key, keys)).run().changes;
}

/**
 * Remove each note whose dancer has no booking that keeps its data (`forgottenAt` is `null`); give the number. The
 * forget of a dancer and the removal of the old data call it after they clear the bookings (`src/lib/booking-privacy.ts`).
 * The keys are made here with `dancerKey()`, not in SQL: SQLite `lower()` and `trim()` differ from JavaScript for
 * other letters and white space, and the note must not go away for that.
 */
export function pruneDancerNotes(db: Db): number {
  const keep = new Set<string>();
  const rows = db
    .select({ email: bookings.email, phone: bookings.phone })
    .from(bookings)
    .where(isNull(bookings.forgottenAt))
    .all();
  for (const row of rows) {
    const key = dancerKey(row);
    if (key !== null) keep.add(key);
  }
  // Delete by the keys of the notes (few rows), not with a list of all the booking keys.
  const gone = db
    .select({ key: dancerNotes.key })
    .from(dancerNotes)
    .all()
    .map((row) => row.key)
    .filter((key) => !keep.has(key));
  if (gone.length === 0) return 0;
  return db.delete(dancerNotes).where(inArray(dancerNotes.key, gone)).run().changes;
}
