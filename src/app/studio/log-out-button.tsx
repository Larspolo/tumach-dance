"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { authClient } from "@/lib/auth-client";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { deleteOfflineCache } from "./offline-cache";
import styles from "./studio.module.css";

export function LogOutButton() {
  const t = useTranslations("StudioHome");
  const router = useRouter();
  return (
    <button
      className={styles.link}
      type="button"
      onClick={async () => {
        // The kept studio home of the service worker has names of dancers (#746): delete it first, also when the
        // log out fails.
        await deleteOfflineCache();
        await authClient.signOut();
        router.replace(LOGIN_PATH);
      }}
    >
      {t("logOut")}
    </button>
  );
}
