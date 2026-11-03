// The spreadsheet of the approved bookings of one year for Nina (#629): `/api/studio/money/<year>.csv`. The proxy lets
// only a session of Nina in (#19).
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { studioLocale } from "@/i18n/studio";
import { yearCsv } from "@/lib/money-csv";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const match = /^(\d{4})\.csv$/.exec(file);
  if (!match) return new Response(null, { status: 404 });
  const year = Number(match[1]);
  const locale = studioLocale(request.headers);
  const t = await getTranslations({ locale, namespace: "StudioMoney.csv" });
  const book = await getTranslations({ locale, namespace: "Book" });
  const body = yearCsv(getDb(), year, {
    header: [t("date"), t("time"), t("offer"), t("price"), t("paid")],
    offer: (offer) => book(offer.kind, { minutes: offer.minutes }),
    yes: t("yes"),
    no: t("no"),
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tumach-${year}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
