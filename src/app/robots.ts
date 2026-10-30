import type { MetadataRoute } from "next";
import { siteEnv, siteOrigin } from "../lib/site";
import { robotsRules } from "../lib/site-robots";

// Read at run time: one image serves both sites (#7), so a file made at build time would be wrong on one of them.
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return robotsRules(siteEnv(), siteOrigin());
}
