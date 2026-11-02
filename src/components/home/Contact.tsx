import { useTranslations } from "next-intl";
import { contactStamp } from "@/lib/contact-spam";
import { studioAccounts } from "@/lib/studio-accounts";
import { ContactForm } from "./ContactForm";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The form sends a message to Nina (#152, `ContactForm.tsx`).
// A line per account of the studio (#451, `studioAccounts`).
export function Contact() {
  const t = useTranslations("HomePage.contact");
  return (
    <section id="contact" aria-labelledby="contact-title" className={`${styles.section} ${styles.contact}`}>
      <SectionHead id="contact" title={t("title")} label={t("label")} />
      <div className={styles.twoCols}>
        <ContactForm stamp={contactStamp()} />
        <div className={styles.meta}>
          <div className={styles.line}>
            <span className={styles.lbl}>{t("placeLabel")}</span>
            {t("place")}
          </div>
          {studioAccounts().map((account) => (
            <div key={account.kind} className={styles.line}>
              <span className={styles.lbl}>{t(account.kind)}</span>
              <a className={styles.account} href={account.href} rel="noopener">
                {account.handle || t("whatsappLink")}
              </a>
            </div>
          ))}
          <p className={styles.closing}>{t("closing")}</p>
        </div>
      </div>
    </section>
  );
}
