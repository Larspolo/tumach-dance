"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "../studio.module.css";

// Log out one other device (a token) or all other devices (no token), after a confirm in place (#587).
export function LogOutDevice({ token }: { token?: string }) {
  const t = useTranslations("Devices");
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [failed, setFailed] = useState(false);
  const revoke = async () => {
    setFailed(false);
    const { error } = token ? await authClient.revokeSession({ token }) : await authClient.revokeOtherSessions();
    if (error) {
      setFailed(true);
      return;
    }
    setAsking(false);
    router.refresh();
  };
  if (!asking) {
    return (
      <button className={styles.link} type="button" onClick={() => setAsking(true)}>
        {token ? t("logOut") : t("logOutOthers")}
      </button>
    );
  }
  return (
    <div>
      <p>{token ? t("confirm") : t("confirmOthers")}</p>
      <button className={styles.link} type="button" onClick={revoke}>
        {t("yes")}
      </button>{" "}
      <button className={styles.link} type="button" onClick={() => setAsking(false)}>
        {t("no")}
      </button>
      {failed && (
        <p className={styles.note} role="alert">
          {t("failed")}
        </p>
      )}
    </div>
  );
}
