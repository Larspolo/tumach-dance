import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { KEEP_MONTHS } from "@/lib/booking-privacy";
import { pageMetadata } from "@/lib/page-meta";
import styles from "./privacy.module.css";

// The privacy page (#226, epic #222): what the site keeps of a booking and of a contact message. The months come
// from `KEEP_MONTHS`, so the page and the removal of old bookings never differ.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return pageMetadata(await getTranslations({ locale, namespace: "Meta" }), "/privacy");
}

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("intro")}</p>
      <section className={styles.part}>
        <h2 className={styles.heading}>{t("bookingTitle")}</h2>
        <p>{t("bookingWhat")}</p>
        <p>{t("bookingWhy")}</p>
        <p>{t("bookingWho")}</p>
        <p>{t("keep", { months: KEEP_MONTHS })}</p>
      </section>
      <section className={styles.part}>
        <h2 className={styles.heading}>{t("contactTitle")}</h2>
        <p>{t("contactWhat")}</p>
        <p>{t("contactSpam")}</p>
      </section>
      <section className={styles.part}>
        <h2 className={styles.heading}>{t("cookiesTitle")}</h2>
        <p>{t("cookies")}</p>
      </section>
      <section className={styles.part}>
        <h2 className={styles.heading}>{t("askTitle")}</h2>
        <p>{t("ask")}</p>
        <p>
          <Link className={styles.link} href={{ pathname: "/", hash: "contact" }}>
            {t("askLink")}
          </Link>
        </p>
      </section>
    </main>
  );
}
