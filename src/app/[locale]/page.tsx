import { getTranslations, setRequestLocale } from "next-intl/server";
import { use } from "react";
import { About } from "@/components/home/About";
import { Classes } from "@/components/home/Classes";
import { Contact } from "@/components/home/Contact";
import { Hero } from "@/components/home/Hero";
import styles from "@/components/home/Home.module.css";
import { Photos } from "@/components/home/Photos";
import { Schedule } from "@/components/home/Schedule";
import { getDb } from "@/db";
import { listClasses, listClassTimes } from "@/db/classes";
import { listPhotos } from "@/db/photos";
import { pageMetadata } from "@/lib/page-meta";

// The classes and the photos come from the database at each request, so a change of Nina shows at the next load (#98, #174).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(await getTranslations({ locale, namespace: "Meta" }), "");
}

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const db = getDb();
  const classes = listClasses(db, { visibleOnly: true });
  const times = listClassTimes(db, { visibleOnly: true });
  const photos = listPhotos(db);
  return (
    <main className={styles.main}>
      <Hero />
      <About />
      <Photos photos={photos} />
      <Classes classes={classes} locale={locale} />
      <Schedule classes={classes} times={times} locale={locale} />
      <Contact />
    </main>
  );
}
