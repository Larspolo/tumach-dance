import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { About } from "@/components/home/About";
import { Classes } from "@/components/home/Classes";
import { Contact } from "@/components/home/Contact";
import { Hero } from "@/components/home/Hero";
import styles from "@/components/home/Home.module.css";
import { Schedule } from "@/components/home/Schedule";
import { getDb } from "@/db";
import { listClasses, listClassTimes } from "@/db/classes";

// The classes come from the database at each request, so a change of Nina shows at the next load (#98).
export const dynamic = "force-dynamic";

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const db = getDb();
  const classes = listClasses(db, { visibleOnly: true });
  const times = listClassTimes(db, { visibleOnly: true });
  return (
    <main className={styles.main}>
      <Hero />
      <About />
      <Classes classes={classes} locale={locale} />
      <Schedule classes={classes} times={times} locale={locale} />
      <Contact />
    </main>
  );
}
