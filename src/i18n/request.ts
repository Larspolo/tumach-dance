import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { withFallback } from "./fallback";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const english = (await import("../../messages/en.json")).default;
  return {
    locale,
    messages: locale === "en" ? messages : withFallback(messages, english),
  };
});
