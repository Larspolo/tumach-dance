import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listOffers } from "@/db/offers";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { OFFER_KINDS, OFFER_MINUTES } from "@/lib/offer-form";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { changeOffer } from "./actions";

// The offers of the studio (#31): Nina adds, changes and hides them. Plain HTML forms and one server action.
export default async function OffersPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioOffers");
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const offers = listOffers(getDb());

  const lengthSelect = (value?: number) => (
    <label className={styles.form}>
      <span className={styles.label}>{t("length")}</span>
      <select className={styles.input} name="minutes" defaultValue={value ?? 60}>
        {OFFER_MINUTES.map((m) => (
          <option key={m} value={m}>
            {t("minutes", { minutes: m })}
          </option>
        ))}
      </select>
    </label>
  );
  const priceInput = (cents?: number) => (
    <label className={styles.form}>
      <span className={styles.label}>{t("price")}</span>
      <input
        className={styles.input}
        name="price"
        inputMode="decimal"
        required
        pattern="\d+([.,]\d{1,2})?"
        defaultValue={cents === undefined ? "" : (cents / 100).toFixed(2)}
      />
    </label>
  );

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      {offers.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list}>
        {offers.map((offer) => (
          <li key={offer.id}>
            <details className={styles.item}>
              <summary className={styles.summary}>
                <span>{t(offer.kind, { minutes: offer.minutes })}</span>
                <span>
                  {euro.format(offer.priceCents / 100)}
                  {!offer.visible && <span className={styles.mark}> {t("hidden")}</span>}
                </span>
              </summary>
              <form className={styles.form} action={changeOffer}>
                <input type="hidden" name="id" value={offer.id} />
                {lengthSelect(offer.minutes)}
                {priceInput(offer.priceCents)}
                <button className={styles.button} type="submit" name="intent" value="save">
                  {t("save")}
                </button>
              </form>
              <form className={styles.form} action={changeOffer}>
                <input type="hidden" name="id" value={offer.id} />
                <button className={styles.link} type="submit" name="intent" value={offer.visible ? "hide" : "show"}>
                  {offer.visible ? t("hide") : t("show")}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
      <details className={styles.item}>
        <summary className={styles.button}>{t("add")}</summary>
        <form className={styles.form} action={changeOffer}>
          <fieldset className={styles.choices}>
            <legend className={styles.label}>{t("kind")}</legend>
            {OFFER_KINDS.map((kind, i) => (
              <label key={kind} className={styles.choice}>
                <input type="radio" name="kind" value={kind} defaultChecked={i === 0} />
                {t(`${kind}Kind`)}
              </label>
            ))}
          </fieldset>
          {lengthSelect()}
          {priceInput()}
          <button className={styles.button} type="submit" name="intent" value="add">
            {t("addSave")}
          </button>
        </form>
      </details>
    </main>
  );
}
