import { expect, test } from "vitest";
import { siteEnv } from "../src/lib/site";

test("siteEnv gives live only for SITE_ENV=live", () => {
  expect(siteEnv("live")).toBe("live");
});

test.each([["preview"], [""], [undefined], ["LIVE"], ["production"]])("siteEnv(%j) gives preview", (value) => {
  expect(siteEnv(value)).toBe("preview");
});
