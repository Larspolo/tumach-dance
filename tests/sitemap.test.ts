// The sitemap (#240): each public page in each language, with the language links of its page.
import { expect, test } from "vitest";
import sitemap from "../src/app/sitemap";

test("sitemap() lists 4 pages in 2 languages with the address of siteOrigin()", () => {
  const before = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://tumach.dance/api/auth";
  try {
    const entries = sitemap();
    expect(entries).toHaveLength(8);
    const urls = entries.map((e) => e.url);
    for (const url of urls) expect(url.startsWith("https://tumach.dance/")).toBe(true);
    expect(urls).toContain("https://tumach.dance/nl/book");
    const nlBook = entries.find((e) => e.url === "https://tumach.dance/nl/book");
    expect(nlBook?.alternates?.languages).toEqual({
      en: "https://tumach.dance/en/book",
      nl: "https://tumach.dance/nl/book",
    });
  } finally {
    process.env.BETTER_AUTH_URL = before;
  }
});
