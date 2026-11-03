// The pay action goes back only to a page of the studio app (#599).
import { expect, test } from "vitest";
import { backPath } from "../src/lib/studio-paths";

test("backPath keeps a studio path", () => {
  expect(backPath("/studio/money", "/studio/bookings")).toBe("/studio/money");
  expect(backPath("/studio/money?month=2026-11", "/studio/bookings")).toBe("/studio/money?month=2026-11");
});

test("backPath gives the fallback for another site, another page or no value", () => {
  for (const value of [
    null,
    "",
    "https://evil.example/studio/",
    "//evil.example/studio/money",
    "/studio",
    "/book",
    "/studio/../book",
    "/studio/\\evil.example",
    " /studio/money",
  ]) {
    expect(backPath(value, "/studio/bookings")).toBe("/studio/bookings");
  }
});
