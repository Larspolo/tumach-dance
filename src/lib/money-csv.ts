// The CSV file of the approved bookings of one year, for Nina's tax return (#628, part of #626).

import { DateTime } from "luxon";
import type { Db } from "@/db";
import { listBookings } from "@/db/bookings";
import type { Offer } from "@/db/offers";
import { TIME_ZONE } from "@/lib/hours";
import { yearRange } from "@/lib/money";

export type YearCsvLabels = {
  header: [string, string, string, string, string];
  offer: (offer: Offer) => string;
  yes: string;
  no: string;
};

/** One field of a CSV line (RFC 4180): quoted when it has `;`, `"` or a line break, with each `"` doubled. */
function field(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * The approved bookings whose start is in `year` (Amsterdam time), by start: a UTF-8 byte order mark, the header, then
 * the date, the time, the offer, the price with a decimal comma and paid or not. No name, email, phone or note.
 */
export function yearCsv(db: Db, year: number, labels: YearCsvLabels): string {
  const { from, to } = yearRange(year);
  const lines = [labels.header.map(field).join(";")];
  for (const { booking, offer } of listBookings(db, from, to, ["approved"])) {
    if (booking.start < from || booking.start >= to) continue;
    const start = DateTime.fromMillis(booking.start, { zone: TIME_ZONE });
    lines.push(
      [
        start.toFormat("yyyy-MM-dd"),
        start.toFormat("HH:mm"),
        labels.offer(offer),
        (booking.priceCents / 100).toFixed(2).replace(".", ","),
        booking.paidAt !== null ? labels.yes : labels.no,
      ]
        .map(field)
        .join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
