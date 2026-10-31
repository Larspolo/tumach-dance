// The secret calendar feed of Nina (#103): `/api/calendar/<token>.ics`. A calendar app polls it with no login, so
// the token in the address is the key; it is not under `/api/studio/` (the guard of `src/proxy.ts` asks a session).
import { getDb } from "../../../../db";
import { studioLocale } from "../../../../i18n/studio";
import { calendarFeed } from "../../../../lib/calendar-feed";
import { isCalendarToken } from "../../../../lib/calendar-token";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = file.endsWith(".ics") ? file.slice(0, -".ics".length) : "";
  const db = getDb();
  if (!token || !isCalendarToken(db, token)) return new Response(null, { status: 404 });
  return new Response(await calendarFeed(db, studioLocale(request.headers)), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
}
