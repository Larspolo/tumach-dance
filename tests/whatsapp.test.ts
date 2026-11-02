import { describe, expect, it } from "vitest";
import { whatsappLink } from "@/lib/whatsapp";

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
