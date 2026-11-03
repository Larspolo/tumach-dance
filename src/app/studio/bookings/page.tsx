import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listBookings, listOpenRequests, UNDO_MS } from "@/db/bookings";
import { dancerNotesFor, firstNoteLine } from "@/db/dancer-notes";
import { bookings } from "@/db/schema";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName, shownNote } from "@/lib/booking-name";
import { TIME_ZONE } from "@/lib/hours";
import { phoneDigits } from "@/lib/same-dancer";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { bookingWhatsappLink } from "@/lib/whatsapp";
import styles from "../studio.module.css";
import { decide, pay, undo } from "./actions";

const DAY = 24 * 60 * 60_000;

// The open booking requests (#76): Nina approves or declines each with one tap. One form and one server action.
// The approved bookings of 30 days back to 90 days ahead (#143): Nina marks each paid with one tap, or undoes it.
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; id?: string; undone?: string; undo?: string; error?: string }>;
}) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioBookings");
  const offerName = await getTranslations("StudioOffers");
  const weekName = await getTranslations("StudioWeek");
  const dancerT = await getTranslations("StudioDancer");
  const { done, id, undone, undo: undoError, error } = await searchParams;
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, day: "numeric", month: "short" });
  const db = getDb();
  const now = Date.now();
  const requests = listOpenRequests(db, now);
  const approved = listBookings(db, now - 30 * DAY, now + 90 * DAY, ["approved"]);
  // The first line of Nina's note about each dancer, in one query (#697).
  const noteOf = dancerNotesFor(
    db,
    [...requests, ...approved].map(({ booking }) => booking),
  );
  // The Undo button of the last tap (#573): only while the undo time of the server runs; a later load shows none.
  const decided = Number.isInteger(Number(id))
    ? db
        .select()
        .from(bookings)
        .where(eq(bookings.id, Number(id)))
        .get()
    : undefined;
  const canUndo =
    decided !== undefined &&
    decided.status === done &&
    decided.decidedAt !== null &&
    decided.decisionMailedAt === null &&
    now - decided.decidedAt < UNDO_MS;
  const undoReasons = ["sent", "taken", "started"] as const;
  const undoReason = undoReasons.find((r) => r === undoError);

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      {(done === "approved" || done === "declined") && (
        <form className={styles.form} action={undo}>
          <p className={styles.note}>{t(done)}</p>
          {canUndo && (
            <>
              <input type="hidden" name="id" value={decided.id} />
              <button className={styles.button} type="submit">
                {t("undoDecision")}
              </button>
            </>
          )}
        </form>
      )}
      {undone === "1" && <p className={styles.note}>{t("undone")}</p>}
      {undoReason !== undefined && <p className={styles.note}>{t(`undoFailed.${undoReason}`)}</p>}
      {error === "link" && <p className={styles.note}>{t("badLink")}</p>}
      {requests.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list}>
        {requests.map(({ booking, offer }) => (
          <li key={booking.id} id={`booking-${booking.id}`} className={styles.item}>
            <strong>{offerName(offer.kind, { minutes: offer.minutes })}</strong>
            <p>{when.format(booking.start)}</p>
            <p>{shownName(booking, weekName("removed"))}</p>
            {(booking.email.trim() !== "" || phoneDigits(booking.phone) !== "") && (
              <p>
                <Link className={styles.link} href={`/studio/dancer/${booking.id}?back=%2Fstudio%2Fbookings`}>
                  {dancerT("link")}
                </Link>
              </p>
            )}
            {firstNoteLine(noteOf, booking) !== null && (
              <p>
                <Link className={styles.dancerNote} href={`/studio/dancer/${booking.id}?back=%2Fstudio%2Fbookings`}>
                  {firstNoteLine(noteOf, booking)}
                </Link>
              </p>
            )}
            {booking.email !== "" && (
              <p>
                <a className={styles.link} href={`mailto:${booking.email}`}>
                  {booking.email}
                </a>
              </p>
            )}
            {booking.phone !== "" && (
              <p>
                <a className={styles.link} href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}>
                  {booking.phone}
                </a>
              </p>
            )}
            {bookingWhatsappLink(booking) !== null && (
              <p>
                <a className={`${styles.link} ${styles.chat}`} href={bookingWhatsappLink(booking) ?? undefined}>
                  {t("whatsapp")}
                </a>
              </p>
            )}
            {shownNote(booking) !== null && <p className={styles.dancerNote}>{shownNote(booking)}</p>}
            <form className={styles.form} action={decide}>
              <input type="hidden" name="id" value={booking.id} />
              <label className={styles.label}>
                {t("tikkie")}
                <input className={styles.input} type="url" name="tikkie" />
              </label>
              <button className={styles.button} type="submit" name="decision" value="approved">
                {t("approve")}
              </button>
              <button className={styles.link} type="submit" name="decision" value="declined">
                {t("decline")}
              </button>
            </form>
          </li>
        ))}
      </ul>
      {approved.length > 0 && <h2 className={styles.title}>{t("toPay")}</h2>}
      <ul className={styles.list}>
        {approved.map(({ booking, offer }) => (
          <li key={booking.id} id={`booking-${booking.id}`} className={styles.item}>
            <strong>{offerName(offer.kind, { minutes: offer.minutes })}</strong>
            <p>{when.format(booking.start)}</p>
            <p>{shownName(booking, weekName("removed"))}</p>
            {(booking.email.trim() !== "" || phoneDigits(booking.phone) !== "") && (
              <p>
                <Link className={styles.link} href={`/studio/dancer/${booking.id}?back=%2Fstudio%2Fbookings`}>
                  {dancerT("link")}
                </Link>
              </p>
            )}
            {firstNoteLine(noteOf, booking) !== null && (
              <p>
                <Link className={styles.dancerNote} href={`/studio/dancer/${booking.id}?back=%2Fstudio%2Fbookings`}>
                  {firstNoteLine(noteOf, booking)}
                </Link>
              </p>
            )}
            <p>
              <a className={styles.link} href={`/api/studio/bookings/${booking.id}.ics`} download>
                {t("addToCalendar")}
              </a>
            </p>
            <form className={styles.form} action={pay}>
              <input type="hidden" name="id" value={booking.id} />
              {booking.paidAt === null ? (
                <button className={styles.button} type="submit" name="paid" value="paid">
                  {t("markPaid")}
                </button>
              ) : (
                <>
                  <p>{t("paidOn", { date: day.format(booking.paidAt) })}</p>
                  <button className={styles.link} type="submit" name="paid" value="undo">
                    {t("undo")}
                  </button>
                </>
              )}
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
