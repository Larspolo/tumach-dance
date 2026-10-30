// The closed dates and extra open days of the "Hours" page (#24). The logic of the open times stays in `hours.ts`.
import type { HoursRule } from "./hours";
import { checkHoursRule } from "./hours-store";

export type Closed = NonNullable<HoursRule["closed"]>[number];
export type ExtraOpen = NonNullable<HoursRule["extraOpen"]>[number];
export type DateKind = "closed" | "extra";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function date(value: FormDataEntryValue | null): string {
  const s = String(value ?? "");
  if (!ISO_DATE.test(s)) throw new RangeError(`Not a date: ${s}`);
  return s;
}

/** The key of an item for its remove button: the same item has the same key. */
export function dateKey(item: Closed | ExtraOpen): string {
  return "date" in item ? item.date : `${item.from}/${item.to ?? item.from}`;
}

/** The rule with one more closed date or period. A period that ends before it starts throws a `RangeError`. */
export function addClosed(rule: HoursRule, data: FormData): HoursRule {
  const from = date(data.get("closedFrom"));
  const toValue = String(data.get("closedTo") ?? "");
  const to = toValue ? date(toValue) : undefined;
  if (to && to < from) throw new RangeError(`A closed period ends before it starts: ${from} to ${to}`);
  const item: Closed = to && to !== from ? { from, to } : { from };
  const next = { ...rule, closed: [...(rule.closed ?? []), item] };
  checkHoursRule(next);
  return next;
}

/** The rule with one more extra open day (all day or from a time), in place of an old one of the same date. */
export function addExtraOpen(rule: HoursRule, data: FormData): HoursRule {
  const day = date(data.get("extraDate"));
  const mode = String(data.get("extraMode"));
  if (mode !== "allDay" && mode !== "from") throw new RangeError(`Not a mode: ${mode}`);
  const item: ExtraOpen = { date: day, hours: mode === "allDay" ? "allDay" : { from: String(data.get("extraFrom")) } };
  const next = { ...rule, extraOpen: [...(rule.extraOpen ?? []).filter((e) => e.date !== day), item] };
  checkHoursRule(next);
  return next;
}

/** The rule without the item of this key. */
export function removeDate(rule: HoursRule, kind: DateKind, key: string): HoursRule {
  if (kind === "closed") return { ...rule, closed: (rule.closed ?? []).filter((c) => dateKey(c) !== key) };
  return { ...rule, extraOpen: (rule.extraOpen ?? []).filter((e) => dateKey(e) !== key) };
}

/** The items that still do something on or after `today`, by date. The past items stay in the rule. */
export function upcoming(rule: HoursRule, today: string): { closed: Closed[]; extraOpen: ExtraOpen[] } {
  return {
    closed: (rule.closed ?? []).filter((c) => (c.to ?? c.from) >= today).sort((a, b) => a.from.localeCompare(b.from)),
    extraOpen: (rule.extraOpen ?? []).filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
  };
}
