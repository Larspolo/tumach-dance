// The LCP budget of each page of scripts/lighthouse.mjs (owner, option C of #469).
import { expect, test } from "vitest";
// @ts-expect-error: a plain Node script with no types.
import { budgetFor } from "../scripts/lighthouse.mjs";

test("the home pages get 3.0 s and the booking pages 2.5 s with no --lcp", () => {
  expect(budgetFor("/en", { cls: 0.1 })).toEqual({ cls: 0.1, lcp: 3000 });
  expect(budgetFor("/nl", {})).toEqual({ lcp: 3000 });
  expect(budgetFor("/en/book", {})).toEqual({ lcp: 2500 });
  expect(budgetFor("/nl/book", {})).toEqual({ lcp: 2500 });
});

test("--lcp replaces the budget of each page", () => {
  expect(budgetFor("/en", { lcp: 2000 })).toEqual({ lcp: 2000 });
});
