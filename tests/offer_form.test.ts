// The form of the offers page (#31): add, change, hide; nothing without a session.
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { addOffer, listOffers } from "../src/db/offers";
import { applyOfferForm, priceCentsOf } from "../src/lib/offer-form";

const SESSION = { user: { email: "nina@example.test" } };

function form(fields: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, String(v));
  return data;
}

describe("applyOfferForm", () => {
  it("adds an offer at the end, changes its price and hides it", () => {
    const db = openDb(":memory:");
    addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 3 });
    expect(applyOfferForm(db, SESSION, form({ intent: "add", kind: "rental", minutes: 90, price: "40,50" }))).toBe(
      true,
    );
    const added = listOffers(db).at(-1);
    expect(added).toMatchObject({ kind: "rental", minutes: 90, priceCents: 4050, position: 4, visible: true });
    const id = added?.id ?? 0;
    expect(applyOfferForm(db, SESSION, form({ intent: "save", id, minutes: 120, price: "75" }))).toBe(true);
    expect(applyOfferForm(db, SESSION, form({ intent: "hide", id }))).toBe(true);
    expect(listOffers(db).at(-1)).toMatchObject({ minutes: 120, priceCents: 7500, visible: false });
    expect(applyOfferForm(db, SESSION, form({ intent: "show", id }))).toBe(true);
    expect(listOffers(db, { visibleOnly: true })).toHaveLength(2);
  });

  it("changes nothing without a session", () => {
    const db = openDb(":memory:");
    const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, position: 1 });
    expect(applyOfferForm(db, null, form({ intent: "add", kind: "lesson", minutes: 30, price: "20" }))).toBe(false);
    expect(applyOfferForm(db, null, form({ intent: "hide", id: offer.id }))).toBe(false);
    expect(applyOfferForm(db, undefined, form({ intent: "save", id: offer.id, minutes: 30, price: "1" }))).toBe(false);
    expect(listOffers(db)).toEqual([offer]);
  });

  it("refuses a length that is not a choice and a price that is not a number", () => {
    const db = openDb(":memory:");
    expect(applyOfferForm(db, SESSION, form({ intent: "add", kind: "lesson", minutes: 50, price: "20" }))).toBe(false);
    expect(applyOfferForm(db, SESSION, form({ intent: "add", kind: "party", minutes: 60, price: "20" }))).toBe(false);
    expect(applyOfferForm(db, SESSION, form({ intent: "add", kind: "lesson", minutes: 60, price: "-5" }))).toBe(false);
    expect(listOffers(db)).toEqual([]);
  });
});

describe("priceCentsOf", () => {
  it("reads euro with a point or a comma", () => {
    expect(priceCentsOf("45")).toBe(4500);
    expect(priceCentsOf("45,5")).toBe(4550);
    expect(priceCentsOf("0.99")).toBe(99);
    expect(priceCentsOf("abc")).toBeUndefined();
    expect(priceCentsOf(null)).toBeUndefined();
  });
});
