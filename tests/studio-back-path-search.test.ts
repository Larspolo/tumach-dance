// The back path of a search (#664): an encoded query is a studio path, an encoded dot segment is not.
import { expect, test } from "vitest";
import { backPath } from "../src/lib/studio-paths";

test("backPath keeps the address of a search with an encoded query", () => {
  expect(backPath("/studio/search?q=anna%40mail", "/studio/week")).toBe("/studio/search?q=anna%40mail");
});

test("backPath refuses an encoded dot segment", () => {
  expect(backPath("/studio/%2e%2e/x", "/studio/week")).toBe("/studio/week");
  expect(backPath("/studio/%2E./x", "/studio/week")).toBe("/studio/week");
});
