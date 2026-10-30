// The class times as busy ranges of the booking page (#99): the local times stay the same across summer time.
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import type { ClassTime } from "../src/db/classes";
import { classRanges } from "../src/lib/class-ranges";

const zone = "Europe/Amsterdam";
const local = (ms: number) => DateTime.fromMillis(ms, { zone }).toFormat("yyyy-MM-dd HH:mm");
const utc = (ms: number) => DateTime.fromMillis(ms, { zone: "utc" }).toFormat("yyyy-MM-dd HH:mm");

const tuesday: ClassTime = { id: 1, classId: 1, weekday: "tue", from: "19:00", to: "20:30" };

test("a Tuesday class gives its range on each Tuesday, and only on Tuesdays", () => {
  // 27 Oct and 3 Nov 2026 are Tuesdays in winter time (UTC+1); 28 Oct is a Wednesday.
  const ranges = classRanges([tuesday], "2026-10-26", "2026-11-03");
  expect(ranges.map((r) => [local(r.start), local(r.end)])).toEqual([
    ["2026-10-27 19:00", "2026-10-27 20:30"],
    ["2026-11-03 19:00", "2026-11-03 20:30"],
  ]);
  expect(ranges.map((r) => [utc(r.start), utc(r.end)])).toEqual([
    ["2026-10-27 18:00", "2026-10-27 19:30"],
    ["2026-11-03 18:00", "2026-11-03 19:30"],
  ]);
});

test("the local time stays 19:00 to 20:30 across the change to and from summer time", () => {
  // Summer time starts on 29 Mar 2026 (the Tuesday after is UTC+2) and ends on 25 Oct 2026.
  const spring = classRanges([tuesday], "2026-03-29", "2026-04-07");
  expect(spring.map((r) => [local(r.start), local(r.end)])).toEqual([
    ["2026-03-31 19:00", "2026-03-31 20:30"],
    ["2026-04-07 19:00", "2026-04-07 20:30"],
  ]);
  expect(spring.map((r) => [utc(r.start), utc(r.end)])).toEqual([
    ["2026-03-31 17:00", "2026-03-31 18:30"],
    ["2026-04-07 17:00", "2026-04-07 18:30"],
  ]);

  const autumn = classRanges([tuesday], "2026-10-25", "2026-10-27");
  expect(autumn.map((r) => [local(r.start), local(r.end)])).toEqual([["2026-10-27 19:00", "2026-10-27 20:30"]]);
});

test("no times, or no date of the weekday, give no range", () => {
  expect(classRanges([], "2026-10-26", "2026-11-03")).toEqual([]);
  expect(classRanges([tuesday], "2026-10-28", "2026-10-30")).toEqual([]);
});
