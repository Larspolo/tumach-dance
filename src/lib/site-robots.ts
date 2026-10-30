import type { MetadataRoute } from "next";
import { routing } from "../i18n/routing";
import type { SiteEnv } from "./site";

// The preview shows test data, so no search engine may list it (#241). The live site lets them in,
// but not the studio app, the API or the cancel link of a booking.
export function robotsRules(env: SiteEnv, origin: string): MetadataRoute.Robots {
  if (env === "preview") return { rules: { userAgent: "*", disallow: "/" } };
  const cancelPaths = routing.locales.map((locale) => `/${locale}/booking/cancel`);
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/studio", "/api", ...cancelPaths] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
