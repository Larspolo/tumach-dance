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
import { monthMoney, monthOf, monthRange } from "@/lib/money";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { pay } from "../bookings/actions";
import styles from "../studio.module.css";

// The money of one month (#597): the approved bookings, the paid sum and the sum that is not paid yet.
// `?month=YYYY-MM` chooses the month, with links to the month before and after (#598).
export default async function MoneyPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioMoney");
  const paidText = await getTranslations("StudioBookings");
  const weekName = await getTranslations("StudioWeek");
  const nav = monthOf((await searchParams).month);
  const db = getDb();
  const money = monthMoney(db, nav.month);
  // The approved bookings of the month that are not paid (#599), by start.
  const { from, to } = monthRange(nav.month);
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
                <input type="hidden" name="back" value={`/studio/money?month=${nav.month}`} />
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
