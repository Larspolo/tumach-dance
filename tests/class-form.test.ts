// The form of the classes page (#96): add, change, hide; nothing with no English name or no session.
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { addClass, listClasses } from "../src/db/classes";
import { applyClassForm } from "../src/lib/class-form";

const SESSION = { user: { email: "nina@example.test" } };
const TEXTS = { name_en: "Salsa", text_en: "Turns and fun.", forWhom_en: "Beginners" };

function form(fields: Record<string, string | number>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, String(v));
  return data;
}

describe("applyClassForm", () => {
  it("adds a class at the end, changes its text and hides it", () => {
    const db = openDb(":memory:");
    addClass(db, { name: { en: "Tango" }, text: { en: "Close." }, forWhom: { en: "All" }, position: 2 });
    expect(applyClassForm(db, SESSION, form({ intent: "add", ...TEXTS, name_nl: "Salsa NL" }))).toBe(true);
    const added = listClasses(db).at(-1);
    expect(added).toMatchObject({ name: { en: "Salsa", nl: "Salsa NL" }, position: 3, visible: true });
    const id = added?.id ?? 0;
    expect(applyClassForm(db, SESSION, form({ intent: "save", id, ...TEXTS, text_en: "New text." }))).toBe(true);
    expect(applyClassForm(db, SESSION, form({ intent: "hide", id }))).toBe(true);
    expect(listClasses(db).at(-1)).toMatchObject({ text: { en: "New text." }, visible: false });
    expect(applyClassForm(db, SESSION, form({ intent: "show", id }))).toBe(true);
    expect(listClasses(db, { visibleOnly: true })).toHaveLength(2);
  });

  it("changes nothing with no English name", () => {
    const db = openDb(":memory:");
    const cls = addClass(db, { name: { en: "Tango" }, text: { en: "Close." }, forWhom: { en: "All" }, position: 1 });
    expect(applyClassForm(db, SESSION, form({ intent: "add", ...TEXTS, name_en: " ", name_nl: "Salsa" }))).toBe(false);
    expect(applyClassForm(db, SESSION, form({ intent: "save", id: cls.id, ...TEXTS, name_en: "" }))).toBe(false);
    expect(listClasses(db)).toEqual([cls]);
  });

  it("changes nothing without a session", () => {
    const db = openDb(":memory:");
    const cls = addClass(db, { name: { en: "Tango" }, text: { en: "Close." }, forWhom: { en: "All" }, position: 1 });
    expect(applyClassForm(db, null, form({ intent: "add", ...TEXTS }))).toBe(false);
    expect(applyClassForm(db, null, form({ intent: "hide", id: cls.id }))).toBe(false);
    expect(applyClassForm(db, undefined, form({ intent: "save", id: cls.id, ...TEXTS }))).toBe(false);
    expect(listClasses(db)).toEqual([cls]);
  });
});
