import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { About } from "@/components/home/About";
import { Contact } from "@/components/home/Contact";
import { Hero } from "@/components/home/Hero";
import styles from "@/components/home/Home.module.css";
import { Offers } from "@/components/home/Offers";
import { Photos } from "@/components/home/Photos";
import { StudioJsonLd } from "@/components/home/StudioJsonLd";
import { getDb } from "@/db";
import { listOffers } from "@/db/offers";
import { listPhotos } from "@/db/photos";
import { routing } from "@/i18n/routing";
import { closedNotices } from "@/lib/closed-notice";
import { getHoursRule } from "@/lib/hours-store";
import { getNewsNote, shownNewsNote } from "@/lib/news-note";
import { pageMetadata } from "@/lib/page-meta";

// The offers, the closed periods and the photos come from the database at each request, so a change of Nina shows at the next load (#98, #174).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return pageMetadata(await getTranslations({ locale, namespace: "Meta" }), "", locale);
}

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const db = getDb();
  const offers = listOffers(db, { visibleOnly: true });
  const photos = listPhotos(db);
  const rule = getHoursRule(db);
  const closed = closedNotices(rule, Date.now());
  // Read at each request with the time of now, as the closed notice: a note ends at its end date with no deploy.
  const note = getNewsNote(db);
  const news = note === null ? null : shownNewsNote(note, Date.now());
  return (
    <main className={styles.main}>
      <StudioJsonLd locale={locale} />
      <Hero news={news} />
      <About />
      <Offers offers={offers} locale={locale} closed={closed} />
      <Photos photos={photos} />
      <Contact />
    </main>
  );
}
