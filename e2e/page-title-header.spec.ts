// The fixed header (`src/components/Nav.tsx`) covers no title (#211): the h1 of the book page and of the cancel page is below the nav, on a
// phone and on a laptop. The cancel page with an unknown token still shows its title.
import { expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };

for (const size of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  for (const path of ["/en/book", "/en/booking/cancel?token=unknown"]) {
    test(`at ${size.width} px the header does not cover the title of ${path}`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto(path);
      const nav = await page.getByRole("navigation", { name: en.Nav.label }).locator("..").boundingBox();
      const title = await page.getByRole("heading", { level: 1 }).boundingBox();
      expect(nav).not.toBeNull();
      expect(title).not.toBeNull();
      if (!nav || !title) return;
      expect(title.y, `title top ${title.y}, nav bottom ${nav.y + nav.height}`).toBeGreaterThanOrEqual(
        nav.y + nav.height,
      );
      await page.screenshot({ path: `out/screenshots/title-${path.split("/")[2].split("?")[0]}-${size.width}.png` });
    });
  }
}
