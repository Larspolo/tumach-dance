// The calendar file of one approved booking for Nina (#535): `/api/studio/bookings/<id>.ics`. She adds the lesson to
// her own calendar only when she taps "Add to my calendar"; no email sends her an invitation. The proxy lets only a
// session of Nina in (#19).
import { getDb } from "@/db";
import { getApprovedBooking } from "@/db/bookings";
import { studioLocale } from "@/i18n/studio";
import { bookingEvent } from "@/lib/booking-ics";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^(\d+)\.ics$/.exec(file);
  const found = match ? getApprovedBooking(getDb(), Number(match[1])) : null;
  if (!found) return new Response(null, { status: 404 });
  return new Response(bookingEvent(found.booking, found.offer, studioLocale(request.headers)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="tumach-${found.booking.id}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
