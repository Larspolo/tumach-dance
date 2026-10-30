import { useTranslations } from "next-intl";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The form has no action yet: site:contact makes it send.
export function Contact() {
  const t = useTranslations("HomePage.contact");
  return (
    <section id="contact" aria-labelledby="contact-title" className={`${styles.section} ${styles.contact}`}>
      <SectionHead id="contact" title={t("title")} label={t("label")} />
      <div className={styles.twoCols}>
        <form>
          <p>{t("text")}</p>
          <div className={styles.field}>
            <label htmlFor="contact-name">{t("name")}</label>
            <input id="contact-name" type="text" autoComplete="name" />
          </div>
          <div className={styles.field}>
            <label htmlFor="contact-email">{t("email")}</label>
            <input id="contact-email" type="email" autoComplete="email" />
          </div>
          <div className={styles.field}>
            <label htmlFor="contact-message">{t("message")}</label>
            <textarea id="contact-message" rows={3} />
          </div>
          <button type="button" className={styles.btn} disabled>
            {t("send")}
          </button>
        </form>
        <div className={styles.meta}>
          <div className={styles.line}>
            <span className={styles.lbl}>{t("placeLabel")}</span>
            {t("place")}
          </div>
          <p className={styles.closing}>{t("closing")}</p>
        </div>
      </div>
    </section>
  );
}
