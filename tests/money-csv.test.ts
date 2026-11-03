// The CSV file of the approved bookings of one year (#628).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { type YearCsvLabels, yearCsv } from "../src/lib/money-csv";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

const labels: YearCsvLabels = {
  header: ["Date", "Time", "Lesson", "Price", "Paid"],
  offer: (offer) => offer.kind,
  yes: "yes",
  no: "no",
};

function setup() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 0 });
  const add = (
    local: string,
    status: "requested" | "approved" | "declined" | "cancelled",
    price: number,
    paid = false,
    name = "Ana",
  ) =>
    db
      .insert(bookings)
      .values({
        offerId: offer.id,
        start: at(local),
        end: at(local) + 60 * 60_000,
        priceCents: price,
        name,
        email: "ana@example.com",
        phone: "+31 6 1234 5678",
        locale: "nl",
        status,
        createdAt: 0,
        paidAt: paid ? at(local) : null,
      })
      .run();
  return { db, add };
}

test("yearCsv gives the byte order mark, the header and the approved bookings of the year in order of start", () => {
  const { db, add } = setup();
  add("2026-06-02T10:00", "approved", 5000, true);
  add("2026-03-05T18:30", "approved", 4550);
  add("2026-07-01T10:00", "requested", 9900);
  add("2026-07-02T10:00", "cancelled", 9900);
  add("2025-12-31T10:00", "approved", 9900);
  const csv = yearCsv(db, 2026, labels);
  expect(csv).toBe(
    "﻿Date;Time;Lesson;Price;Paid\r\n2026-03-05;18:30;lesson;45,50;no\r\n2026-06-02;10:00;lesson;50,00;yes\r\n",
  );
});

test("a booking on 31 December 23:30 is in its year, and a summer time booking shows its local time", () => {
  const { db, add } = setup();
  add("2026-12-31T23:30", "approved", 5000);
  add("2026-07-15T09:15", "approved", 5000);
  add("2027-01-01T00:30", "approved", 5000);
  const csv = yearCsv(db, 2026, labels);
  expect(csv).toContain("\r\n2026-07-15;09:15;lesson;50,00;no\r\n");
  expect(csv).toContain("\r\n2026-12-31;23:30;lesson;50,00;no\r\n");
  expect(csv).not.toContain("2027-01-01");
});

test("a label with ; and quotes is quoted, and no name, email or phone of a dancer is in the file", () => {
  const { db, add } = setup();
  add("2026-05-10T10:00", "approved", 5000, false, "Ana Lopez");
  const quoted: YearCsvLabels = { ...labels, offer: () => 'Duo; "pro"' };
  const csv = yearCsv(db, 2026, quoted);
  expect(csv).toContain('2026-05-10;10:00;"Duo; ""pro""";50,00;no\r\n');
  expect(csv).not.toContain("Ana");
  expect(csv).not.toContain("ana@example.com");
  expect(csv).not.toContain("+31");
});
