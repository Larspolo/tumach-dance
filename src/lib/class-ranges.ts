// The class times of the studio as busy ranges (#99): a class uses the room, so no slot may overlap it.
import { DateTime } from "luxon";
import type { ClassTime } from "../db/classes";
import { type OpenRange, TIME_ZONE, type Weekday } from "./hours";

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** The instant of a local "HH:MM" on a local date. Luxon takes care of the changes of summer time (see `hours.ts`). */
function at(date: DateTime, time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return date.set({ hour, minute }).toMillis();
}

/** The class times on each local date ("YYYY-MM-DD", both inclusive) of their weekday, sorted by date and start. */
export function classRanges(times: ClassTime[], fromDate: string, toDate: string): OpenRange[] {
  const last = DateTime.fromISO(toDate, { zone: TIME_ZONE });
  const ranges: OpenRange[] = [];
  for (let date = DateTime.fromISO(fromDate, { zone: TIME_ZONE }); date <= last; date = date.plus({ days: 1 })) {
    const weekday = WEEKDAYS[date.weekday - 1];
    for (const time of times) {
      if (time.weekday === weekday) ranges.push({ start: at(date, time.from), end: at(date, time.to) });
    }
  }
  return ranges.sort((a, b) => a.start - b.start);
}
