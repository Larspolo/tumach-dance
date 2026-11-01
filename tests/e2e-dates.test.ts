// Two browser tests that use the same far-future day conflict: they share one database (#333).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

const DIR = join(__dirname, "..", "e2e");

test("no two browser tests use the same far-future date", () => {
  const owners = new Map<string, string>();
  const clashes: string[] = [];
  for (const file of readdirSync(DIR)
    .filter((f) => f.endsWith(".spec.ts"))
    .sort()) {
    const dates = new Set(readFileSync(join(DIR, file), "utf8").match(/20[3-9]\d-\d\d-\d\d/g) ?? []);
    for (const date of dates) {
      const other = owners.get(date);
      if (other) clashes.push(`${date}: ${other} and ${file}`);
      else owners.set(date, file);
    }
  }
  expect(clashes).toEqual([]);
});
