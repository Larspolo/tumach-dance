"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "../studio.module.css";

// Step 1: Nina types her email and gets a code. Step 2: she types the code (#19).
export function LoginForm() {
  const t = useTranslations("StudioLogin");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [error, setError] = useState<"wrongCode" | "failed" | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (error) return setError("failed");
    setStep("code");
  }

  async function logIn(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    if (error) {
      setBusy(false);
      return setError(error.status === 400 || error.status === 403 ? "wrongCode" : "failed");
    }
    router.replace("/studio");
    router.refresh();
  }

  if (step === "email") {
    return (
      <form className={styles.form} onSubmit={sendCode}>
        <label className={styles.label} htmlFor="email">
          {t("emailLabel")}
        </label>
        <input
          className={styles.input}
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <button className={styles.button} type="submit" disabled={busy}>
          {t("sendCode")}
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {t(error)}
          </p>
        )}
      </form>
    );
  }

  return (
    <form className={styles.form} onSubmit={logIn}>
      <p className={styles.note}>{t("codeSent", { email })}</p>
      <label className={styles.label} htmlFor="code">
        {t("codeLabel")}
      </label>
      <input
        className={styles.input}
        id="code"
        type="text"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <button className={styles.button} type="submit" disabled={busy}>
        {t("logIn")}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {t(error)}
        </p>
      )}
      <button
        className={styles.link}
        type="button"
        onClick={() => {
          setStep("email");
          setCode("");
          setError(null);
        }}
      >
        {t("otherEmail")}
      </button>
    </form>
  );
}
