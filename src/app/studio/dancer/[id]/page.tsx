import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { bookings } from "@/db/schema";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName } from "@/lib/booking-name";
import { dancerBookings } from "@/lib/dancer-bookings";
import { TIME_ZONE } from "@/lib/hours";
import { backPath, LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../../studio.module.css";

// The earlier bookings of the dancer of one booking (#623, epic #621), newest first. `?back=` is the page before.
export default async function DancerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ back?: string }>;
}) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioDancer");
  const offerName = await getTranslations("StudioOffers");
  const weekName = await getTranslations("StudioWeek");
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const back = backPath((await searchParams).back ?? null, "/studio/week");
  const db = getDb();
  const anchor = db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!anchor) notFound();
  const others = dancerBookings(db, id);
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <main className={styles.main}>
      <Link className={styles.link} href={back}>
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title", { name: shownName(anchor, weekName("removed")) })}</h1>
      {others.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list} data-testid="dancer-bookings">
        {others.map(({ booking, offer }) => (
          <li key={booking.id} className={styles.item} data-booking={booking.id}>
            <strong>{offerName(offer.kind, { minutes: offer.minutes })}</strong>
            <p>{when.format(booking.start)}</p>
            <p>
              <span className={styles.mark}>{t(`status.${booking.status}`)}</span>{" "}
              {booking.status === "approved" && (
                <span className={styles.mark}>{t(booking.paidAt === null ? "notPaid" : "paid")}</span>
              )}
            </p>
          </li>
        ))}
      </ul>
    </main>
  );
}
