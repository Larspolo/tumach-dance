import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

export default async function StudioPage() {
  setRequestLocale(routing.defaultLocale);
  const t = await getTranslations("StudioPage");
  return (
    <main>
      <h1>TUMACH studio</h1>
      <p>{t("placeholder")}</p>
    </main>
  );
}
