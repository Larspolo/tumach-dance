// Nina's hours rule in the database (#22): one row of `settings`, so that all pages read the same rule.
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { settings } from "../db/schema";
import { DEFAULT_RULE, type HoursRule, openRanges } from "./hours";

const KEY = "hoursRule";

/** The stored rule, or `DEFAULT_RULE` when Nina has not set one. */
export function getHoursRule(db: Db): HoursRule {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  return row ? (JSON.parse(row.value) as HoursRule) : DEFAULT_RULE;
}

/** Throw a `RangeError` when a date, a time or a range of the rule is wrong. */
export function checkHoursRule(rule: HoursRule): void {
  // One week checks each weekday; each date of the rule checks itself (a range that ends before it starts throws).
  openRanges(rule, "2026-01-05", "2026-01-11");
  const dates = [
    ...(rule.closed ?? []).flatMap((c) => [c.from, c.to ?? c.from]),
    ...(rule.extraOpen ?? []).map((e) => e.date),
  ];
  for (const date of dates) openRanges(rule, date, date);
  for (const c of rule.closed ?? []) {
    if (c.to && c.to < c.from) throw new RangeError(`A closed period ends before it starts: ${c.from} to ${c.to}`);
  }
  for (const e of rule.extraOpen ?? []) openRanges({ ...rule, closed: [] }, e.date, e.date);
}

/** Check the rule and store it in place of the old one. A wrong rule throws a `RangeError` and changes nothing. */
export function saveHoursRule(db: Db, rule: HoursRule): void {
  checkHoursRule(rule);
  const row = { key: KEY, value: JSON.stringify(rule), updatedAt: Date.now() };
  db.insert(settings)
    .values(row)
    .onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt } })
    .run();
}
