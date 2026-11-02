// Each public page and each page of the studio app in English and Dutch: no serious or critical barrier that axe finds (#343). The test finds the
// pages itself, so a public page that a later ticket adds is covered with no change here.
import { readdirSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
import { type Browser, expect, test } from "@playwright/test";
import { STUDIO_SESSION } from "./studio-session";

const LOCALES = { en: "en-GB", nl: "nl-NL" } as const;
// A sample path for each page with a dynamic segment other than [locale]. A dynamic page not here fails the test.
// The catch-all of an unknown address (#359) shows the not-found page.
const SAMPLES: Record<string, string> = { "src/app/[locale]/[...rest]/page.tsx": "/no-such-page" };

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

// Open one page and give its serious and critical axe violations.
async function check(browser: Browser, locale: string, path: string, session: boolean): Promise<string[]> {
  const context = await browser.newContext({
    locale,
    viewport: { width: 390, height: 844 },
    ...(session ? { storageState: STUDIO_SESSION } : {}),
  });
  const page = await context.newPage();
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  // A lost session sends a studio page to the login page: then the test would check the login page only.
  if (session) expect(new URL(page.url()).pathname, `${path} redirected`).not.toBe("/studio/login");
  // The top bar draws white text with `mix-blend-mode: difference`: axe cannot compute that contrast (it sees white
  // on cream, 1.1), so the contrast pass leaves out the <nav>. All other rules check it.
  const all = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  const contrast = await new AxeBuilder({ page }).withRules(["color-contrast"]).exclude("nav").analyze();
  await context.close();
  return [...all.violations, ...contrast.violations]
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${path} (${locale}): ${v.id} (${v.impact}) ${v.nodes.map((n) => `${n.target.join(" ")} [${n.any.map((c) => c.message).join(" ")}]`).join(", ")}`,
    );
}

function sampleOf(file: string, path: string): string {
  if (!/\[/.test(path)) return path;
  const sample = SAMPLES[file];
  expect(sample, `no sample path for the dynamic page ${file}`).toBeDefined();
  return sample;
}

test("each public page has no serious accessibility barrier", async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "the phone project only");
  const pages = pagePaths().filter((p) => p.path.startsWith("/[locale]"));
  expect(pages.length).toBeGreaterThan(0);
  test.setTimeout(pages.length * Object.keys(LOCALES).length * 6_000);
  const found: string[] = [];
  for (const { file, path } of pages) {
    const sample = sampleOf(file, path.replace(/^\/\[locale\]/, ""));
    for (const [lang, locale] of Object.entries(LOCALES))
      found.push(...(await check(browser, locale, `/${lang}${sample}`, false)));
  }
  expect(found).toEqual([]);
});

// Nina's studio app (#346): with a session, the login page without one. The language comes from the browser.
test("each page of the studio app has no serious accessibility barrier", async ({ browser }, info) => {
  test.skip(info.project.name !== "phone", "the phone project only");
  const pages = pagePaths().filter((p) => p.path.startsWith("/studio"));
  expect(pages.length).toBeGreaterThan(0);
  test.setTimeout(pages.length * Object.keys(LOCALES).length * 6_000);
  const found: string[] = [];
  for (const { file, path } of pages) {
    const sample = sampleOf(file, path);
    for (const locale of Object.values(LOCALES))
      found.push(...(await check(browser, locale, sample, sample !== "/studio/login")));
  }
  expect(found).toEqual([]);
});
