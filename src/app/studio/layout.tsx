import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "TUMACH studio",
  manifest: "/manifest.webmanifest",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "TUMACH studio" },
};

export const viewport: Viewport = { themeColor: "#141210" };

// The studio app has no locale in its URL; it uses the default locale until Nina can choose one.
export default function StudioLayout({ children }: { children: ReactNode }) {
  setRequestLocale(routing.defaultLocale);
  return (
    <html lang={routing.defaultLocale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
