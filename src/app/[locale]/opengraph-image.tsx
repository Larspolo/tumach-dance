import { ImageResponse } from "next/og";
import { createTranslator } from "next-intl";
import { routing } from "@/i18n/routing";

// The picture of a shared link of each public page (#242): a drawn card in the look of the hero of the site (P2), so it
// is there also on a fresh preview with no photos. The default font of `ImageResponse`: no font file in the repository.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#f4efe6";
const INK = "#141210";
const RUST = "#a8503a";

// The messages of the language with no request: `getTranslations` reads the headers, and Next.js renders this at build time.
async function messagesOf(locale: string) {
  const known = (routing.locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
  return { locale: known, messages: (await import(`../../../messages/${known}.json`)).default };
}

export async function generateImageMetadata({ params }: { params: Promise<{ locale: string }> | { locale: string } }) {
  const { locale } = await params;
  const t = createTranslator({ ...(await messagesOf(locale)), namespace: "Meta" });
  return [{ id: "card", size, contentType, alt: t("imageAlt") }];
}

export default async function Image({ params }: { params: Promise<{ locale: string }> | { locale: string } }) {
  const { locale } = await params;
  const t = createTranslator({ ...(await messagesOf(locale)), namespace: "HomePage" });
  return new ImageResponse(
    <div
      style={{ width: "100%", height: "100%", display: "flex", background: PAPER, borderBottom: `2px solid ${INK}` }}
    >
      <div
        style={{ flex: 1.05, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 80px" }}
      >
        <div style={{ width: 76, height: 2, background: RUST, marginBottom: 40 }} />
        <div style={{ fontSize: 150, color: INK, letterSpacing: -4, lineHeight: 1 }}>{t("title")}</div>
      </div>
      <div style={{ flex: 0.95, display: "flex", background: INK }}>
        <div style={{ margin: "auto", width: 180, height: 180, borderRadius: 90, background: RUST }} />
      </div>
    </div>,
    size,
  );
}
