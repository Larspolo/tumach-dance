import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import { About } from "@/components/home/About";
import { Classes } from "@/components/home/Classes";
import { Contact } from "@/components/home/Contact";
import { Hero } from "@/components/home/Hero";
import styles from "@/components/home/Home.module.css";
import { Schedule } from "@/components/home/Schedule";

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  return (
    <main className={styles.main}>
      <Hero />
      <About />
      <Classes />
      <Schedule />
      <Contact />
    </main>
  );
}
