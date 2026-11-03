// The links of the studio home are tiles of one color (Nina, #786).
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const page = readFileSync("src/app/studio/page.tsx", "utf8");
const css = readFileSync("src/app/studio/studio.module.css", "utf8");

test("the search, money and guide links of the home are tiles", () => {
  for (const href of ['href="/studio/search"', 'href="/studio/money"', "studio-guide`}"]) {
    const line = page.split("\n").find((l) => l.includes(href)) ?? "";
    expect(line).toContain("styles.tile");
  }
});

test("all tiles have one color", () => {
  expect(css).not.toMatch(/\.tileRow:nth-of-type/);
});
