"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { passkeyChoice, savePasskeyChoice } from "@/lib/passkey-offer";
import styles from "./studio.module.css";

// After a code login on a device with no passkey: one offer to add a passkey (#26). After "Not now" or a passkey,
// a small section with the button stays, so Nina can always add one (another passkey, or one she removed).
export function PasskeyOffer() {
  const t = useTranslations("PasskeyOffer");
  const [view, setView] = useState<"hidden" | "offer" | "button">("hidden");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (typeof window.PublicKeyCredential !== "function") return;
    setView(passkeyChoice(localStorage) === null ? "offer" : "button");
  }, []);

  if (view === "hidden") return null;
  const offer = view === "offer";

  async function add() {
    setBusy(true);
    setFailed(false);
    setAdded(false);
    const result = await authClient.passkey.addPasskey();
    setBusy(false);
    if (result?.error) return setFailed(true);
    savePasskeyChoice(localStorage, "added");
    setView("button");
    setAdded(true);
  }

  return (
    <section className={`${styles.form} ${styles.section}`} aria-labelledby="passkey-offer">
      <h2 className={styles.label} id="passkey-offer">
        {offer ? t("title") : t("buttonTitle")}
      </h2>
      {offer && <p className={styles.note}>{t("text")}</p>}
      <button className={styles.button} type="button" disabled={busy} onClick={add}>
        {t("add")}
      </button>
      {added && (
        <p className={styles.note} role="status">
          {t("added")}
        </p>
      )}
      {failed && (
        <p className={styles.error} role="alert">
          {t("failed")}
        </p>
      )}
      {offer && (
        <button
          className={styles.link}
          type="button"
          onClick={() => {
            savePasskeyChoice(localStorage, "notNow");
            setView("button");
          }}
        >
          {t("notNow")}
        </button>
      )}
    </section>
  );
}
