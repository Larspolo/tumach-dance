// A first test, so that Vitest finds one (no test file: exit 1, CI red). The tests of the site replace it.
import { expect, test } from "vitest";

test("vitest runs TypeScript", () => {
  const add = (a: number, b: number): number => a + b;
  expect(add(1, 2)).toBe(3);
});
