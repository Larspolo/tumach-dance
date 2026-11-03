// Nina gives one booking another price (#761): the offer keeps its price, the money page counts the new price.
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { changePrice } from "../src/db/bookings";
import { addOffer, listOffers } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { monthMoney } from "../src/lib/money";
import { priceCentsOf } from "../src/lib/offer-form";

const START = Date.UTC(2026, 10, 7, 13);

function setup(status: "requested" | "approved" | "cancelled", forgottenAt: number | null = null) {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: 6000,
      start: START,
      end: START + 3_600_000,
      status,
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      locale: "en",
      createdAt: START - 86_400_000,
      approvedAt: status === "approved" ? START - 3_600_000 : null,
      forgottenAt,
    })
    .returning()
    .get();
  const row = () => db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
  return { db, id: booking.id, row };
}

test("changePrice sets the price of the booking only and the money page counts it", () => {
  const { db, id, row } = setup("approved");
  expect(monthMoney(db, "2026-11").openCents).toBe(6000);
  expect(changePrice(db, id, priceCentsOf("75,50") as number)).toMatchObject({ priceCents: 7550 });
  expect(row()?.priceCents).toBe(7550);
  expect(listOffers(db)[0].priceCents).toBe(6000);
  expect(monthMoney(db, "2026-11")).toEqual({ count: 1, paidCents: 0, openCents: 7550 });
});

test("changePrice changes a requested booking", () => {
  const { db, id, row } = setup("requested");
  expect(changePrice(db, id, 3000)).toBeDefined();
  expect(row()?.priceCents).toBe(3000);
});

test("a wrong price, a cancelled booking and a booking with its data removed change nothing", () => {
  expect(priceCentsOf("abc")).toBeUndefined();
  expect(priceCentsOf("-5")).toBeUndefined();
  const a = setup("approved");
  expect(changePrice(a.db, a.id, -100)).toBeUndefined();
  expect(changePrice(a.db, a.id, 12.5)).toBeUndefined();
  expect(a.row()?.priceCents).toBe(6000);
  const c = setup("cancelled");
  expect(changePrice(c.db, c.id, 3000)).toBeUndefined();
  expect(c.row()?.priceCents).toBe(6000);
  const f = setup("approved", START);
  expect(changePrice(f.db, f.id, 3000)).toBeUndefined();
  expect(f.row()?.priceCents).toBe(6000);
});
