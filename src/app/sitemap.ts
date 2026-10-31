import type { MetadataRoute } from "next";
import { routing } from "../i18n/routing";
import { PUBLIC_PAGES } from "../lib/page-meta";
import { siteOrigin } from "../lib/site";

// Read at run time: one image serves both sites (#7), so a file made at build time would name localhost on the live site.
export const dynamic = "force-dynamic";

// Each public page in each language, with the links to the same page in the other languages (#240, epic #237).
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  return routing.locales.flatMap((locale) =>
    PUBLIC_PAGES.map((page) => ({
      url: `${origin}/${locale}${page}`,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((other) => [other, `${origin}/${other}${page}`])),
      },
    })),
  );
}
