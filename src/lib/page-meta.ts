import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";

// The public pages (#238, epic #237): the paths after the language. The language links and the sitemap use them too.
export const PUBLIC_PAGES = ["", "/book", "/privacy", "/studio-guide"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** The key of a page in the namespace `Meta` of `messages/`. */
export const META_KEY = { "": "home", "/book": "book", "/privacy": "privacy", "/studio-guide": "guide" } as const;

type MetaT = (key: `${(typeof META_KEY)[PublicPage]}.${"title" | "description"}`) => string;

/** The title and the description of a public page in the language of `t` (`getTranslations` of `Meta`). */
export function pageMetadata(t: MetaT, page: PublicPage): Metadata {
  const key = META_KEY[page];
  return {
    title: t(`${key}.title`),
    description: t(`${key}.description`),
    metadataBase: new URL(siteOrigin()),
  };
}
