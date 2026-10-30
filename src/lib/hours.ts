// The open hours of the studio: Nina's rule to the open time ranges (#16, roadmap `nina:hours`).
// Luxon does the time zone work (P3): no own offset code.
import { DateTime } from "luxon";

export const TIME_ZONE = "Europe/Amsterdam";

/** A range of local times on one day, "HH:MM". No `to`: the end of `day` of the rule. "24:00" is the end of the day. */
export type TimeRange = { from: string; to?: string };
export type DayHours = "closed" | "allDay" | TimeRange;
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/**
 * Nina's hours rule: a plain, JSON-safe object (the database stores it as is).
 *
 * The hours of a date come from the first of these that names the date:
 * 1. `closed` (a date or a period, `to` inclusive): no open time,
 * 2. `extraOpen`: its hours,
 * 3. `weekly`: the hours of its weekday (a missing weekday is closed).
 */
export type HoursRule = {
  /** The hours of "all day". No value: `ALL_DAY`. */
  day?: { from: string; to: string };
  weekly: Partial<Record<Weekday, DayHours>>;
  closed?: { from: string; to?: string }[];
  extraOpen?: { date: string; hours: "allDay" | TimeRange }[];
};

/** An open range: instants in UTC, epoch milliseconds; `end` is exclusive. */
export type OpenRange = { start: number; end: number };

/** The hours of "all day" until Nina gives the real ones. */
export const ALL_DAY = { from: "10:00", to: "22:00" };

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

function localDate(text: string): DateTime {
  const date = DATE.test(text) ? DateTime.fromISO(text, { zone: TIME_ZONE }) : null;
  if (!date?.isValid) throw new RangeError(`Not a date (YYYY-MM-DD): ${text}`);
  return date;
}

/**
 * The instant of a local time on a date. At the changes of summer time, Luxon decides (the tests show it):
 * a time that does not exist (02:00 to 03:00 on the last Sunday of March) moves one hour later, and a time that
 * exists twice (02:00 to 03:00 on the last Sunday of October) is the first one, in summer time. This is also the
 * default ("compatible") of the coming JavaScript standard Temporal.
 */
function instant(date: DateTime, time: string): number {
  if (!TIME.test(time)) throw new RangeError(`Not a time (HH:MM): ${time}`);
  if (time === "24:00") return date.plus({ days: 1 }).toMillis();
  const [hour, minute] = time.split(":").map(Number);
  return date.set({ hour, minute }).toMillis();
}

function hoursOf(rule: HoursRule, date: DateTime): DayHours {
  if (rule.closed?.some((c) => localDate(c.from) <= date && date <= localDate(c.to ?? c.from))) return "closed";
  const extra = rule.extraOpen?.find((e) => localDate(e.date).equals(date));
  if (extra) return extra.hours;
  return rule.weekly[WEEKDAYS[date.weekday - 1]] ?? "closed";
}

/** The open ranges of the studio from `fromDate` to `toDate` (local dates "YYYY-MM-DD", both inclusive), sorted. */
export function openRanges(rule: HoursRule, fromDate: string, toDate: string): OpenRange[] {
  const day = rule.day ?? ALL_DAY;
  const last = localDate(toDate);
  const ranges: OpenRange[] = [];
  for (let date = localDate(fromDate); date <= last; date = date.plus({ days: 1 })) {
    const hours = hoursOf(rule, date);
    if (hours === "closed") continue;
    const range = hours === "allDay" ? day : { from: hours.from, to: hours.to ?? day.to };
    const start = instant(date, range.from);
    const end = instant(date, range.to);
    if (end <= start) throw new RangeError(`The range ends before it starts: ${range.from} to ${range.to}`);
    ranges.push({ start, end });
  }
  return ranges;
}
