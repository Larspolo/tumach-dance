import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { siteOrigin } from "@/lib/site";

// The public pages (#238, epic #237): the paths after the language. The language links and the sitemap use them too.
export const PUBLIC_PAGES = ["", "/book", "/privacy", "/studio-guide"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** The key of a page in the namespace `Meta` of `messages/`. */
export const META_KEY = { "": "home", "/book": "book", "/privacy": "privacy", "/studio-guide": "guide" } as const;

type MetaT = (key: `${(typeof META_KEY)[PublicPage]}.${"title" | "description"}`) => string;

/**
 * The title, the description and the addresses of a public page in the language `locale` (`t` is `getTranslations`
 * of `Meta` in that language). The addresses of the same page in each language (#239) let search engines show a
 * dancer the page in their language; the address with no language (`x-default`) goes to the language of the browser.
 */
export function pageMetadata(t: MetaT, page: PublicPage, locale: string): Metadata {
  const key = META_KEY[page];
  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
    metadataBase: new URL(siteOrigin()),
    alternates: {
      canonical: `/${locale}${page}`,
      languages: {
        ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${page}`])),
        "x-default": page || "/",
      },
    },
  };
}
