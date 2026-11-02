import { headers } from "next/headers";
import { nonceFrom } from "@/lib/csp";
import { jsonLdText, studioJsonLd } from "@/lib/home-jsonld";

/** The structured data of the studio for search engines (#452), with the nonce of the page's policy (#491). */
export async function StudioJsonLd({ locale }: { locale: string }) {
  const nonce = nonceFrom((await headers()).get("content-security-policy"));
  const json = jsonLdText(studioJsonLd(locale));
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: the JSON-LD of the Next.js docs; `jsonLdText` escapes `<`, and the data is ours (the settings). */}
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
    </>
  );
}
