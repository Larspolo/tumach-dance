import { describe, expect, it } from "vitest";
import { DEFAULT_RULE, type HoursRule } from "../src/lib/hours";
import { formToRule, readHoursForm, ruleToForm } from "../src/lib/hours-form";

function post(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

describe("the form of the Hours page", () => {
  it("makes the rule of P1 from its choices", () => {
    const form = readHoursForm(
      post({
        weekdaysMode: "from",
        weekdaysFrom: "17:00",
        "day-mon": "on",
        "day-tue": "on",
        "day-wed": "on",
        "day-fri": "on",
        weekendMode: "allDay",
        weekendFrom: "",
      }),
    );
    expect(formToRule(form, { weekly: {} })).toEqual(DEFAULT_RULE);
  });

  it("shows a stored rule and gives it back", () => {
    expect(formToRule(ruleToForm(DEFAULT_RULE), DEFAULT_RULE)).toEqual(DEFAULT_RULE);
    const closed: HoursRule = { weekly: {} };
    expect(ruleToForm(closed)).toMatchObject({ weekdays: { mode: "closed" }, weekend: { mode: "closed" } });
    expect(formToRule(ruleToForm(closed), closed)).toEqual(closed);
  });

  it("keeps the closed dates and the hours of all day", () => {
    const stored: HoursRule = {
      ...DEFAULT_RULE,
      day: { from: "09:00", to: "21:00" },
      closed: [{ from: "2026-12-25" }],
    };
    const rule = formToRule(ruleToForm(stored), stored);
    expect(rule.day).toEqual(stored.day);
    expect(rule.closed).toEqual(stored.closed);
  });

  it("refuses an empty time and a wrong mode", () => {
    const form = readHoursForm(
      post({ weekdaysMode: "from", weekdaysFrom: "", "day-mon": "on", weekendMode: "closed" }),
    );
    expect(() => formToRule(form, DEFAULT_RULE)).toThrow(RangeError);
    expect(() => readHoursForm(post({ weekdaysMode: "x", weekendMode: "closed" }))).toThrow(RangeError);
  });
});
