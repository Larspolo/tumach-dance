// The example data of a question for Nina (#146): a `## For Nina` line `Example: <name>` loads a fixed seed on the
// preview when Nina taps "Try", so that she has something to try. The live site never gets example data (#133).
// A seed writes only through the functions of `src/db/` (the holds and checks stay correct) and never through the
// server actions: no email and no push for example data.
import { and, eq } from "drizzle-orm";
import { decideBooking, requestBooking } from "../db/bookings";
import type { Db } from "../db/index";
import { addOffer, listOffers } from "../db/offers";
import { loadedExamples } from "../db/schema";
import { bookingDays } from "./booking-page";
import type { ExampleName, NinaQuestion } from "./nina-question";
import { type SiteEnv, siteEnv } from "./site";

/** The days of the example bookings: today and the next 6 days. */
const EXAMPLE_DAYS = 7;
const EXAMPLE_BOOKINGS = 4;

/**
 * One lesson and one rental, only when there is no visible offer: a hidden offer alone (the steps of #72 end with
 * "Then hide it") leaves the booking page with nothing to book (#296). Gives the count of new offers.
 */
function seedOffers(db: Db): number {
  if (listOffers(db, { visibleOnly: true }).length > 0) return 0;
  addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, visible: true, position: 1 });
  addOffer(db, { kind: "rental", minutes: 60, priceCents: 2500, visible: true, position: 2 });
  return 2;
}

/**
 * Two requests and two approved bookings of the first visible offer in the next 7 days, at free times only. Each
 * booking takes a free slot of a new day first, so that the week shows them apart. Gives the count of new bookings.
 */
function seedBookings(db: Db, now: number): number {
  seedOffers(db);
  const offer = listOffers(db, { visibleOnly: true })[0];
  if (!offer) return 0;
  const usedDays = new Set<string>();
  let added = 0;
  for (let i = 1; i <= EXAMPLE_BOOKINGS; i++) {
    const days = bookingDays(db, offer, now)
      .slice(0, EXAMPLE_DAYS)
      .filter((day) => day.slots.length > 0);
    const day = days.find((d) => !usedDays.has(d.date)) ?? days[0];
    if (!day) break;
    usedDays.add(day.date);
    const slot = day.slots[0];
    const result = requestBooking(
      db,
      {
        offerId: offer.id,
        start: slot.start,
        end: slot.end,
        name: `Example ${i}`,
        email: `example${i}@example.com`,
        phone: `+31 6 0000 000${i}`,
        locale: "en",
      },
      { now },
    );
    if (!result.ok) break;
    added++;
    if (i > EXAMPLE_BOOKINGS / 2) decideBooking(db, result.booking.id, "approved", null, now);
  }
  return added;
}

/** Write the seed `name` into the database. Gives the count of new rows (offers or bookings). */
export function seedExample(db: Db, name: ExampleName, now: number = Date.now()): number {
  return name === "bookings" ? seedBookings(db, now) : seedOffers(db);
}

/**
 * Load the seed `name` once for question `question`. The row of `loaded_examples` comes first: a second tap, another
 * device or a restart loads nothing. A seed that fails removes its row, so that the next tap tries again.
 * Gives true when this call loaded the seed.
 */
export function loadExample(db: Db, question: number, name: ExampleName, now: number = Date.now()): boolean {
  const insert = db.insert(loadedExamples).values({ question, name, loadedAt: now }).onConflictDoNothing().run();
  if (insert.changes === 0) return false;
  try {
    seedExample(db, name, now);
  } catch (error) {
    db.delete(loadedExamples)
      .where(and(eq(loadedExamples.question, question), eq(loadedExamples.name, name)))
      .run();
    throw error;
  }
  return true;
}

/** The route of `src/app/studio/questions/try/[number]/` that loads the example data, then opens the `Try:` path. */
export function tryRoute(number: number): string {
  return `/studio/questions/try/${number}`;
}

/** The address of the "Try" link: on the preview through the route that loads the example data, else the path. */
export function tryHref(question: NinaQuestion, site: SiteEnv = siteEnv()): string | null {
  if (!question.tryPath) return null;
  return question.example && site === "preview" ? tryRoute(question.number) : question.tryPath;
}

/**
 * The tap on "Try" (the route): on the preview, load the example data of the question once. Gives the `Try:` path to
 * open; a question with no path opens the page "For Nina".
 */
export function tryQuestion(db: Db, question: NinaQuestion, site: SiteEnv = siteEnv(), now = Date.now()): string {
  if (question.example && site === "preview") loadExample(db, question.number, question.example, now);
  return question.tryPath ?? "/studio/questions";
}
