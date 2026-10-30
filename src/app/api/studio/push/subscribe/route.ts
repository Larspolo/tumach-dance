// Store the push subscription of a device of Nina (#25). The proxy lets only a session of Nina in (#19).
import { getDb } from "@/db";
import { isSubscription, saveSubscription } from "@/lib/push";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!isSubscription(body)) return Response.json({ error: "bad subscription" }, { status: 400 });
  saveSubscription(getDb(), body);
  return Response.json({ ok: true });
}
