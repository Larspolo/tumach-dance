// The structured data of the studio for search engines (#452): a schema.org `DanceSchool` with a `sameAs` link to
// each account of the studio (`studioAccounts()`, #451). No address here: it waits for #342 (`site:where`).

import { siteOrigin } from "./site";
import { studioAccounts } from "./studio-accounts";

/** The JSON-LD object of the home page in `locale`; no account: no `sameAs`. */
export function studioJsonLd(locale: string, origin = siteOrigin(), env: NodeJS.ProcessEnv = process.env) {
  const sameAs = studioAccounts(env).map((account) => account.href);
  return {
    "@context": "https://schema.org",
    "@type": "DanceSchool",
    name: "TUMACH",
    url: `${origin}/${locale}`,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

/** The JSON text for a `<script type="application/ld+json">`: `<` is escaped, so no tag can close the script. */
export function jsonLdText(data: object): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
