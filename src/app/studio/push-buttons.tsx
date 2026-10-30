"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import styles from "./studio.module.css";

type State = "loading" | "unsupported" | "installFirst" | "denied" | "off" | "on";

/** The VAPID key of the server as the bytes that `pushManager.subscribe` takes. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

// Push notifications of the studio app (#25): turn them on (the browser asks only after a tap) and send a test.
export function PushButtons({ vapidKey }: { vapidKey?: string }) {
  const t = useTranslations("Push");
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        // On an iPhone, push works only in the app on the home screen (iOS 16.4 or newer).
        setState(isIos() && !isInstalled() ? "installFirst" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return setState("denied");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/studio" });
      const subscription = await registration.pushManager.getSubscription();
      setState(subscription && Notification.permission === "granted" ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMessage(undefined);
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      if (!vapidKey) throw new Error("no VAPID key");
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/studio" });
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidKey) }));
      const response = await fetch("/api/studio/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error(`subscribe ${response.status}`);
      setState("on");
    } catch {
      setMessage(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage(undefined);
    try {
      const response = await fetch("/api/studio/push/test", { method: "POST" });
      setMessage(response.ok ? t("testSent") : t("failed"));
    } catch {
      setMessage(t("failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.form}>
      <h2 className={styles.label}>{t("title")}</h2>
      {state === "installFirst" && <p className={styles.note}>{t("installFirst")}</p>}
      {state === "unsupported" && <p className={styles.note}>{t("unsupported")}</p>}
      {state === "denied" && <p className={styles.note}>{t("denied")}</p>}
      {state === "off" && (
        <button className={styles.button} type="button" disabled={busy} onClick={turnOn}>
          {t("turnOn")}
        </button>
      )}
      {state === "on" && (
        <>
          <p className={styles.note}>{t("on")}</p>
          <button className={styles.button} type="button" disabled={busy} onClick={sendTest}>
            {t("sendTest")}
          </button>
        </>
      )}
      {message && (
        <p className={styles.note} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
