// The links to the accounts of the studio (#451).
import { expect, test } from "vitest";
import { studioAccounts } from "../src/lib/studio-accounts";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

test("no value gives no link", () => {
  expect(studioAccounts(env({}))).toEqual([]);
  expect(studioAccounts(env({ STUDIO_INSTAGRAM: " ", STUDIO_WHATSAPP: "" }))).toEqual([]);
});

test("an Instagram name, also with @ and spaces, gives the profile link", () => {
  for (const value of ["tumach.dance", "@tumach.dance", " tumach.dance "]) {
    expect(studioAccounts(env({ STUDIO_INSTAGRAM: value }))).toEqual([
      { kind: "instagram", href: "https://www.instagram.com/tumach.dance/", handle: "@tumach.dance" },
    ]);
  }
});

test("a name with other signs gives no link", () => {
  expect(studioAccounts(env({ STUDIO_INSTAGRAM: "a/b?c" }))).toEqual([]);
});

test("a WhatsApp number with spaces or a + gives only its digits", () => {
  expect(studioAccounts(env({ STUDIO_WHATSAPP: "+31 6 1234 5678" }))).toEqual([
    { kind: "whatsapp", href: "https://wa.me/31612345678", handle: "" },
  ]);
});

test("both: Instagram first", () => {
  const kinds = studioAccounts(env({ STUDIO_INSTAGRAM: "x", STUDIO_WHATSAPP: "31600000000" })).map((a) => a.kind);
  expect(kinds).toEqual(["instagram", "whatsapp"]);
});
