import { Fraunces, Space_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import TestBanner from "@/components/TestBanner";
import { pickMessages } from "@/i18n/client-messages";
import { routing } from "@/i18n/routing";
import "../globals.css";

// next/font serves the fonts from the site itself: no request to Google from the browser (P3).
// `subsets` is only the preload: the texts of `messages/` are all in `latin`, and a name with another letter still gets
// its font file when the page needs it (#453: the preload of `latin-ext` made the first text 1 s slower on a phone).
const fraunces = Fraunces({
  subsets: ["latin"],
  // No `opsz` axis (owner, option C of #469): the font files are about half as large, so the first text comes sooner.
  // No preload: a page gets only the faces that it shows (the book page has no italic: 82 KB less, #453).
  preload: false,
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = pickMessages(await getMessages());
  return (
    <html lang={locale} className={`${fraunces.variable} ${spaceMono.variable}`}>
      <body>
        <TestBanner />
        <NextIntlClientProvider messages={messages}>
          <Nav />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
