import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { vapidPublicKey } from "@/lib/push";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { LogOutButton } from "./log-out-button";
import { PasskeyOffer } from "./passkey-offer";
import { PushButtons } from "./push-buttons";
import styles from "./studio.module.css";

// The start page of the studio app: the links to the bookings (#76), the hours (#23), the offers and the classes (#96).
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
      <PasskeyOffer />
      <p>
        <Link className={styles.link} href="/studio/bookings">
          {t("bookings")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/hours">
          {t("hours")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/offers">
          {t("offers")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/classes">
          {t("classes")}
        </Link>
      </p>
      <PushButtons vapidKey={vapidPublicKey()} />
      <LogOutButton />
    </main>
  );
}
