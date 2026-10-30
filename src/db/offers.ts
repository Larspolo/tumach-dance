// The offers of the studio (#30): private lessons and studio rental.
import { asc, eq } from "drizzle-orm";
import type { Db } from "./index";
import { offers } from "./schema";

export type Offer = typeof offers.$inferSelect;
export type NewOffer = Omit<typeof offers.$inferInsert, "id">;

/** Refuse a length of 0 or less and a negative price (the database checks it too). */
function validate(offer: Partial<NewOffer>): void {
  if (offer.minutes !== undefined && !(Number.isInteger(offer.minutes) && offer.minutes > 0)) {
    throw new RangeError(`offer minutes must be a positive integer: ${offer.minutes}`);
  }
  if (offer.priceCents !== undefined && !(Number.isInteger(offer.priceCents) && offer.priceCents >= 0)) {
    throw new RangeError(`offer price must be an integer of 0 or more cents: ${offer.priceCents}`);
  }
}

/** The offers in the order of `position`; with `visibleOnly` only the offers that dancers see. */
export function listOffers(db: Db, { visibleOnly = false }: { visibleOnly?: boolean } = {}): Offer[] {
  const query = db.select().from(offers);
  return (visibleOnly ? query.where(eq(offers.visible, true)) : query)
    .orderBy(asc(offers.position), asc(offers.id))
    .all();
}

export function addOffer(db: Db, offer: NewOffer): Offer {
  validate(offer);
  return db.insert(offers).values(offer).returning().get();
}

export function updateOffer(db: Db, id: number, change: Partial<NewOffer>): Offer | undefined {
  validate(change);
  return db.update(offers).set(change).where(eq(offers.id, id)).returning().get();
}

/** Hide an offer from the booking page. The row stays, for the bookings that use it. */
export function hideOffer(db: Db, id: number): Offer | undefined {
  return updateOffer(db, id, { visible: false });
}
