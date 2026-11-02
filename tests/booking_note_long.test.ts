// The message of a note that is too long (#402): the dancer learns the limit of the note, not a wrong name or email.
import { expect, test } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import { bookingError } from "../src/lib/booking-error";

test("a note of 501 characters gives the note message, not the invalid one", () => {
  expect(bookingError({ ok: false, reason: "invalid", field: "note" })).toBe("noteLong");
});

test("a bad name, email or phone still gives the invalid message", () => {
  expect(bookingError({ ok: false, reason: "invalid", field: "email" })).toBe("invalid");
  expect(bookingError({ ok: false, reason: "taken" })).toBe("taken");
});

test("the hint and the message name the limit of 500 characters in both languages", () => {
  for (const messages of [en, nl]) {
    expect(messages.Book.noteHint).toContain("{max}");
    expect(messages.Book.noteLong).toContain("{max}");
  }
  expect(en.Book.noteLong.replace("{max}", "500")).toContain("500 characters");
  expect(nl.Book.noteLong.replace("{max}", "500")).toContain("500 tekens");
});
