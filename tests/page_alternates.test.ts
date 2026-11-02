// The addresses of each public page in each language (#239): canonical, the 3 languages and x-default.
import { createTranslator } from "next-intl";
import { expect, test } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import { PUBLIC_PAGES, pageMetadata } from "../src/lib/page-meta";

const all = { en, nl };

test.each(Object.entries(all))("%s: each public page gives its own canonical address", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "Meta" });
  for (const page of PUBLIC_PAGES) {
    expect(pageMetadata(t, page, locale).alternates?.canonical).toBe(`/${locale}${page}`);
  }
});

test.each(Object.entries(all))("%s: each public page lists the 3 languages and x-default", (locale, messages) => {
  const t = createTranslator({ locale, messages, namespace: "Meta" });
  for (const page of PUBLIC_PAGES) {
    expect(pageMetadata(t, page, locale).alternates?.languages).toEqual({
      en: `/en${page}`,
      nl: `/nl${page}`,
      "x-default": page || "/",
    });
  }
});
