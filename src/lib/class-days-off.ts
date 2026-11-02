import { DateTime } from "luxon";
import type { ClassTime } from "../db/classes";
import { type HoursRule, TIME_ZONE } from "./hours";

/** The days ahead in which the schedule of the home page names a date with no class (#532). */
export const DAYS_OFF_AHEAD = 28;

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/**
 * The dates ("YYYY-MM-DD", Europe/Amsterdam) with no class of each class time, by its id, from the date of `now` for
 * 4 weeks (`DAYS_OFF_AHEAD` dates): a date on the weekday of the class time in a closed period of the rule. Nina's
 * rule (#531, answer A): a closed day means no class. A class time with no such date is not in the map.
 */
export function classDaysOff(rule: HoursRule, times: ClassTime[], now: number): Map<number, string[]> {
  const today = DateTime.fromMillis(now, { zone: TIME_ZONE }).startOf("day");
  const closed = (rule.closed ?? []).map((c) => ({ from: c.from, to: c.to ?? c.from }));
  const result = new Map<number, string[]>();
  for (let i = 0; i < DAYS_OFF_AHEAD; i++) {
    const date = today.plus({ days: i });
    const iso = date.toISODate() ?? "";
    if (!closed.some(({ from, to }) => from <= iso && iso <= to)) continue;
    for (const time of times) {
      if (time.weekday !== WEEKDAYS[date.weekday - 1]) continue;
      result.set(time.id, [...(result.get(time.id) ?? []), iso]);
    }
  }
  return result;
}
