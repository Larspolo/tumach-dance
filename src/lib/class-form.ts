// The form of the classes page of the studio app (#96): read a plain HTML form and change the classes table.
// Apart from the server action, so that a test runs it with no Next.js request.
import type { Db } from "../db";
import { addClass, type LocalTexts, listClasses, updateClass } from "../db/classes";

/** The texts of a class; each has a box per language: `name_en`, `name_nl`, `name_sl`. */
export const CLASS_FIELDS = ["name", "text", "forWhom"] as const;
export const CLASS_LANGUAGES = ["en", "nl", "sl"] as const;

/** The texts of one field; undefined when the English text is empty. An empty other language is left out. */
function textsOf(form: FormData, field: string): LocalTexts | undefined {
  const value = (lang: string) => String(form.get(`${field}_${lang}`) ?? "").trim();
  const en = value("en");
  if (!en) return undefined;
  const texts: LocalTexts = { en };
  for (const lang of ["nl", "sl"] as const) if (value(lang)) texts[lang] = value(lang);
  return texts;
}

function allTexts(form: FormData): Record<(typeof CLASS_FIELDS)[number], LocalTexts> | undefined {
  const [name, text, forWhom] = CLASS_FIELDS.map((f) => textsOf(form, f));
  return name && text && forWhom ? { name, text, forWhom } : undefined;
}

/**
 * Apply one submit of the form. `intent`: "add", "save", "hide" or "show". With no session it changes nothing.
 * Returns false when the form is not valid or the session is missing.
 */
export function applyClassForm(db: Db, session: unknown, form: FormData): boolean {
  if (!session) return false;
  const intent = form.get("intent");
  if (intent === "add") {
    const texts = allTexts(form);
    if (!texts) return false;
    const position = Math.max(0, ...listClasses(db).map((c) => c.position)) + 1;
    addClass(db, { ...texts, position });
    return true;
  }
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return false;
  if (intent === "hide" || intent === "show") return updateClass(db, id, { visible: intent === "show" }) !== undefined;
  if (intent === "save") {
    const texts = allTexts(form);
    if (!texts) return false;
    return updateClass(db, id, texts) !== undefined;
  }
  return false;
}
