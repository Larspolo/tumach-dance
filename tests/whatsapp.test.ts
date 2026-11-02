import { describe, expect, it } from "vitest";
import { bookingWhatsappLink, whatsappLink } from "@/lib/whatsapp";

describe("whatsappLink", () => {
  it("gives the link of a Dutch number", () => {
    expect(whatsappLink("06 12345678", "Hoi")).toBe("https://wa.me/31612345678?text=Hoi");
  });

  it("gives the link of a foreign number", () => {
    expect(whatsappLink("+44 7700 900123", "Hi")).toBe("https://wa.me/447700900123?text=Hi");
  });

  it("encodes the text", () => {
    expect(whatsappLink("06 12345678", "a b&c")).toBe("https://wa.me/31612345678?text=a%20b%26c");
  });

  it("gives null for a number it cannot read", () => {
    expect(whatsappLink("abc", "Hi")).toBeNull();
  });

  it("gives null for an empty phone (a removed dancer)", () => {
    expect(whatsappLink("", "Hi")).toBeNull();
  });
});

describe("bookingWhatsappLink", () => {
  const start = Date.UTC(2033, 5, 7, 8, 0); // 10:00 in Amsterdam, summer time
  const booking = { phone: "06 12345678", locale: "en", name: "Sam", start, forgottenAt: null };

  it("writes the first line in the language of the booking", () => {
    const nl = bookingWhatsappLink({ ...booking, locale: "nl" });
    const text = decodeURIComponent(nl?.split("text=")[1] ?? "");
    expect(text).toBe("Hoi Sam, over je boeking op di 7 jun, 10:00: ");
  });

  it("writes the first line in English for an English booking", () => {
    const en = bookingWhatsappLink(booking);
    expect(decodeURIComponent(en?.split("text=")[1] ?? "")).toBe(
      "Hi Sam, about your booking on Tue, Jun 7, 10:00 AM: ",
    );
  });

  it("gives null for a removed dancer", () => {
    expect(bookingWhatsappLink({ ...booking, forgottenAt: start })).toBeNull();
  });
});
