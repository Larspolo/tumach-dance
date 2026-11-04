// The time of the offline line of the studio app (#747), in Europe/Amsterdam, also on the days of summer time.
import { describe, expect, it } from "vitest";
import { offlineTimeText } from "../src/lib/offline-time";

describe("offlineTimeText", () => {
  it("gives only the time for a page of today", () => {
    expect(offlineTimeText("2026-11-03T13:05:00Z", "2026-11-03T18:00:00Z", "en")).toBe("14:05");
  });
  it("gives the date and the time for a page of yesterday", () => {
    expect(offlineTimeText("2026-11-02T13:05:00Z", "2026-11-03T08:00:00Z", "en")).toBe("2 Nov 14:05");
    expect(offlineTimeText("2026-03-02T13:05:00Z", "2026-03-03T08:00:00Z", "nl")).toBe("2 mrt 14:05");
  });
  it("uses the Amsterdam day, not the UTC day", () => {
    // 23:30 UTC on 2 Nov is 00:30 on 3 Nov in Amsterdam.
    expect(offlineTimeText("2026-11-02T23:30:00Z", "2026-11-03T08:00:00Z", "en")).toBe("00:30");
  });
  it("is right on the day of the change to summer time", () => {
    // 29 March 2026: 02:00 becomes 03:00. 00:30 UTC = 01:30 CET, 10:00 UTC = 12:00 CEST.
    expect(offlineTimeText("2026-03-29T00:30:00Z", "2026-03-29T10:00:00Z", "en")).toBe("01:30");
    expect(offlineTimeText("2026-03-28T22:30:00Z", "2026-03-29T10:00:00Z", "en")).toBe("28 Mar 23:30");
  });
  it("is right on the day of the change from summer time", () => {
    // 25 October 2026: 03:00 becomes 02:00. 00:30 UTC = 02:30 CEST, 01:30 UTC = 02:30 CET.
    expect(offlineTimeText("2026-10-25T00:30:00Z", "2026-10-25T22:30:00Z", "en")).toBe("02:30");
    expect(offlineTimeText("2026-10-25T01:30:00Z", "2026-10-25T22:30:00Z", "en")).toBe("02:30");
    expect(offlineTimeText("2026-10-24T21:30:00Z", "2026-10-25T22:30:00Z", "en")).toBe("24 Oct 23:30");
  });
});
