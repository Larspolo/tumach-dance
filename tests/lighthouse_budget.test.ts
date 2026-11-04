// The median and budget logic of scripts/lighthouse.mjs (#447), with Lighthouse JSON results and no browser.
import { expect, test } from "vitest";
// @ts-expect-error: a plain Node script with no types.
import { formatLine, median, opportunities, parseArgs, summarize } from "../scripts/lighthouse.mjs";

function result(lcp: number, cls: number, tbt: number, bytes: number, extra: Record<string, unknown> = {}) {
  return {
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "cumulative-layout-shift": { numericValue: cls },
      "total-blocking-time": { numericValue: tbt },
      "total-byte-weight": { numericValue: bytes },
      ...extra,
    },
  };
}

test("median of an odd and an even count", () => {
  expect(median([3, 1, 2])).toBe(2);
  expect(median([4, 1, 3, 2])).toBe(2.5);
  expect(Number.isNaN(median([]))).toBe(true);
});

test("summarize gives the medians and no budget problem under the budget", () => {
  const s = summarize([result(2000, 0, 100, 102400), result(3000, 0.2, 50, 204800), result(1000, 0.01, 300, 51200)], {
    lcp: 2500,
    cls: 0.1,
  });
  expect(s).toEqual({ lcp: 2000, ttfb: Number.NaN, cls: 0.01, tbt: 100, kb: 100, runs: [2000, 3000, 1000], over: [] });
});

test("summarize names each budget that the median is over", () => {
  const s = summarize([result(3000, 0.2, 700, 2048000)], { lcp: 2500, cls: 0.1, tbt: 600, kb: 1000 });
  expect(s.over).toEqual(["lcp", "cls", "tbt", "kb"]);
  expect(formatLine("/en", s)).toContain("OVER: lcp, cls, tbt, kb");
});

test("a missing metric is over the budget", () => {
  expect(summarize([{ audits: {} }], { lcp: 2500 }).over).toEqual(["lcp"]);
});

test("opportunities: the largest savings first, at most 3", () => {
  const op = (id: string, ms: number) => ({ id, title: id, details: { type: "opportunity", overallSavingsMs: ms } });
  const r = result(1, 0, 0, 0, { a: op("a", 100), b: op("b", 900), c: op("c", 0), d: op("d", 300), e: op("e", 200) });
  expect(opportunities(r).map((o: { id: string }) => o.id)).toEqual(["b", "d", "e"]);
});

test("parseArgs reads the runs, the url and the budgets", () => {
  expect(parseArgs(["--runs", "1", "--lcp", "2500", "--cls", "0.1", "--url", "http://x"])).toEqual({
    runs: 1,
    url: "http://x",
    budget: { lcp: 2500, cls: 0.1 },
    margin: 0,
    json: undefined,
  });
  expect(() => parseArgs(["--foo", "1"])).toThrow();
});
