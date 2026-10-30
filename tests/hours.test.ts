import { describe, expect, test } from "vitest";
import { type HoursRule, openRanges } from "../src/lib/hours";

const utc = (iso: string): number => Date.parse(iso);
const range = (start: string, end: string) => ({ start: utc(start), end: utc(end) });
const HOUR = 3_600_000;

// The example of P1: "weekends all day, weekdays from 17:00, not on Thursday".
const evening = { from: "17:00" };
const P1: HoursRule = {
  weekly: { mon: evening, tue: evening, wed: evening, fri: evening, sat: "allDay", sun: "allDay" },
};

const e = { from: "17:00", to: "22:00" };
const EVENINGS: HoursRule = { weekly: { mon: e, tue: e, wed: e, thu: e, fri: e, sat: e, sun: e } };

describe("the example of P1 in a winter week (UTC+1)", () => {
  test("gives the exact UTC ranges, with no Thursday", () => {
    expect(openRanges(P1, "2026-11-02", "2026-11-08")).toEqual([
      range("2026-11-02T16:00Z", "2026-11-02T21:00Z"),
      range("2026-11-03T16:00Z", "2026-11-03T21:00Z"),
      range("2026-11-04T16:00Z", "2026-11-04T21:00Z"),
      range("2026-11-06T16:00Z", "2026-11-06T21:00Z"),
      range("2026-11-07T09:00Z", "2026-11-07T21:00Z"),
      range("2026-11-08T09:00Z", "2026-11-08T21:00Z"),
    ]);
  });

  test("uses the `day` of the rule for all day", () => {
    const rule: HoursRule = { ...P1, day: { from: "09:00", to: "23:00" } };
    expect(openRanges(rule, "2026-11-07", "2026-11-07")).toEqual([range("2026-11-07T08:00Z", "2026-11-07T22:00Z")]);
  });
});

describe("the changes of summer time", () => {
  test("to summer time on 2026-03-29: 5 hours each day, the UTC start one hour earlier", () => {
    const ranges = openRanges(EVENINGS, "2026-03-26", "2026-04-01");
    expect(ranges).toHaveLength(7);
    for (const r of ranges) expect(r.end - r.start).toBe(5 * HOUR);
    expect(ranges[2]).toEqual(range("2026-03-28T16:00Z", "2026-03-28T21:00Z"));
    expect(ranges[3]).toEqual(range("2026-03-29T15:00Z", "2026-03-29T20:00Z"));
  });

  test("to winter time on 2026-10-25: 5 hours each day, the UTC start one hour later", () => {
    const ranges = openRanges(EVENINGS, "2026-10-22", "2026-10-28");
    expect(ranges).toHaveLength(7);
    for (const r of ranges) expect(r.end - r.start).toBe(5 * HOUR);
    expect(ranges[2]).toEqual(range("2026-10-24T15:00Z", "2026-10-24T20:00Z"));
    expect(ranges[3]).toEqual(range("2026-10-25T16:00Z", "2026-10-25T21:00Z"));
  });

  test("all day on the day of the change", () => {
    expect(openRanges(P1, "2026-03-29", "2026-03-29")).toEqual([range("2026-03-29T08:00Z", "2026-03-29T20:00Z")]);
    expect(openRanges(P1, "2026-10-25", "2026-10-25")).toEqual([range("2026-10-25T09:00Z", "2026-10-25T21:00Z")]);
  });

  test("a time that does not exist moves one hour later", () => {
    const rule: HoursRule = { weekly: {}, extraOpen: [{ date: "2026-03-29", hours: { from: "02:30", to: "04:00" } }] };
    // 02:30 does not exist: it is 03:30 summer time (01:30 UTC).
    expect(openRanges(rule, "2026-03-29", "2026-03-29")).toEqual([range("2026-03-29T01:30Z", "2026-03-29T02:00Z")]);
  });

  test("a time that exists twice is the first one, in summer time", () => {
    const rule: HoursRule = { weekly: {}, extraOpen: [{ date: "2026-10-25", hours: { from: "02:30", to: "04:00" } }] };
    // 02:30 summer time is 00:30 UTC (02:30 winter time would be 01:30 UTC).
    expect(openRanges(rule, "2026-10-25", "2026-10-25")).toEqual([range("2026-10-25T00:30Z", "2026-10-25T03:00Z")]);
  });

  test("24:00 is midnight at the end of the day, also before a change", () => {
    const rule: HoursRule = { weekly: { sat: { from: "20:00", to: "24:00" } } };
    expect(openRanges(rule, "2026-10-24", "2026-10-24")).toEqual([range("2026-10-24T18:00Z", "2026-10-24T22:00Z")]);
  });
});

describe("closed dates and extra open days", () => {
  const thursday = range("2026-11-05T09:00Z", "2026-11-05T21:00Z");

  test("a closed date has no range", () => {
    const rule: HoursRule = { ...P1, closed: [{ from: "2026-11-04" }] };
    const starts = openRanges(rule, "2026-11-02", "2026-11-08").map((r) =>
      new Date(r.start).toISOString().slice(0, 10),
    );
    expect(starts).toEqual(["2026-11-02", "2026-11-03", "2026-11-06", "2026-11-07", "2026-11-08"]);
  });

  test("a closed period over a weekend closes each of its days", () => {
    const rule: HoursRule = { ...P1, closed: [{ from: "2026-11-06", to: "2026-11-08" }] };
    expect(openRanges(rule, "2026-11-02", "2026-11-08")).toHaveLength(3);
  });

  test("an extra open day opens a closed weekday", () => {
    const rule: HoursRule = { ...P1, extraOpen: [{ date: "2026-11-05", hours: "allDay" }] };
    expect(openRanges(rule, "2026-11-05", "2026-11-05")).toEqual([thursday]);
  });

  test("a closed date wins over an extra open day", () => {
    const rule: HoursRule = {
      ...P1,
      closed: [{ from: "2026-11-01", to: "2026-11-30" }],
      extraOpen: [{ date: "2026-11-05", hours: "allDay" }],
    };
    expect(openRanges(rule, "2026-11-02", "2026-11-08")).toEqual([]);
  });
});

describe("wrong input", () => {
  test("a wrong date, a wrong time or a range that ends before it starts throws", () => {
    expect(() => openRanges(P1, "2026-02-30", "2026-03-01")).toThrow(RangeError);
    expect(() => openRanges(P1, "2026-11-2", "2026-11-08")).toThrow(RangeError);
    expect(() => openRanges({ weekly: { mon: { from: "17:60" } } }, "2026-11-02", "2026-11-02")).toThrow(RangeError);
    expect(() => openRanges({ weekly: { mon: { from: "23:00" } } }, "2026-11-02", "2026-11-02")).toThrow(RangeError);
  });
});
