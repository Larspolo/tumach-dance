import { useTranslations } from "next-intl";
import type { Offer } from "@/db/offers";
import { Link } from "@/i18n/navigation";
import { type ClosedNotice, noticeDate } from "@/lib/closed-notice";
import { offerLabel } from "@/lib/offer-label";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The visible offers with their length and price (#384); each opens the booking page with that offer. No section with no offer
// and no closed period.
// Above them a line for each coming closed period of the studio (#530, `closedNotices`), near the "Book" buttons (#792).
export function Offers({ offers, locale, closed = [] }: { offers: Offer[]; locale: string; closed?: ClosedNotice[] }) {
  const t = useTranslations("HomePage.offers");
  const book = useTranslations("Book");
  if (offers.length === 0 && closed.length === 0) return null;
  return (
    <section id="offers" aria-labelledby="offers-title" className={styles.section}>
      <SectionHead id="offers" title={t("title")} label={t("label")} />
      {closed.map(({ from, to }) => (
        <p key={from} className={styles.closed}>
          {from === to
            ? t("closedDay", { date: noticeDate(from) })
            : t("closedPeriod", { from: noticeDate(from), to: noticeDate(to) })}
        </p>
      ))}
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
