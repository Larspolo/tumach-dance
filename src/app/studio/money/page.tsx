import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { TIME_ZONE } from "@/lib/hours";
import { monthMoney, monthOf } from "@/lib/money";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";

// The money of one month (#597): the approved bookings, the paid sum and the sum that is not paid yet.
// `?month=YYYY-MM` chooses the month, with links to the month before and after (#598).
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioMoney");
  const nav = monthOf((await searchParams).month);
  const money = monthMoney(getDb(), nav.month);
  // The middle of the month: its name is the same in each time zone.
  const middle = (month: string) => Date.parse(`${month}-15T12:00:00Z`);
  const monthName = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, month: "long", year: "numeric" }).format(
    middle(nav.month),
  );
  const shortName = (month: string) =>
    new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, month: "long" }).format(middle(month));
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title", { month: monthName })}</h1>
      <p>
        <Link className={styles.link} href={`/studio/money?month=${nav.previous}`} data-testid="money-previous">
          {t("previous", { month: shortName(nav.previous) })}
        </Link>{" "}
        <Link className={styles.link} href={`/studio/money?month=${nav.next}`} data-testid="money-next">
          {t("next", { month: shortName(nav.next) })}
        </Link>
      </p>
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
