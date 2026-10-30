import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { setStudioLocale } from "@/i18n/studio";
import styles from "./studio.module.css";

export const metadata: Metadata = {
  title: "TUMACH studio",
  manifest: "/manifest.webmanifest",
  // An own `icon` too: the `icons` field replaces the icon of `src/app/icon.png`, and the browser asks `/favicon.ico` (404, #71).
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "TUMACH studio" },
};

export const viewport: Viewport = { themeColor: "#141210" };

// The studio app of Nina: its own root layout, with no locale in the address (#19: the language of `studio.ts`).
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const locale = await setStudioLocale();
  return (
    <html lang={locale}>
      <body className={styles.body}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
