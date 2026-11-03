// The month of the money page and the months before and after (#598).
import { describe, expect, it } from "vitest";
import { monthOf } from "../src/lib/money";

// 1 November 2026 00:30 in Amsterdam is still 31 October in UTC.
const now = Date.parse("2026-10-31T23:30:00Z");

describe("monthOf", () => {
  it("gives the current month in Amsterdam time for a missing or wrong value", () => {
    for (const param of [undefined, "", "x", "2026-13", "2026-00", "2026-1"]) {
      expect(monthOf(param, now)).toEqual({ month: "2026-11", previous: "2026-10", next: "2026-12" });
    }
  });

  it("takes a good month and crosses the year", () => {
    expect(monthOf("2027-01", now)).toEqual({ month: "2027-01", previous: "2026-12", next: "2027-02" });
  });
});
