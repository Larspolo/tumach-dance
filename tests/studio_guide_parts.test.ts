// The parts of the guide (#776): each key is in both languages, at most 3 steps, and each part names a studio page.
import { describe, expect, it } from "vitest";
import { GUIDE_PARTS } from "@/lib/studio-guide";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

describe("GUIDE_PARTS", () => {
  it("has the 7 parts in order", () => {
    expect(GUIDE_PARTS.map((p) => p.id)).toEqual([
      "login",
      "install",
      "notifications",
      "approve",
      "add",
      "block",
      "move",
    ]);
  });
  for (const part of GUIDE_PARTS) {
    it(`${part.id}: its texts are in en and nl, with at most 3 steps`, () => {
      expect(part.page).toMatch(/^\/studio(\/|$)/);
      expect(part.steps.length).toBeGreaterThan(0);
      expect(part.steps.length).toBeLessThanOrEqual(3);
      for (const key of [part.title, ...part.steps.map((s) => s.key)])
        for (const m of [en, nl]) expect((m.StudioGuide as Record<string, string>)[key], key).toBeTruthy();
    });
  }
  it("names the button texts of the app in each language", () => {
    for (const m of [en, nl]) {
      expect(m.StudioGuide.approveTap).toContain(`"${m.StudioBookings.approve}"`);
      expect(m.StudioGuide.addOpen).toContain(`"${m.StudioWeek.lessonAdd}"`);
      expect(m.StudioGuide.blockOpen).toContain(`"${m.StudioWeek.blockAdd}"`);
      expect(m.StudioGuide.moveOpen).toContain(`"${m.StudioWeek.move}"`);
      expect(m.StudioGuide.moveYes).toContain(`"${m.StudioWeek.moveYes}"`);
    }
  });
});
