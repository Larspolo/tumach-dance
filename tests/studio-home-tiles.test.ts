// The studio home has five tiles of one color (Nina, #786, #838); Setup and Testing hold the other links.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const page = readFileSync("src/app/studio/page.tsx", "utf8");
const css = readFileSync("src/app/studio/studio.module.css", "utf8");

test("the home has the five tiles of Nina and no other link", () => {
  const hrefs = [...page.matchAll(/href=\{?["`]([^"`]+)["`]/g)].map((m) => m[1]).filter((h) => !h.includes("#"));
  expect(hrefs).toEqual(["/studio/bookings", "/studio/messages", "/studio/money", "/studio/setup", "/studio/testing"]);
  expect(page).not.toContain("/studio/search");
  expect(page).not.toContain("PasskeyOffer");
});

test("setup and testing hold the other links", () => {
  const setup = readFileSync("src/app/studio/setup/page.tsx", "utf8");
  for (const key of ['"hours"', '"offers"', '"photos"', '"classes"', "calendarAdd"]) expect(setup).toContain(key);
  const testing = readFileSync("src/app/studio/testing/page.tsx", "utf8");
  for (const key of ["/studio/questions", "PushButtons", "/studio/feedback", "studio-guide"])
    expect(testing).toContain(key);
});

test("all tiles have one color", () => {
  expect(css).not.toMatch(/\.tileRow:nth-of-type/);
});
