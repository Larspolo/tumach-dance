// The form of the offers page of the studio app (#31): read a plain HTML form and change the offers table.
// Apart from the server action, so that a test runs it with no Next.js request.
import type { Db } from "../db";
import { addOffer, listOffers, updateOffer } from "../db/offers";

/** The lengths that Nina can choose, in minutes. */
export const OFFER_MINUTES = [30, 45, 60, 90, 120] as const;
export const OFFER_KINDS = ["lesson", "rental"] as const;

function minutesOf(value: FormDataEntryValue | null): number | undefined {
  const minutes = Number(value);
  return (OFFER_MINUTES as readonly number[]).includes(minutes) ? minutes : undefined;
}

/** "45", "45,50" or "45.50" euro to cents; undefined for no number or a negative number. */
export function priceCentsOf(value: FormDataEntryValue | null): number | undefined {
  const text = String(value ?? "")
    .trim()
    .replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return undefined;
  return Math.round(Number(text) * 100);
}

/**
 * Apply one submit of the form. `intent`: "add", "save", "hide" or "show". With no session it changes nothing.
 * Returns false when the form is not valid or the session is missing.
 */
export function applyOfferForm(db: Db, session: unknown, form: FormData): boolean {
  if (!session) return false;
  const intent = form.get("intent");
  if (intent === "add") {
    const kind = OFFER_KINDS.find((k) => k === form.get("kind"));
    const minutes = minutesOf(form.get("minutes"));
    const priceCents = priceCentsOf(form.get("price"));
    if (!kind || minutes === undefined || priceCents === undefined) return false;
    const position = Math.max(0, ...listOffers(db).map((o) => o.position)) + 1;
    addOffer(db, { kind, minutes, priceCents, position });
    return true;
  }
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return false;
  if (intent === "hide" || intent === "show") return updateOffer(db, id, { visible: intent === "show" }) !== undefined;
  if (intent === "save") {
    const minutes = minutesOf(form.get("minutes"));
    const priceCents = priceCentsOf(form.get("price"));
    if (minutes === undefined || priceCents === undefined) return false;
    return updateOffer(db, id, { minutes, priceCents }) !== undefined;
  }
  return false;
}
