import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listBookings } from "@/db/bookings";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName } from "@/lib/booking-name";
import { TIME_ZONE } from "@/lib/hours";
import { currentMonth, monthMoney, monthRange } from "@/lib/money";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { pay } from "../bookings/actions";
import styles from "../studio.module.css";

// The money of the current month (#597): the approved bookings, the paid sum and the sum that is not paid yet.
export default async function MoneyPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioMoney");
  const paidText = await getTranslations("StudioBookings");
  const weekName = await getTranslations("StudioWeek");
  const now = Date.now();
  const db = getDb();
  const month = currentMonth(now);
  const money = monthMoney(db, month);
  // The approved bookings of the month that are not paid (#599), by start.
  const { from, to } = monthRange(month);
  const unpaid = listBookings(db, from, to, ["approved"]).filter(
    ({ booking }) => booking.paidAt === null && booking.start >= from && booking.start < to,
  );
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
      <h2>{t("unpaidTitle")}</h2>
      {unpaid.length === 0 ? (
        <p className={styles.note}>{t("allPaid")}</p>
      ) : (
        <ul className={styles.list} aria-label={t("unpaidTitle")}>
          {unpaid.map(({ booking }) => (
            <li key={booking.id} className={styles.item}>
              <p>{when.format(booking.start)}</p>
              <p>{shownName(booking, weekName("removed"))}</p>
              <p>{euro.format(booking.priceCents / 100)}</p>
              <form className={styles.form} action={pay}>
                <input type="hidden" name="id" value={booking.id} />
                <input type="hidden" name="back" value="/studio/money" />
                <button className={styles.button} type="submit" name="paid" value="paid">
                  {paidText("markPaid")}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
