// The last server errors of this process, for `/api/health` and the site watch on GitHub (2026-10-31). The agents
// cannot read the log of the home server: tumach.dance gave 500 on each page for hours, and only Lars could see why
// (sharp could not load on the CPU of the server). The text is public: it keeps no personal data.

/** One error: where it happened (a start part, or the method and the path of a request), its text and its instant. */
export type SiteError = { where: string; message: string; at: string; start?: true };

/** The errors that `/api/health` shows: enough to find a cause, few enough for one look. */
export const MAX_ERRORS = 5;
/** The longest text of one error. */
export const MAX_MESSAGE = 400;

const store = globalThis as unknown as { tumachSiteErrors?: SiteError[] };

/** The first `count` lines of one error (an error of a module load gives its reason on lines 2 and 3), with no stack and no help text. */
function errorLines(error: unknown, count: number): string[] {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("at "));
  const help = lines.findIndex((line) => line.startsWith("Possible solutions"));
  return lines.slice(0, help === -1 ? count : Math.min(count, help));
}

/** Emails and numbers of 6 or more digits (a phone) become placeholders, and the values of a failed query (`params:`) go away. */
function scrub(text: string): string {
  return text
    .replace(/\bparams:.*$/i, "params: <removed>")
    .replace(/[^\s@|<>"']+@[^\s@|<>"']+\.[a-z]{2,}/gi, "<email>")
    .replace(/\+?\d[\d ()-]{4,}\d/g, (match) => (match.replace(/\D/g, "").length >= 6 ? "<number>" : match));
}

/** The public text of an error: its first 3 lines and the first 2 lines of its `cause`, with no personal data. */
export function publicMessage(error: unknown): string {
  const cause = error instanceof Error && error.cause ? errorLines(error.cause, 2) : [];
  const parts = [errorLines(error, 3).join(" | "), ...(cause.length > 0 ? [`cause: ${cause.join(" | ")}`] : [])];
  return parts.map(scrub).join(" | ").slice(0, MAX_MESSAGE);
}

/**
 * Keep an error of a start part (`start`) or of a request. The newest come first; a start error is never dropped. The
 * same error at the same place again replaces the older one: each check of the watch must not push the others out.
 */
export function recordError(where: string, error: unknown, { start = false, now = new Date() } = {}): void {
  const entry: SiteError = { where, message: publicMessage(error), at: now.toISOString(), ...(start && { start }) };
  const older = (store.tumachSiteErrors ?? []).filter((e) => e.where !== where || e.message !== entry.message);
  const list = [entry, ...older];
  const starts = list.filter((e) => e.start);
  store.tumachSiteErrors = [...starts, ...list.filter((e) => !e.start)].slice(0, Math.max(MAX_ERRORS, starts.length));
}

/** The kept errors: the start errors first, then the newest request errors. */
export function siteErrors(): SiteError[] {
  return [...(store.tumachSiteErrors ?? [])];
}

/** Forget all errors (tests). */
export function clearErrors(): void {
  store.tumachSiteErrors = [];
}
