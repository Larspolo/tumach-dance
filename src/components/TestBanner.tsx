import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { siteEnv } from "@/lib/site";

// A thin bar at the top of each page of the preview, so that nobody takes it for the real site.
export default async function TestBanner() {
  // Render at request time: SITE_ENV is set on the server, not at build time.
  await connection();
  if (siteEnv() === "live") return null;
  const t = await getTranslations("TestBanner");
  return (
    <div
      role="status"
      data-testid="test-banner"
      style={{
        background: "#4a443c",
        color: "#fbf8f1",
        fontFamily: '"Space Mono", monospace',
        fontSize: "0.75rem",
        letterSpacing: "0.1em",
        padding: "0.4rem 1rem",
        textAlign: "center",
      }}
    >
      {t("text")}
    </div>
  );
}
