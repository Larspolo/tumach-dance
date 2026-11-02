import { describe, expect, it } from "vitest";
import { emailSuggestion } from "@/lib/email-typo";

describe("emailSuggestion (#493)", () => {
  it("fixes a typo of a common provider", () => {
    expect(emailSuggestion("a@gmial.com")).toBe("a@gmail.com");
    expect(emailSuggestion("a@hotmal.com")).toBe("a@hotmail.com");
  });
  it("gives null for a correct or unknown domain", () => {
    expect(emailSuggestion("a@gmail.com")).toBeNull();
    expect(emailSuggestion("a@studio-x.nl")).toBeNull();
    expect(emailSuggestion("a@example.test")).toBeNull();
  });
});
