import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { TIME_ZONE } from "@/lib/hours";
import { currentMonth, monthMoney } from "@/lib/money";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";

// The money of the current month (#597): the approved bookings, the paid sum and the sum that is not paid yet.
export default async function MoneyPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioMoney");
  const now = Date.now();
  const money = monthMoney(getDb(), currentMonth(now));
  const monthName = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, month: "long", year: "numeric" }).format(
    now,
  );
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title", { month: monthName })}</h1>
      <dl>
        <dt>{t("count")}</dt>
        <dd data-testid="money-count">{money.count}</dd>
        <dt>{t("paid")}</dt>
        <dd data-testid="money-paid">{euro.format(money.paidCents / 100)}</dd>
        <dt>{t("open")}</dt>
        <dd data-testid="money-open">{euro.format(money.openCents / 100)}</dd>
      </dl>
    </main>
  );
}
