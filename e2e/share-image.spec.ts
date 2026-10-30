// A shared link of a page shows a picture of the studio, the title and the text (#242).
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };
import sl from "../messages/sl.json" with { type: "json" };
import { META_KEY } from "../src/lib/page-meta";

const all = { en, nl, sl };

for (const [locale, messages] of Object.entries(all)) {
  for (const page of ["", "/book"] as const) {
    test(`${locale}${page || "/"}: the Open Graph tags and the picture`, async ({ page: tab, request }) => {
      const meta = messages.Meta[META_KEY[page]];
      await tab.goto(`/${locale}${page}`);
      const og = (name: string) => tab.locator(`meta[property="og:${name}"]`);
      await expect(og("title")).toHaveAttribute("content", meta.title);
      await expect(og("description")).toHaveAttribute("content", meta.description);
      await expect(og("locale")).toHaveAttribute("content", locale);
      await expect(og("image:alt")).toHaveAttribute("content", messages.Meta.imageAlt);
      const image = await og("image").getAttribute("content");
      expect(image).toMatch(/^https?:\/\//);
      const url = new URL(image ?? "");
      const answer = await request.get(url.pathname + url.search);
      expect(answer.status()).toBe(200);
      expect(answer.headers()["content-type"]).toBe("image/png");
      const { width, height, format } = await sharp(await answer.body()).metadata();
      expect({ width, height, format }).toEqual({ width: 1200, height: 630, format: "png" });
    });
  }
}
