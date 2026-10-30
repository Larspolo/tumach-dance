// The name of a booking as Nina sees it (#225): a booking whose personal data was removed (#224) shows a text, not an empty name.

/** The name to show for a booking; `removed` is the text of a booking whose personal data was removed. */
export function shownName(booking: { name: string; forgottenAt: number | null }, removed: string): string {
  return booking.forgottenAt === null ? booking.name : removed;
}
