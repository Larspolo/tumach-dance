import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { LogOutButton } from "./log-out-button";
import styles from "./studio.module.css";

// The start page of the studio app. The bookings and the hours come here later.
export default async function StudioPage() {
  // The proxy guards each studio page; this check also keeps the data of a page behind the login.
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioHome");
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("loggedInAs", { email: session.user.email })}</p>
      <LogOutButton />
    </main>
  );
}
