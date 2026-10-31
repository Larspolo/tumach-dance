// The form of the weekly times of a class (#97): read a plain HTML form and change the class_times table.
// Apart from the server action, so that a test runs it with no Next.js request.
import type { Db } from "../db";
import { addClassTime, listClasses, removeClassTime } from "../db/classes";
import type { Weekday } from "./hours";

export const CLASS_WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** "added", "removed", "wrong" (a time that is not valid, or an end that is not after the start) or "none". */
export type ClassTimeResult = "added" | "removed" | "wrong" | "none";

/**
 * Apply one submit of the form. `intent`: "addTime" (`classId`, `weekday`, `from`, `to`) or "removeTime" (`id`).
 * With no session it changes nothing.
 */
export function applyClassTimeForm(db: Db, session: unknown, form: FormData): ClassTimeResult {
  if (!session) return "none";
  const intent = form.get("intent");
  if (intent === "removeTime") {
    const id = Number(form.get("id"));
    return Number.isInteger(id) && removeClassTime(db, id) ? "removed" : "none";
  }
  if (intent !== "addTime") return "none";
  const classId = Number(form.get("classId"));
  if (!listClasses(db).some((c) => c.id === classId)) return "none";
  const weekday = CLASS_WEEKDAYS.find((d) => d === form.get("weekday"));
  if (!weekday) return "wrong";
  try {
    addClassTime(db, { classId, weekday, from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") });
  } catch (error) {
    if (error instanceof RangeError) return "wrong";
    throw error;
  }
  return "added";
}
