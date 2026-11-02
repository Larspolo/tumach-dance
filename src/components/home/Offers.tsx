import { useTranslations } from "next-intl";
import type { Offer } from "@/db/offers";
import { Link } from "@/i18n/navigation";
import { offerLabel } from "@/lib/offer-label";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The visible offers with their length and price (#384); each opens the booking page with that offer. No section with no offer.
export function Offers({ offers, locale }: { offers: Offer[]; locale: string }) {
  const t = useTranslations("HomePage.offers");
  const book = useTranslations("Book");
  if (offers.length === 0) return null;
  return (
    <section id="offers" aria-labelledby="offers-title" className={styles.section}>
      <SectionHead id="offers" title={t("title")} label={t("label")} />
      <div className={styles.classGrid}>
        {offers.map((offer) => {
          const label = offerLabel(book, locale, offer);
          return (
            <article key={offer.id} className={styles.card}>
              <h3>{label}</h3>
              <Link
                href={{ pathname: "/book", query: { offer: String(offer.id) } }}
                aria-label={`${t("book")}: ${label}`}
              >
                {t("book")}
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
