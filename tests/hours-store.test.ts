// Nina's hours rule in the database (#22).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import { openDb } from "../src/db";
import { DEFAULT_RULE, type HoursRule } from "../src/lib/hours";
import { getHoursRule, saveHoursRule } from "../src/lib/hours-store";

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const RULE: HoursRule = {
  weekly: { mon: { from: "09:00", to: "12:00" }, sat: "allDay" },
  closed: [{ from: "2026-12-24", to: "2026-12-26" }],
  extraOpen: [{ date: "2026-12-27", hours: { from: "14:00" } }],
};

test("an empty database gives the default rule", () => {
  expect(getHoursRule(openDb(":memory:"))).toEqual(DEFAULT_RULE);
});

test("a saved rule comes back equal, and a second save replaces the first", () => {
  const db = openDb(":memory:");
  saveHoursRule(db, RULE);
  expect(getHoursRule(db)).toEqual(RULE);
  saveHoursRule(db, DEFAULT_RULE);
  expect(getHoursRule(db)).toEqual(DEFAULT_RULE);
});

test("a saved rule survives a new connection to the same file", () => {
  const dir = mkdtempSync(join(tmpdir(), "tumach-hours-"));
  dirs.push(dir);
  const first = openDb(join(dir, "t.db"));
  saveHoursRule(first, RULE);
  first.$client.close();
  expect(getHoursRule(openDb(join(dir, "t.db")))).toEqual(RULE);
});

test.each<[string, HoursRule]>([
  ["a wrong time", { weekly: { tue: { from: "25:00" } } }],
  ["a wrong date", { weekly: {}, closed: [{ from: "2026-13-01" }] }],
  ["a wrong extra date", { weekly: {}, extraOpen: [{ date: "2027-02-30", hours: "allDay" }] }],
  ["a range that ends before it starts", { weekly: { wed: { from: "18:00", to: "10:00" } } }],
  [
    "an extra range that ends before it starts",
    { weekly: {}, extraOpen: [{ date: "2030-05-01", hours: { from: "18:00", to: "10:00" } }] },
  ],
  ["a period that ends before it starts", { weekly: {}, closed: [{ from: "2026-05-02", to: "2026-05-01" }] }],
])("saveHoursRule refuses %s and keeps the stored rule", (_, wrong) => {
  const db = openDb(":memory:");
  saveHoursRule(db, RULE);
  expect(() => saveHoursRule(db, wrong)).toThrow(RangeError);
  expect(getHoursRule(db)).toEqual(RULE);
});
