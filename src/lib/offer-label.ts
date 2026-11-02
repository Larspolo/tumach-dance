// The label of an offer (#384): the kind, the minutes and the price in euro. The booking page and the home page use it.
import type { Offer } from "@/db/offers";

/** A translator of the namespace `Book` (its keys `lesson` and `rental` take `{minutes}`). */
export type OfferTranslator = (key: Offer["kind"], values: { minutes: number }) => string;

export function offerLabel(t: OfferTranslator, locale: string, offer: Pick<Offer, "kind" | "minutes" | "priceCents">) {
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  return `${t(offer.kind, { minutes: offer.minutes })} · ${euro.format(offer.priceCents / 100)}`;
}
