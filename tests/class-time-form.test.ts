// The weekly times of a class (#97): add, remove; an end before the start or no session changes nothing.
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { addClass, listClassTimes } from "../src/db/classes";
import { applyClassTimeForm } from "../src/lib/class-time-form";

const SESSION = { user: { email: "nina@example.test" } };

function form(fields: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, String(v));
  return data;
}

function dbWithClass() {
  const db = openDb(":memory:");
  const cls = addClass(db, { name: { en: "Salsa" }, text: { en: "Fun." }, forWhom: { en: "All" }, position: 1 });
  return { db, classId: cls.id };
}

describe("applyClassTimeForm", () => {
  it("adds a time and removes it", () => {
    const { db, classId } = dbWithClass();
    const add = form({ intent: "addTime", classId, weekday: "tue", from: "19:00", to: "20:30" });
    expect(applyClassTimeForm(db, SESSION, add)).toBe("added");
    const [time] = listClassTimes(db);
    expect(time).toMatchObject({ classId, weekday: "tue", from: "19:00", to: "20:30" });
    expect(applyClassTimeForm(db, SESSION, form({ intent: "removeTime", id: time?.id ?? 0 }))).toBe("removed");
    expect(listClassTimes(db)).toEqual([]);
  });

  it("adds nothing and gives the error for an end that is not after the start", () => {
    const { db, classId } = dbWithClass();
    for (const to of ["18:00", "19:00", ""]) {
      const add = form({ intent: "addTime", classId, weekday: "tue", from: "19:00", to });
      expect(applyClassTimeForm(db, SESSION, add)).toBe("wrong");
    }
    expect(
      applyClassTimeForm(db, SESSION, form({ intent: "addTime", classId, weekday: "x", from: "1", to: "2" })),
    ).toBe("wrong");
    expect(listClassTimes(db)).toEqual([]);
  });

  it("changes nothing without a session or for a class that does not exist", () => {
    const { db, classId } = dbWithClass();
    const add = { intent: "addTime", weekday: "tue", from: "19:00", to: "20:30" };
    expect(applyClassTimeForm(db, null, form({ ...add, classId }))).toBe("none");
    expect(applyClassTimeForm(db, SESSION, form({ ...add, classId: classId + 1 }))).toBe("none");
    applyClassTimeForm(db, SESSION, form({ ...add, classId }));
    const id = listClassTimes(db)[0]?.id ?? 0;
    expect(applyClassTimeForm(db, undefined, form({ intent: "removeTime", id }))).toBe("none");
    expect(listClassTimes(db)).toHaveLength(1);
  });
});
