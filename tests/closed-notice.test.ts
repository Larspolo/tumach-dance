import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { closedNotices, noticeDate } from "../src/lib/closed-notice";
import { DEFAULT_RULE, type HoursRule } from "../src/lib/hours";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "Europe/Amsterdam" }).toMillis();
const rule = (closed: HoursRule["closed"]): HoursRule => ({ ...DEFAULT_RULE, closed });

describe("closedNotices", () => {
  const xmas = rule([{ from: "2026-12-21", to: "2026-12-28" }]);

  it("shows a period from 4 weeks before its first day", () => {
    expect(closedNotices(xmas, at("2026-11-22T23:59"))).toEqual([]);
    expect(closedNotices(xmas, at("2026-11-23T00:00"))).toEqual([{ from: "2026-12-21", to: "2026-12-28" }]);
  });

  it("shows a started period until the end of its last day, then not", () => {
    expect(closedNotices(xmas, at("2026-12-28T23:59"))).toHaveLength(1);
    expect(closedNotices(xmas, at("2026-12-29T00:00"))).toEqual([]);
  });

  it("shows one closed date as a period of one day", () => {
    expect(closedNotices(rule([{ from: "2026-12-24" }]), at("2026-12-24T20:00"))).toEqual([
      { from: "2026-12-24", to: "2026-12-24" },
    ]);
  });

  it("uses local time over the change to and from summer time", () => {
    const autumn = rule([{ from: "2026-10-24", to: "2026-10-25" }]);
    expect(closedNotices(autumn, at("2026-10-25T23:59"))).toHaveLength(1);
    expect(closedNotices(autumn, at("2026-10-26T00:00"))).toEqual([]);
    // 4 weeks before 2027-04-01 is 2027-03-04 (winter time); the period ends after the change to summer time.
    const spring = rule([{ from: "2027-04-01", to: "2027-04-02" }]);
    expect(closedNotices(spring, at("2027-03-03T23:59"))).toEqual([]);
    expect(closedNotices(spring, at("2027-03-04T00:00"))).toHaveLength(1);
    expect(closedNotices(spring, at("2027-04-02T23:59"))).toHaveLength(1);
  });

  it("lists several periods in date order", () => {
    const two = rule([{ from: "2026-12-31" }, { from: "2026-12-21", to: "2026-12-24" }]);
    expect(closedNotices(two, at("2026-12-10T12:00")).map((n) => n.from)).toEqual(["2026-12-21", "2026-12-31"]);
  });

  it("has no notice with no closed dates", () => {
    expect(closedNotices(DEFAULT_RULE, at("2026-12-01T12:00"))).toEqual([]);
  });

  it("makes a date on the same local day", () => {
    expect(noticeDate("2026-12-24").toISOString()).toBe("2026-12-24T12:00:00.000Z");
  });
});
