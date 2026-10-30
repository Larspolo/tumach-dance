import { describe, expect, test } from "vitest";
import { freeSlots } from "../src/lib/slots";

const utc = (iso: string): number => Date.parse(iso);
const range = (start: string, end: string) => ({ start: utc(start), end: utc(end) });
const starts = (slots: { start: number }[]) => slots.map((s) => new Date(s.start).toISOString().slice(11, 16));

// 17:00 to 22:00 local time on a winter day (UTC+1).
const EVENING = range("2026-11-02T16:00Z", "2026-11-02T21:00Z");
const EARLY = { notBefore: 0 };

describe("freeSlots", () => {
  test("gives a start each half hour from 17:00 to 21:00 local time", () => {
    const slots = freeSlots([EVENING], [], 60, EARLY);
    expect(starts(slots)).toEqual(["16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"]);
    expect(slots[0]).toEqual(range("2026-11-02T16:00Z", "2026-11-02T17:00Z"));
  });

  test("removes the slots that overlap a busy range, touching ends stay", () => {
    const busy = [range("2026-11-02T17:00Z", "2026-11-02T18:00Z")];
    expect(starts(freeSlots([EVENING], busy, 60, EARLY))).toEqual([
      "16:00",
      "18:00",
      "18:30",
      "19:00",
      "19:30",
      "20:00",
    ]);
  });

  test("gives no slot for an offer longer than the open range", () => {
    expect(freeSlots([EVENING], [], 6 * 60, EARLY)).toEqual([]);
  });

  test("removes the slots before notBefore and starts on the next step", () => {
    const slots = freeSlots([EVENING], [], 60, { notBefore: utc("2026-11-02T18:10Z") });
    expect(starts(slots)).toEqual(["18:30", "19:00", "19:30", "20:00"]);
  });

  test("uses the step of the options and sorts by start", () => {
    const late = range("2026-11-03T16:00Z", "2026-11-03T18:00Z");
    const slots = freeSlots([late, EVENING], [], 60, { notBefore: 0, stepMinutes: 60 });
    expect(slots.map((s) => s.start)).toEqual(
      [
        "2026-11-02T16:00Z",
        "2026-11-02T17:00Z",
        "2026-11-02T18:00Z",
        "2026-11-02T19:00Z",
        "2026-11-02T20:00Z",
        "2026-11-03T16:00Z",
        "2026-11-03T17:00Z",
      ].map(utc),
    );
  });

  test("gives 17:00 local time as 15:00 UTC after the change to summer time", () => {
    const open = range("2026-03-29T00:30Z", "2026-03-29T20:00Z");
    expect(freeSlots([open], [], 60, EARLY)).toContainEqual(range("2026-03-29T15:00Z", "2026-03-29T16:00Z"));
    expect(freeSlots([open], [], 60, EARLY)[0].start).toBe(utc("2026-03-29T00:30Z"));
  });

  test("gives 17:00 local time as 16:00 UTC after the change from summer time", () => {
    const open = range("2026-10-24T22:00Z", "2026-10-25T21:00Z");
    expect(freeSlots([open], [], 60, EARLY)).toContainEqual(range("2026-10-25T16:00Z", "2026-10-25T17:00Z"));
  });
});
