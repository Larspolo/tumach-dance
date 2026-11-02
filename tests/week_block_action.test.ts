// The form "Keep a time free" of the week page (#327): local date and times to UTC instants.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { listBlocks } from "../src/db/blocks";
import { addLocalBlock } from "../src/lib/week-block";

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "week-block-"));
  db = openDb(join(dir, "test.db"));
});

afterEach(() => {
  db.$client.close();
  rmSync(dir, { recursive: true, force: true });
});

const iso = (ms: number) => new Date(ms).toISOString();

test("a winter day: local time is UTC plus 1", () => {
  const block = addLocalBlock(db, { date: "2026-12-03", from: "18:00", to: "19:00" });
  expect([iso(block.start), iso(block.end)]).toEqual(["2026-12-03T17:00:00.000Z", "2026-12-03T18:00:00.000Z"]);
});

test("the start of summer time (2027-03-28): before and after the change", () => {
  const block = addLocalBlock(db, { date: "2027-03-28", from: "01:00", to: "18:30" });
  expect([iso(block.start), iso(block.end)]).toEqual(["2027-03-28T00:00:00.000Z", "2027-03-28T16:30:00.000Z"]);
});

test("the end of summer time (2026-10-25): before and after the change", () => {
  const block = addLocalBlock(db, { date: "2026-10-25", from: "01:30", to: "18:00" });
  expect([iso(block.start), iso(block.end)]).toEqual(["2026-10-24T23:30:00.000Z", "2026-10-25T17:00:00.000Z"]);
});

test("an end before or at the start, or a wrong date or time, stores nothing", () => {
  const wrong = [
    { date: "2026-12-03", from: "19:00", to: "18:00" },
    { date: "2026-12-03", from: "18:00", to: "18:00" },
    { date: "2026-13-03", from: "18:00", to: "19:00" },
    { date: "2026-12-03", from: "18", to: "19:00" },
    { date: "", from: "", to: "" },
  ];
  for (const block of wrong) expect(() => addLocalBlock(db, block)).toThrow(RangeError);
  expect(listBlocks(db, 0, Number.MAX_SAFE_INTEGER)).toEqual([]);
});
