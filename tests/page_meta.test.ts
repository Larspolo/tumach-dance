// The title and the description of each public page (#238): each key of `Meta` in the 3 languages, and `metadataBase`.
import { createTranslator } from "next-intl";
import { expect, test } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import sl from "../messages/sl.json";
import { PUBLIC_PAGES, pageMetadata } from "../src/lib/page-meta";

const all = { en, nl, sl };

test("each key of Meta is in English, Dutch and Slovenian", () => {
  const keys = (m: typeof en) => Object.entries(m.Meta).flatMap(([k, v]) => Object.keys(v).map((f) => `${k}.${f}`));
  expect(keys(nl as typeof en).sort()).toEqual(keys(en).sort());
  expect(keys(sl as typeof en).sort()).toEqual(keys(en).sort());
});

test.each(Object.entries(all))("%s: each public page has a title and a description", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "Meta" });
  for (const page of PUBLIC_PAGES) {
    const meta = pageMetadata(t, page, locale);
    expect(meta.title).toBeTruthy();
    expect(meta.description).toBeTruthy();
  }
});

test("pageMetadata gives a metadataBase of siteOrigin()", () => {
  const before = process.env.BETTER_AUTH_URL;
  process.env.BETTER_AUTH_URL = "https://tumach.dance/api/auth";
  try {
    const t = createTranslator({ locale: "en", messages: en, namespace: "Meta" });
    expect(pageMetadata(t, "/book", "en").metadataBase?.toString()).toBe("https://tumach.dance/");
  } finally {
    process.env.BETTER_AUTH_URL = before;
  }
});
