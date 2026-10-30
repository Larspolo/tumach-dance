import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import { TIME_ZONE } from "../src/lib/hours";
import { localDate, weekOf } from "../src/lib/week";

describe("weekOf", () => {
  it("gives Monday to Sunday of a date", () => {
    const week = weekOf("2026-10-29");
    expect(week.days).toEqual([
      "2026-10-26",
      "2026-10-27",
      "2026-10-28",
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(week.previous).toBe("2026-10-19");
    expect(week.next).toBe("2026-11-02");
  });

  it("gives the week of the end of summer time (2026-10-25, a Sunday) with 169 hours", () => {
    const week = weekOf("2026-10-25");
    expect(week.start).toBe("2026-10-19");
    expect(week.days[6]).toBe("2026-10-25");
    expect(week.from).toBe(DateTime.fromISO("2026-10-19T00:00", { zone: TIME_ZONE }).toMillis());
    expect(week.to).toBe(DateTime.fromISO("2026-10-26T00:00", { zone: TIME_ZONE }).toMillis());
    expect((week.to - week.from) / 3_600_000).toBe(169);
    expect(weekOf("2026-10-19").days).toEqual(week.days);
  });

  it("gives the week of the start of summer time with 167 hours", () => {
    const week = weekOf("2026-03-29");
    expect(week.start).toBe("2026-03-23");
    expect((week.to - week.from) / 3_600_000).toBe(167);
  });

  it("gives the week of now for a missing or wrong date", () => {
    const now = DateTime.fromISO("2026-10-30T23:30", { zone: TIME_ZONE }).toMillis();
    expect(weekOf(undefined, now).start).toBe("2026-10-26");
    expect(weekOf("nonsense", now).start).toBe("2026-10-26");
    expect(weekOf("2026-02-31", now).start).toBe("2026-10-26");
  });

  it("gives the local date of an instant", () => {
    expect(localDate(Date.UTC(2026, 9, 25, 23, 30))).toBe("2026-10-26");
  });
});
