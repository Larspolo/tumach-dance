import { Fraunces, Space_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { Footer } from "@/components/Footer";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Nav } from "@/components/Nav";
import TestBanner from "@/components/TestBanner";
import { routing } from "@/i18n/routing";
import "../globals.css";

// next/font serves the fonts from the site itself: no request to Google from the browser (P3).
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});
const spaceMono = Space_Mono({
  subsets: ["latin", "latin-ext"],
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
  return (
    <html lang={locale} className={`${fraunces.variable} ${spaceMono.variable}`}>
      <body>
        <TestBanner />
        <NextIntlClientProvider>
          <Nav />
          <LanguageSwitcher />
          {children}
          <Footer />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
