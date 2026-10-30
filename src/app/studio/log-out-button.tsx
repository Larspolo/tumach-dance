"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "./studio.module.css";

export function LogOutButton() {
  const t = useTranslations("StudioHome");
  const router = useRouter();
  return (
    <button
      className={styles.link}
      type="button"
      onClick={async () => {
        await authClient.signOut();
        router.replace(LOGIN_PATH);
      }}
    >
      {t("logOut")}
    </button>
  );
}
