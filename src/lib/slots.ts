import { DateTime } from "luxon";
import { type OpenRange, TIME_ZONE } from "./hours";

const MINUTE = 60_000;

/** The first instant at or after `time` on a local minute of the day that is a multiple of `step`. */
function align(time: number, step: number): number {
  const local = DateTime.fromMillis(time, { zone: TIME_ZONE });
  const rest = ((local.hour * 60 + local.minute) % step) * MINUTE + local.second * 1000 + local.millisecond;
  return rest === 0 ? time : time - rest + step * MINUTE;
}

/** The free slots of `minutes` inside the open ranges, with no overlap with a busy range, sorted by start. */
export function freeSlots(
  open: OpenRange[],
  busy: OpenRange[],
  minutes: number,
  options: { notBefore: number; stepMinutes?: number },
): OpenRange[] {
  const step = options.stepMinutes ?? 30;
  const length = minutes * MINUTE;
  const slots: OpenRange[] = [];
  for (const range of open) {
    let start = align(Math.max(range.start, options.notBefore), step);
    while (start + length <= range.end) {
      const end = start + length;
      if (!busy.some((b) => b.start < end && start < b.end)) slots.push({ start, end });
      start = align(start + step * MINUTE, step);
    }
  }
  return slots.sort((a, b) => a.start - b.start);
}
