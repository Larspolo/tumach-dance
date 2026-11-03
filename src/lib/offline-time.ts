import { DateTime } from "luxon";
import { TIME_ZONE } from "./hours";

// The time of the offline line of the studio app (#747): the time at which the server made the page, in Amsterdam
// time. Of today only the time ("14:05"), else the date and the time ("2 Nov 14:05").
export function offlineTimeText(madeAtIso: string, nowIso: string, locale: string): string {
  const made = DateTime.fromISO(madeAtIso, { zone: TIME_ZONE }).setLocale(locale);
  const now = DateTime.fromISO(nowIso, { zone: TIME_ZONE });
  const time = made.toFormat("HH:mm");
  if (made.hasSame(now, "day")) return time;
  return `${made.toFormat("d LLL")} ${time}`;
}
