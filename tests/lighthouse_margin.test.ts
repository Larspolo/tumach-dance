// The margin of the speed step in CI (#448): `--margin ms` adds to the LCP budget of each page.
import { expect, test } from "vitest";
// @ts-expect-error: a plain Node script with no types.
import { budgetFor, budgetLine, formatLine, parseArgs, summarize } from "../scripts/lighthouse.mjs";

const result = (lcp: number) => ({
  audits: {
    "largest-contentful-paint": { numericValue: lcp },
    "cumulative-layout-shift": { numericValue: 0 },
    "total-blocking-time": { numericValue: 0 },
    "total-byte-weight": { numericValue: 0 },
  },
});

test("--margin adds to the budget of each page and to --lcp", () => {
  expect(parseArgs(["--margin", "1000"]).margin).toBe(1000);
  expect(parseArgs([]).margin).toBe(0);
  expect(budgetFor("/en", { cls: 0.1 }, 1000)).toEqual({ cls: 0.1, lcp: 4000 });
  expect(budgetFor("/nl/book", {}, 1000)).toEqual({ lcp: 3500 });
  expect(budgetFor("/en", { lcp: 2000 }, 500)).toEqual({ lcp: 2500 });
  expect(budgetFor("/other", { cls: 0.1 }, 1000)).toEqual({ cls: 0.1 });
});

test("a median under the budget plus the margin passes, a slow page fails", () => {
  const budget = budgetFor("/en", {}, 1000);
  expect(summarize([result(3200), result(3300), result(2400)], budget).over).toEqual([]);
  expect(summarize([result(5600), result(5800), result(5500)], budget).over).toEqual(["lcp"]);
});

test("the output names the budget with the margin and the LCP of each run", () => {
  expect(budgetLine(parseArgs(["--runs", "5", "--margin", "1000"]))).toBe(
    "LCP budget: /en 4.00 s, /nl 4.00 s, /en/book 3.50 s, /nl/book 3.50 s (with a margin of 1.00 s); medians of 5 runs",
  );
  expect(budgetLine(parseArgs([]))).toBe(
    "LCP budget: /en 3.00 s, /nl 3.00 s, /en/book 2.50 s, /nl/book 2.50 s; medians of 3 runs",
  );
  const s = summarize([result(2430), result(3190), result(2550)], budgetFor("/en", {}));
  expect(formatLine("/en", s)).toContain("(runs 2.43 3.19 2.55)");
});
