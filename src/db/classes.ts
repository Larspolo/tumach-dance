// The classes of the studio and their weekly times (#95, roadmap `nina:classes`). The texts are JSON, by language:
// `en` is required (`src/lib/local-text.ts` picks the text of the locale).
import { asc, eq, getTableColumns } from "drizzle-orm";
import type { Weekday } from "../lib/hours";
import type { Db } from "./index";
import { classes, classTimes } from "./schema";

/** A text by language: `en` is required, the other languages are optional. */
export type LocalTexts = { en: string } & Partial<Record<"nl" | "sl", string>>;

export type ClassRow = typeof classes.$inferSelect;
export type Class = Omit<ClassRow, "name" | "text" | "forWhom"> & {
  name: LocalTexts;
  text: LocalTexts;
  forWhom: LocalTexts;
};
export type NewClass = Partial<Omit<Class, "id">> & Pick<Class, "name" | "text" | "forWhom" | "position">;
export type ClassTime = typeof classTimes.$inferSelect;
export type NewClassTime = Omit<typeof classTimes.$inferInsert, "id">;

const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Refuse a text with no English name. */
function validateTexts(texts: LocalTexts | undefined, field: string): void {
  if (texts !== undefined && !(typeof texts.en === "string" && texts.en.trim() !== "")) {
    throw new RangeError(`class ${field} needs an English text`);
  }
}

function toClass(row: ClassRow): Class {
  return {
    ...row,
    name: JSON.parse(row.name) as LocalTexts,
    text: JSON.parse(row.text) as LocalTexts,
    forWhom: JSON.parse(row.forWhom) as LocalTexts,
  };
}

/** The classes in the order of `position`; with `visibleOnly` only the classes that dancers see. */
export function listClasses(db: Db, { visibleOnly = false }: { visibleOnly?: boolean } = {}): Class[] {
  const query = db.select().from(classes);
  return (visibleOnly ? query.where(eq(classes.visible, true)) : query)
    .orderBy(asc(classes.position), asc(classes.id))
    .all()
    .map(toClass);
}

export function addClass(db: Db, cls: NewClass): Class {
  validateTexts(cls.name, "name");
  validateTexts(cls.text, "text");
  validateTexts(cls.forWhom, "forWhom");
  const row = db
    .insert(classes)
    .values({
      ...cls,
      name: JSON.stringify(cls.name),
      text: JSON.stringify(cls.text),
      forWhom: JSON.stringify(cls.forWhom),
    })
    .returning()
    .get();
  return toClass(row);
}

export function updateClass(db: Db, id: number, change: Partial<NewClass>): Class | undefined {
  validateTexts(change.name, "name");
  validateTexts(change.text, "text");
  validateTexts(change.forWhom, "forWhom");
  const { name, text, forWhom, ...rest } = change;
  const row = db
    .update(classes)
    .set({
      ...rest,
      ...(name && { name: JSON.stringify(name) }),
      ...(text && { text: JSON.stringify(text) }),
      ...(forWhom && { forWhom: JSON.stringify(forWhom) }),
    })
    .where(eq(classes.id, id))
    .returning()
    .get();
  return row && toClass(row);
}

/** Hide a class from the page. The row stays, with its times. */
export function hideClass(db: Db, id: number): Class | undefined {
  return updateClass(db, id, { visible: false });
}

/** Refuse a weekday that is not one of the seven, a time that is not "HH:MM", and a `to` that is not after `from`. */
function validateTime(time: Partial<NewClassTime>): void {
  if (time.weekday !== undefined && !WEEKDAYS.includes(time.weekday)) {
    throw new RangeError(`class time weekday must be mon to sun: ${time.weekday}`);
  }
  for (const field of ["from", "to"] as const) {
    if (time[field] !== undefined && !TIME.test(time[field])) {
      throw new RangeError(`class time ${field} must be "HH:MM": ${time[field]}`);
    }
  }
  if (time.from !== undefined && time.to !== undefined && !(time.to > time.from)) {
    throw new RangeError(`class time to must be after from: ${time.from}-${time.to}`);
  }
}

/** The weekly times, Monday to Sunday, then by start. With `visibleOnly` only the times of visible classes. */
export function listClassTimes(db: Db, { visibleOnly = false }: { visibleOnly?: boolean } = {}): ClassTime[] {
  const query = db.select(getTableColumns(classTimes)).from(classTimes);
  const rows = visibleOnly
    ? query.innerJoin(classes, eq(classes.id, classTimes.classId)).where(eq(classes.visible, true)).all()
    : query.all();
  return rows.sort(
    (a, b) =>
      WEEKDAYS.indexOf(a.weekday as Weekday) - WEEKDAYS.indexOf(b.weekday as Weekday) ||
      a.from.localeCompare(b.from) ||
      a.id - b.id,
  );
}

export function addClassTime(db: Db, time: NewClassTime): ClassTime {
  validateTime(time);
  return db.insert(classTimes).values(time).returning().get();
}

export function removeClassTime(db: Db, id: number): ClassTime | undefined {
  return db.delete(classTimes).where(eq(classTimes.id, id)).returning().get();
}
