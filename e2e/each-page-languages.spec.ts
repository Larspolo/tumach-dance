// Each page of src/app/ in each language: no console error and no text that is a message key (#71). The test finds
// the pages itself, so a page that a later ticket adds is covered with no change here.
import { readdirSync } from "node:fs";
import { type Browser, expect, test } from "@playwright/test";
import en from "../messages/en.json" with { type: "json" };
import { STUDIO_SESSION } from "./studio-session";

const LOCALES = { en: "en-GB", nl: "nl-NL" } as const;
// A sample path for each page with a dynamic segment other than [locale]. A dynamic page not here fails the test.
const SAMPLES: Record<string, string> = {};

// A missing text shows as `Group.key`. Match on the group: a key that is missing in all three files is not in en.json.
const groups = new Set(Object.keys(en));

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

async function check(browser: Browser, locale: string, path: string, session: boolean) {
  const context = await browser.newContext({ locale, ...(session ? { storageState: STUDIO_SESSION } : {}) });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${m.text()} ${m.location().url}`);
  });
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const text = (await page.locator("body").textContent()) ?? "";
  const shown = (text.match(/\b[A-Z][A-Za-z]+\.[a-z][A-Za-z]+\b/g) ?? []).filter((m) => groups.has(m.split(".")[0]));
  await context.close();
  expect(errors, `console errors on ${path} (${locale})`).toEqual([]);
  expect(shown, `message keys on ${path} (${locale})`).toEqual([]);
}

test("each page in each language shows no missing text", async ({ browser }) => {
  const pages = pagePaths();
  expect(pages.length).toBeGreaterThan(0);
  // Each page and language opens a new context: the time grows with each new page (#173).
  test.setTimeout(pages.length * Object.keys(LOCALES).length * 3_000);
  for (const { file, path } of pages) {
    const local = path.replace(/^\/\[locale\]/, "");
    let sample = local;
    if (/\[/.test(local)) {
      sample = SAMPLES[file];
      expect(sample, `no sample path for the dynamic page ${file}`).toBeDefined();
    }
    for (const [lang, locale] of Object.entries(LOCALES)) {
      if (path.startsWith("/[locale]")) await check(browser, locale, `/${lang}${sample}`, false);
      else await check(browser, locale, sample, sample !== "/studio/login");
    }
  }
});
