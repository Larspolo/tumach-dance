"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { passkeyChoice, savePasskeyChoice } from "@/lib/passkey-offer";
import styles from "./studio.module.css";

// After a code login on a device with no passkey: one offer to add a passkey (#26).
export function PasskeyOffer() {
  const t = useTranslations("PasskeyOffer");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setShow(typeof window.PublicKeyCredential === "function" && passkeyChoice(localStorage) === null);
  }, []);

  if (!show) return null;

  async function add() {
    setBusy(true);
    setFailed(false);
    const result = await authClient.passkey.addPasskey();
    setBusy(false);
    if (result?.error) return setFailed(true);
    savePasskeyChoice(localStorage, "added");
    setShow(false);
  }

  return (
    <section className={styles.form} aria-labelledby="passkey-offer">
      <h2 className={styles.label} id="passkey-offer">
        {t("title")}
      </h2>
      <p className={styles.note}>{t("text")}</p>
      <button className={styles.button} type="button" disabled={busy} onClick={add}>
        {t("add")}
      </button>
      {failed && (
        <p className={styles.error} role="alert">
          {t("failed")}
        </p>
      )}
      <button
        className={styles.link}
        type="button"
        onClick={() => {
          savePasskeyChoice(localStorage, "notNow");
          setShow(false);
        }}
      >
        {t("notNow")}
      </button>
    </section>
  );
}
