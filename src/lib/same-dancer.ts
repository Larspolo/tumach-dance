// The one rule "the same dancer" (#620, epic #616): the removal of the data of a dancer and later the page of a dancer
// (`nina:dancer`) find the bookings of one dancer with it. A booking that Nina adds for a dancer of WhatsApp can have
// no email, only a name and a phone.
import { eq, type SQL, sql } from "drizzle-orm";
import { bookings } from "@/db/schema";

/** The characters that a phone number can have besides its digits; the rule compares only the digits. */
const PHONE_MARKS = [" ", "-", "+", "(", ")", ".", "/"];

/** The digits of a phone number: `+31 6 1234-5678` gives `31612345678`. */
export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** The SQL of the digits of the phone column (SQLite has no regex replace: one `replace` per mark). */
function phoneDigitsSql(): SQL {
  let expression: SQL = sql`${bookings.phone}`;
  for (const mark of PHONE_MARKS) expression = sql`replace(${expression}, ${mark}, '')`;
  return expression;
}

/**
 * The Drizzle condition of the bookings of the same dancer as `booking`: the same email (any case) when the email is
 * not empty, else the same phone digits when the phone has digits, else only the booking itself.
 */
export function dancerWhere(booking: { id: number; email: string; phone: string }): SQL {
  const email = booking.email.trim().toLowerCase();
  if (email !== "") return sql`lower(trim(${bookings.email})) = ${email}`;
  const digits = phoneDigits(booking.phone);
  if (digits !== "") return sql`trim(${bookings.email}) = '' and ${phoneDigitsSql()} = ${digits}`;
  return eq(bookings.id, booking.id);
}
