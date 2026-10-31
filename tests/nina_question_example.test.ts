// The line `Example: <name>` of a question for Nina (#146): the "Try" link loads the seed once, only on the preview.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DateTime } from "luxon";
import { afterAll, expect, test } from "vitest";
import { openDb } from "../src/db";
import { bookings, loadedExamples } from "../src/db/schema";
import { loadExample, tryHref, tryQuestion } from "../src/lib/examples";
import { parseNinaQuestion } from "../src/lib/nina-question";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const dir = mkdtempSync(join(tmpdir(), "nina-example-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const body = (example: string) =>
  `## For Nina\nDo the new bookings look clear?\nTry: /studio/bookings\n${example}\n- A. Yes\n- B. No\n\n## Verify\nLevel 1.`;
function question(example: string) {
  const q = parseNinaQuestion({ number: 12, title: "Question for Nina: bookings", body: body(example) });
  if (!q) throw new Error("no question");
  return q;
}

test("reads the name of the line Example", () => {
  const q = question("Example: bookings");
  expect(q.example).toBe("bookings");
  expect(q.tryPath).toBe("/studio/bookings");
  expect(q.text).toBe("Do the new bookings look clear?");
  expect(q.choices.map((c) => c.key)).toEqual(["A", "B"]);
});

test("an unknown name or no line gives no example, and the question still shows", () => {
  const unknown = question("Example: dragons");
  expect(unknown.example).toBeNull();
  expect(unknown.choices).toHaveLength(2);
  expect(question("").example).toBeNull();
});

test("on the preview the Try link of a question with an example goes through the route that loads it", () => {
  expect(tryHref(question("Example: bookings"), "preview")).toBe("/studio/questions/try/12");
  expect(tryHref(question(""), "preview")).toBe("/studio/bookings");
});

test("on the live site the link goes to the path and loads no seed", () => {
  const db = openDb(":memory:");
  const q = question("Example: bookings");
  expect(tryHref(q, "live")).toBe("/studio/bookings");
  expect(tryQuestion(db, q, "live", NOW)).toBe("/studio/bookings");
  expect(db.select().from(bookings).all()).toEqual([]);
  expect(db.select().from(loadedExamples).all()).toEqual([]);
});

test("on the preview the Try route loads the seed once and opens the Try path", () => {
  const db = openDb(":memory:");
  const q = question("Example: bookings");
  expect(tryQuestion(db, q, "preview", NOW)).toBe("/studio/bookings");
  expect(tryQuestion(db, q, "preview", NOW)).toBe("/studio/bookings");
  expect(db.select().from(bookings).all()).toHaveLength(4);
});

test("two taps at the same time on two devices load the seed once", async () => {
  // Two connections to one file, as two requests or a restart.
  const path = join(dir, "two.db");
  const [one, two] = [openDb(path), openDb(path)];
  const q = question("Example: bookings");
  const loaded = await Promise.all([
    Promise.resolve().then(() => loadExample(one, q.number, "bookings", NOW)),
    Promise.resolve().then(() => loadExample(two, q.number, "bookings", NOW)),
  ]);
  expect(loaded.filter(Boolean)).toHaveLength(1);
  expect(one.select().from(bookings).all()).toHaveLength(4);
  // Another question loads its own seed.
  expect(loadExample(two, 13, "bookings", NOW)).toBe(true);
  expect(one.select().from(bookings).all()).toHaveLength(8);
  one.$client.close();
  two.$client.close();
});
