import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { About } from "@/components/home/About";
import { Classes } from "@/components/home/Classes";
import { Contact } from "@/components/home/Contact";
import { Hero } from "@/components/home/Hero";
import styles from "@/components/home/Home.module.css";
import { Offers } from "@/components/home/Offers";
import { Photos } from "@/components/home/Photos";
import { Schedule } from "@/components/home/Schedule";
import { getDb } from "@/db";
import { listClasses, listClassTimes } from "@/db/classes";
import { listOffers } from "@/db/offers";
import { listPhotos } from "@/db/photos";
import { routing } from "@/i18n/routing";
import { classDaysOff } from "@/lib/class-days-off";
import { closedNotices } from "@/lib/closed-notice";
import { getHoursRule } from "@/lib/hours-store";
import { pageMetadata } from "@/lib/page-meta";

// The classes and the photos come from the database at each request, so a change of Nina shows at the next load (#98, #174).
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
  const classes = listClasses(db, { visibleOnly: true });
  const times = listClassTimes(db, { visibleOnly: true });
  const offers = listOffers(db, { visibleOnly: true });
  const photos = listPhotos(db);
  const rule = getHoursRule(db);
  const closed = closedNotices(rule, Date.now());
  const daysOff = classDaysOff(rule, times, Date.now());
  return (
    <main className={styles.main}>
      <Hero />
      <About />
      <Offers offers={offers} locale={locale} />
      <Photos photos={photos} />
      <Classes classes={classes} locale={locale} />
      <Schedule classes={classes} times={times} locale={locale} closed={closed} daysOff={daysOff} />
      <Contact />
    </main>
  );
}
