// Send a test notification to each device of Nina (#25). The proxy lets only a session of Nina in (#19).
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { studioLocale } from "@/i18n/studio";
import { sendPush, vapidPublicKey } from "@/lib/push";

export async function POST(request: Request) {
  if (!vapidPublicKey()) return Response.json({ error: "no VAPID keys" }, { status: 503 });
  const t = await getTranslations({ locale: studioLocale(request.headers), namespace: "Push" });
  const sent = await sendPush(getDb(), { title: t("testTitle"), body: t("testBody"), url: "/studio" });
  return Response.json({ sent });
}
