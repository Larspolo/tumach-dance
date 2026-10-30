// The text of a locale, with English as the fallback (#95, roadmap `site:languages`).
import type { LocalTexts } from "../db/classes";

/** The text of `locale`; the English text when the locale has none. */
export function localText(texts: LocalTexts, locale: string): string {
  return (texts as Partial<Record<string, string>>)[locale] || texts.en;
}
