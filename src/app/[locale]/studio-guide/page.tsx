import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { pageMetadata } from "@/lib/page-meta";
import { GUIDE_PARTS } from "@/lib/studio-guide";
import styles from "./guide.module.css";

// The guide for Nina (#45, #776): log in, install, notifications and the daily tasks (`src/lib/studio-guide.ts`). Public: she reads it
// before she can log in. The pictures come from `e2e/guide-screenshots.spec.ts` (`public/guide/<locale>/`).

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return pageMetadata(await getTranslations({ locale, namespace: "Meta" }), "/studio-guide", locale);
}

export default async function StudioGuidePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("StudioGuide");
  const parts = GUIDE_PARTS.map((part) => ({
    id: part.id,
    title: t(part.title),
    steps: part.steps.map((step) => ({
      text: t(step.key),
      image: step.image && `/guide/${locale}/${step.image}.png`,
    })),
  }));
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("intro")}</p>
      {parts.map((part, p) => (
        <section key={part.id} id={part.id} className={styles.part}>
          <h2 className={styles.heading}>
            {p + 1}. {part.title}
          </h2>
          <ol className={styles.steps}>
            {part.steps.map((step) => (
              <li key={step.text} className={styles.step}>
                <p>{step.text}</p>
                {step.image && (
                  <Image className={styles.image} src={step.image} alt={step.text} width={390} height={844} />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
