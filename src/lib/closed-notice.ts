import { DateTime } from "luxon";
import { type HoursRule, TIME_ZONE } from "./hours";

export type ClosedNotice = { from: string; to: string };

/** The weeks before a closed period in which the home page shows it (#530). */
export const NOTICE_WEEKS = 4;

/**
 * The closed periods of the rule to show on the home page at `now` (epoch ms), in date order: from 4 weeks before the
 * first day (00:00 Europe/Amsterdam) until the end of the last day (`to` inclusive). A past period does not show.
 */
export function closedNotices(rule: HoursRule, now: number): ClosedNotice[] {
  return (rule.closed ?? [])
    .map((c) => ({ from: c.from, to: c.to ?? c.from }))
    .filter(({ from, to }) => {
      const start = DateTime.fromISO(from, { zone: TIME_ZONE }).startOf("day");
      const end = DateTime.fromISO(to, { zone: TIME_ZONE }).plus({ days: 1 }).startOf("day");
      return start.minus({ weeks: NOTICE_WEEKS }).toMillis() <= now && now < end.toMillis();
    })
    .sort((a, b) => a.from.localeCompare(b.from));
}

/** A Date for the ICU date format of a local date: 12:00 UTC is on that date in each European time zone. */
export function noticeDate(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}
