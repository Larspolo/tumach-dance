import { expect, test } from "vitest";
import { routing } from "../src/i18n/routing";
import { removedLocalePath } from "../src/proxy";

// Slovenian is removed (#299): its old addresses go to the English page.
test("the site has English and Dutch only", () => {
  expect(routing.locales).toEqual(["en", "nl"]);
});

test("/sl and /sl/... go to the English page", () => {
  expect(removedLocalePath("/sl")).toBe("/en");
  expect(removedLocalePath("/sl/book")).toBe("/en/book");
  expect(removedLocalePath("/sl/booking/cancel")).toBe("/en/booking/cancel");
  expect(removedLocalePath("/slow")).toBeUndefined();
  expect(removedLocalePath("/nl/book")).toBeUndefined();
});
