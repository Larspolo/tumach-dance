// The history of a booking (#814): when the dancer sent the request and when Nina decided. The base of epic #813.
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/index";
import { bookingEvents, bookings } from "../db/schema";
import { TIME_ZONE } from "./hours";

export type BookingEventKind = (typeof bookingEvents.$inferSelect)["kind"];
export type BookingEventBy = (typeof bookingEvents.$inferSelect)["by"];
export type BookingEvent = { at: number; kind: BookingEventKind; by: BookingEventBy; fromStart: number | null };

/** A `db` or the `tx` of a transaction: call it in the transaction of the change, so that both or neither are stored. */
type DbOrTx = Pick<Db, "insert" | "select">;

/** Store one event of a booking. `at`: default now. */
export function recordBookingEvent(
  db: DbOrTx,
  bookingId: number,
  kind: (typeof bookingEvents.$inferSelect)["kind"],
  by: BookingEventBy,
  { at = Date.now(), fromStart = null }: { at?: number; fromStart?: number | null } = {},
): void {
  db.insert(bookingEvents).values({ bookingId, kind, by, at, fromStart }).run();
}

/**
 * The events of a booking, oldest first. A booking with no events (stored before #814) gives the events of its row:
 * `createdAt` (requested), `approvedAt` (approved) and `paidAt` (paid).
 */
export function bookingHistory(db: DbOrTx, bookingId: number): BookingEvent[] {
  const events = db
    .select({
      at: bookingEvents.at,
      kind: bookingEvents.kind,
      by: bookingEvents.by,
      fromStart: bookingEvents.fromStart,
    })
    .from(bookingEvents)
    .where(eq(bookingEvents.bookingId, bookingId))
    .orderBy(asc(bookingEvents.at), asc(bookingEvents.id))
    .all();
  if (events.length > 0) return events;
  const row = db.select().from(bookings).where(eq(bookings.id, bookingId)).get();
  if (!row) return [];
  const fromRow: BookingEvent[] = [{ at: row.createdAt, kind: "requested", by: "dancer", fromStart: null }];
  if (row.approvedAt !== null) fromRow.push({ at: row.approvedAt, kind: "approved", by: "nina", fromStart: null });
  if (row.paidAt !== null) fromRow.push({ at: row.paidAt, kind: "paid", by: "site", fromStart: null });
  return fromRow;
}

/** The date and the time of an event in Amsterdam time, for example "Nov 3, 2026, 14:05" (`locale` "en"). */
export function eventWhen(at: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
}

/** The key of the text of an event in `StudioWeek` (#816): a move names who moved it, with `{from}` the old time. */
export function eventMessageKey(event: Pick<BookingEvent, "kind" | "by">): string {
  if (event.kind === "moved") return event.by === "dancer" ? "event_moved_dancer" : "event_moved_nina";
  if (event.kind === "cancelled" && event.by === "nina") return "event_cancelled_nina";
  return `event_${event.kind}`;
}
