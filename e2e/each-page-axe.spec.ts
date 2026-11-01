// Each public page in English and Dutch: no serious or critical barrier that axe finds (#343). The test finds the
// pages itself, so a public page that a later ticket adds is covered with no change here.
import { readdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const LOCALES = { en: "en-GB", nl: "nl-NL" } as const;
// A sample path for each page with a dynamic segment other than [locale]. A dynamic page not here fails the test.
const SAMPLES: Record<string, string> = {};

function pagePaths(): { file: string; path: string }[] {
  return (readdirSync("src/app", { recursive: true }) as string[])
    .map((f) => f.replaceAll("\\", "/"))
    .filter((f) => f === "page.tsx" || f.endsWith("/page.tsx"))
    .map((f) => {
      const route = `/${f.replace(/\/?page\.tsx$/, "")}`
        .split("/")
        .filter((s) => !/^\(.*\)$/.test(s))
        .join("/");
      return { file: `src/app/${f}`, path: route === "" ? "/" : route.replace(/\/$/, "") || "/" };
    });
}

test("each public page has no serious accessibility barrier", async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "the phone project only");
  const pages = pagePaths().filter((p) => p.path.startsWith("/[locale]"));
  expect(pages.length).toBeGreaterThan(0);
  test.setTimeout(pages.length * Object.keys(LOCALES).length * 6_000);
  const found: string[] = [];
  for (const { file, path } of pages) {
    let sample = path.replace(/^\/\[locale\]/, "");
    if (/\[/.test(sample)) {
      sample = SAMPLES[file];
      expect(sample, `no sample path for the dynamic page ${file}`).toBeDefined();
    }
    for (const [lang, locale] of Object.entries(LOCALES)) {
      const context = await browser.newContext({ locale, viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      await page.goto(`/${lang}${sample}`);
      await page.waitForLoadState("networkidle");
      // The top bar draws white text with `mix-blend-mode: difference`: axe cannot compute that contrast (it sees white
      // on cream, 1.1), so the contrast pass leaves out the <nav>. All other rules check it.
      const all = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
      const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).exclude("nav").analyze();
      const violations = [...all.violations, ...contrast.violations];
      for (const v of violations.filter((v) => v.impact === "serious" || v.impact === "critical")) {
        found.push(
          `/${lang}${sample}: ${v.id} (${v.impact}) ${v.nodes.map((n) => `${n.target.join(" ")} [${n.any.map((c) => c.message).join(" ")}]`).join(", ")}`,
        );
      }
      await context.close();
    }
  }
  expect(found).toEqual([]);
});
