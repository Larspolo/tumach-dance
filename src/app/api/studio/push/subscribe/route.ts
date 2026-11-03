// Store the push subscription of a device of Nina (#25). The proxy lets only a session of Nina in (#19).
import { getDb } from "@/db";
import { studioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { hasSubscription, isSubscription, saveSubscription } from "@/lib/push";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isSubscription(body)) return Response.json({ error: "bad subscription" }, { status: 400 });
  // The push belongs to the login of this device: a log-out deletes it (#586).
  const session = await getStudioSession(request.headers);
  saveSubscription(getDb(), body, Date.now(), studioLocale(request.headers), session?.session.id ?? null);
  return Response.json({ ok: true });
}

// Does the server still have the push of this device (#570)? The studio app asks at each open.
export async function GET(request: Request) {
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  if (!endpoint) return Response.json({ error: "no endpoint" }, { status: 400 });
  const session = await getStudioSession(request.headers);
  return Response.json({ known: hasSubscription(getDb(), endpoint, session?.session.id) });
}
