// The classes of the studio and their weekly times (#95).
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import {
  addClass,
  addClassTime,
  hideClass,
  listClasses,
  listClassTimes,
  removeClassTime,
  updateClass,
} from "../src/db/classes";

const salsa = { name: { en: "Salsa" }, text: { en: "Social dance" }, forWhom: { en: "Everyone" }, position: 1 };

test("add, change, hide and list a class", () => {
  const db = openDb(":memory:");
  const a = addClass(db, salsa);
  const b = addClass(db, { ...salsa, name: { en: "Ballet", nl: "Ballet" }, position: 0 });
  expect(a.visible).toBe(true);
  expect(listClasses(db).map((c) => c.name.en)).toEqual(["Ballet", "Salsa"]);
  expect(updateClass(db, a.id, { name: { en: "Salsa", sl: "Salsa" } })?.name).toEqual({ en: "Salsa", sl: "Salsa" });
  expect(hideClass(db, b.id)?.visible).toBe(false);
  expect(listClasses(db, { visibleOnly: true }).map((c) => c.id)).toEqual([a.id]);
  expect(listClasses(db)).toHaveLength(2);
});

test("add, list and remove the weekly times, Monday to Sunday then by start", () => {
  const db = openDb(":memory:");
  const { id } = addClass(db, salsa);
  addClassTime(db, { classId: id, weekday: "wed", from: "19:00", to: "20:00" });
  const late = addClassTime(db, { classId: id, weekday: "mon", from: "20:30", to: "21:30" });
  addClassTime(db, { classId: id, weekday: "mon", from: "09:00", to: "10:00" });
  expect(listClassTimes(db).map((t) => [t.weekday, t.from])).toEqual([
    ["mon", "09:00"],
    ["mon", "20:30"],
    ["wed", "19:00"],
  ]);
  expect(removeClassTime(db, late.id)?.from).toBe("20:30");
  expect(listClassTimes(db)).toHaveLength(2);
});

test("visibleOnly leaves out the times of a hidden class", () => {
  const db = openDb(":memory:");
  const shown = addClass(db, salsa);
  const hidden = addClass(db, { ...salsa, name: { en: "Hip hop" }, position: 2 });
  addClassTime(db, { classId: shown.id, weekday: "fri", from: "18:00", to: "19:00" });
  addClassTime(db, { classId: hidden.id, weekday: "fri", from: "20:00", to: "21:00" });
  hideClass(db, hidden.id);
  expect(listClassTimes(db, { visibleOnly: true }).map((t) => t.classId)).toEqual([shown.id]);
  expect(listClassTimes(db)).toHaveLength(2);
});

test("a class with no English name, a bad weekday, a bad time or a to before from is refused", () => {
  const db = openDb(":memory:");
  expect(() => addClass(db, { ...salsa, name: { en: " " } })).toThrow(RangeError);
  expect(() => addClass(db, { ...salsa, name: { en: "" } as { en: string } })).toThrow(RangeError);
  const { id } = addClass(db, salsa);
  expect(() => updateClass(db, id, { text: { nl: "Sociale dans" } as unknown as { en: string } })).toThrow(RangeError);
  expect(() => addClassTime(db, { classId: id, weekday: "funday" as "mon", from: "10:00", to: "11:00" })).toThrow(
    RangeError,
  );
  expect(() => addClassTime(db, { classId: id, weekday: "mon", from: "9:00", to: "11:00" })).toThrow(RangeError);
  expect(() => addClassTime(db, { classId: id, weekday: "mon", from: "10:00", to: "24:00" })).toThrow(RangeError);
  expect(() => addClassTime(db, { classId: id, weekday: "mon", from: "10:00", to: "10:00" })).toThrow(RangeError);
  expect(() => addClassTime(db, { classId: id, weekday: "mon", from: "11:00", to: "10:00" })).toThrow(RangeError);
  expect(listClassTimes(db)).toHaveLength(0);
});
