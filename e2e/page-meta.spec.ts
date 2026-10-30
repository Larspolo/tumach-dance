// Each public page has a title and a description in its language (#238).
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import sl from "../messages/sl.json" with { type: "json" };
import { META_KEY, PUBLIC_PAGES } from "../src/lib/page-meta";

const all = { en, nl, sl };

for (const [locale, messages] of Object.entries(all)) {
  for (const page of PUBLIC_PAGES) {
    test(`${locale}${page || "/"}: the title and the description`, async ({ page: tab }) => {
      const meta = messages.Meta[META_KEY[page]];
      await tab.goto(`/${locale}${page}`);
      await expect(tab).toHaveTitle(meta.title);
      await expect(tab.locator('meta[name="description"]')).toHaveAttribute("content", meta.description);
    });
  }
}
