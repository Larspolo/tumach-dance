// The name of a booking as Nina sees it (#225): a booking whose personal data was removed (#224) shows a text, not an empty name.

/** The name to show for a booking; `removed` is the text of a booking whose personal data was removed. */
export function shownName(booking: { name: string; forgottenAt: number | null }, removed: string): string {
  return booking.forgottenAt === null ? booking.name : removed;
}

/**
 * The note of a dancer as Nina sees it (#388): none for a booking whose personal data was removed. With `max`, a
 * longer note is cut at `max` characters and ends with "…".
 */
export function shownNote(booking: { note: string | null; forgottenAt: number | null }, max?: number): string | null {
  if (booking.forgottenAt !== null || booking.note === null) return null;
  const note = booking.note;
  return max !== undefined && note.length > max ? `${note.slice(0, max).trimEnd()}…` : note;
}
