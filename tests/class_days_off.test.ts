// The dates with no class in the schedule of the home page (#532): a closed day means no class (Nina, #531 A).
import { DateTime } from "luxon";
import { describe, expect, test } from "vitest";
import type { ClassTime } from "../src/db/classes";
import { classDaysOff } from "../src/lib/class-days-off";
import { DEFAULT_RULE, type HoursRule } from "../src/lib/hours";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const time = (id: number, weekday: string) => ({ id, classId: 1, weekday, from: "19:00", to: "20:00" }) as ClassTime;
const rule = (closed: HoursRule["closed"]): HoursRule => ({ ...DEFAULT_RULE, closed });
const times = [time(1, "sun"), time(2, "mon"), time(3, "sat")];

describe("classDaysOff", () => {
  test("a closed period over the end of summer time names the dates of each class time on its weekday", () => {
    // 2026-10-25 (Sunday): the clocks go from 03:00 back to 02:00.
    const off = classDaysOff(rule([{ from: "2026-10-24", to: "2026-10-26" }]), times, at("2026-10-20T12:00"));
    expect(off.get(1)).toEqual(["2026-10-25"]);
    expect(off.get(2)).toEqual(["2026-10-26"]);
    expect(off.get(3)).toEqual(["2026-10-24"]);
  });

  test("one closed date on the day of the change to summer time", () => {
    const off = classDaysOff(rule([{ from: "2027-03-28" }]), times, at("2027-03-27T23:30"));
    expect(off.get(1)).toEqual(["2027-03-28"]);
    expect(off.has(2)).toBe(false);
  });

  test("the local date of now counts, also late in the evening (UTC is still the day before)", () => {
    // 00:30 on Sunday in Amsterdam is 22:30 UTC on Saturday.
    const off = classDaysOff(rule([{ from: "2026-11-08" }]), times, at("2026-11-08T00:30"));
    expect(off.get(1)).toEqual(["2026-11-08"]);
  });

  test("a date 4 weeks away or more, and a past date, do not show", () => {
    const now = at("2026-11-01T12:00"); // Sunday
    const off = classDaysOff(
      rule([{ from: "2026-10-25" }, { from: "2026-11-22" }, { from: "2026-11-29" }]),
      times,
      now,
    );
    expect(off.get(1)).toEqual(["2026-11-22"]);
  });

  test("several Sundays in one period, and no closed period", () => {
    const off = classDaysOff(rule([{ from: "2026-12-19", to: "2027-01-03" }]), times, at("2026-12-10T12:00"));
    expect(off.get(1)).toEqual(["2026-12-20", "2026-12-27", "2027-01-03"]);
    expect(classDaysOff(rule(undefined), times, at("2026-12-10T12:00")).size).toBe(0);
  });
});
