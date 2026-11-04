// Nina repeats the weekly lesson of a regular dancer (#677, epic #676). Each week is a normal approved booking that
// Nina can move, cancel or mark paid alone: no series object and no rule (P11). Own code: no library repeats a booking,
// and `addBooking()` already checks the free time (the hours, blocks, classes and other bookings).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import type { Db } from "@/db";
import { addBooking, type Booking } from "@/db/bookings";
import { bookings } from "@/db/schema";
import { TIME_ZONE } from "@/lib/hours";

/** The most weeks of one repeat (the week page offers 2 to 8). */
export const REPEAT_WEEKS_MAX = 8;

/**
 * `added`: the new bookings, in the order of the weeks. `skipped`: the Amsterdam dates (ISO) of the weeks whose time
 * was not free (or that `addBooking()` refused for another reason), so that the page can name them.
 */
export type RepeatResult =
  | { ok: true; added: Booking[]; skipped: string[] }
  | { ok: false; reason: "not-found" | "not-approved" | "forgotten" | "weeks" };

/**
 * Repeat the approved booking `id` in each of the next `weeks` weeks (1 to `REPEAT_WEEKS_MAX`) at the same local
 * time in Europe/Amsterdam (`plus({ weeks })` keeps the wall time over the change of summer time), with the same
 * offer, name, email, phone and language, through `addBooking()`. A week that is not free does not stop the next
 * weeks. The new bookings get no approval email each (`callerMails`, `decisionMailedAt` is set): the caller sends one
 * email with all the new dates (#678).
 */
export function repeatBooking(
  db: Db,
  id: number,
  weeks: number,
  { now = Date.now() }: { now?: number } = {},
): RepeatResult {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > REPEAT_WEEKS_MAX) return { ok: false, reason: "weeks" };
  const source = db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!source) return { ok: false, reason: "not-found" };
  if (source.forgottenAt !== null) return { ok: false, reason: "forgotten" };
  if (source.status !== "approved") return { ok: false, reason: "not-approved" };
  const first = DateTime.fromMillis(source.start, { zone: TIME_ZONE });
  const added: Booking[] = [];
  const skipped: string[] = [];
  for (let k = 1; k <= weeks; k++) {
    const start = first.plus({ weeks: k });
    const result = addBooking(
      db,
      {
        offerId: source.offerId,
        start: start.toMillis(),
        name: source.name,
        email: source.email,
        phone: source.phone,
        locale: source.locale,
      },
      { now, callerMails: true },
    );
    if (result.ok) added.push(result.booking);
    else skipped.push(start.toISODate() ?? "");
  }
  return { ok: true, added, skipped };
}
