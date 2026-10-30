import { useTranslations } from "next-intl";
import { ContactForm } from "./ContactForm";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The form sends a message to Nina (#152, `ContactForm.tsx`).
export function Contact() {
  const t = useTranslations("HomePage.contact");
  return (
    <section id="contact" aria-labelledby="contact-title" className={`${styles.section} ${styles.contact}`}>
      <SectionHead id="contact" title={t("title")} label={t("label")} />
      <div className={styles.twoCols}>
        <ContactForm />
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
