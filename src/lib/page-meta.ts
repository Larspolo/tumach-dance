import type { Metadata } from "next";
import { siteOrigin } from "@/lib/site";

// The public pages (#238, epic #237): the paths after the language. The language links and the sitemap use them too.
export const PUBLIC_PAGES = ["", "/book", "/privacy", "/studio-guide"] as const;
export type PublicPage = (typeof PUBLIC_PAGES)[number];

/** The key of a page in the namespace `Meta` of `messages/`. */
export const META_KEY = { "": "home", "/book": "book", "/privacy": "privacy", "/studio-guide": "guide" } as const;

type MetaT = (key: `${(typeof META_KEY)[PublicPage]}.${"title" | "description"}` | "imageAlt") => string;

/**
 * The title and the description of a public page in the language of `t` (`getTranslations` of `Meta`), also for a
 * shared link (Open Graph, #242). `opengraph-image.tsx` of `[locale]` adds the picture.
 */
export function pageMetadata(t: MetaT, page: PublicPage, locale: string): Metadata {
  const key = META_KEY[page];
  const title = t(`${key}.title`);
  const description = t(`${key}.description`);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "TUMACH",
      locale,
      type: "website",
      // A page below `[locale]` replaces the `openGraph` of its parent and loses the file picture: name it here.
      images: { url: `/${locale}/opengraph-image/card`, width: 1200, height: 630, alt: t("imageAlt") },
    },
    metadataBase: new URL(siteOrigin()),
  };
}
