import { describe, expect, it } from "vitest";
import { DEFAULT_RULE, type HoursRule } from "../src/lib/hours";
import { addClosed, addExtraOpen, dateKey, removeDate, upcoming } from "../src/lib/hours-dates";

function post(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

const rule: HoursRule = { ...DEFAULT_RULE, closed: [], extraOpen: [] };

describe("the closed dates and extra open days (#24)", () => {
  it("closes one date and a period", () => {
    const one = addClosed(rule, post({ closedFrom: "2026-12-24", closedTo: "" }));
    expect(one.closed).toEqual([{ from: "2026-12-24" }]);
    const period = addClosed(one, post({ closedFrom: "2026-12-27", closedTo: "2026-12-29" }));
    expect(period.closed).toEqual([{ from: "2026-12-24" }, { from: "2026-12-27", to: "2026-12-29" }]);
  });

  it("refuses a period that ends before it starts, and a wrong date", () => {
    expect(() => addClosed(rule, post({ closedFrom: "2026-12-29", closedTo: "2026-12-27" }))).toThrow(
      /ends before it starts/,
    );
    expect(() => addClosed(rule, post({ closedFrom: "" }))).toThrow(RangeError);
  });

  it("opens an extra day all day or from a time, one per date", () => {
    const a = addExtraOpen(rule, post({ extraDate: "2026-11-01", extraMode: "allDay" }));
    const b = addExtraOpen(a, post({ extraDate: "2026-11-01", extraMode: "from", extraFrom: "18:30" }));
    expect(b.extraOpen).toEqual([{ date: "2026-11-01", hours: { from: "18:30" } }]);
    expect(() => addExtraOpen(rule, post({ extraDate: "2026-11-01", extraMode: "from", extraFrom: "" }))).toThrow(
      RangeError,
    );
  });

  it("removes an item by its key", () => {
    const r = { ...rule, closed: [{ from: "2026-12-24" }, { from: "2026-12-27", to: "2026-12-29" }] };
    expect(removeDate(r, "closed", "2026-12-27/2026-12-29").closed).toEqual([{ from: "2026-12-24" }]);
    const e = { ...rule, extraOpen: [{ date: "2026-11-01", hours: "allDay" as const }] };
    expect(removeDate(e, "extra", dateKey(e.extraOpen[0])).extraOpen).toEqual([]);
  });

  it("lists only the items that are not past, and keeps the past ones in the rule", () => {
    const r: HoursRule = {
      ...rule,
      closed: [{ from: "2026-10-01" }, { from: "2026-10-28", to: "2026-11-02" }, { from: "2026-12-24" }],
      extraOpen: [
        { date: "2026-10-03", hours: "allDay" },
        { date: "2026-11-01", hours: "allDay" },
      ],
    };
    const list = upcoming(r, "2026-10-30");
    expect(list.closed.map(dateKey)).toEqual(["2026-10-28/2026-11-02", "2026-12-24/2026-12-24"]);
    expect(list.extraOpen.map((e) => e.date)).toEqual(["2026-11-01"]);
    expect(addClosed(r, post({ closedFrom: "2027-01-01" })).closed).toHaveLength(4);
  });
});
