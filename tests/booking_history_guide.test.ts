// The guide names "What happened" (the history of a booking, #814) in the part of the week page (#817).
import { describe, expect, it } from "vitest";
import { GUIDE_PARTS } from "@/lib/studio-guide";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

describe("the guide names the history of a booking", () => {
  it("has the line in the part of the week page", () => {
    const fix = GUIDE_PARTS.find((p) => p.id === "fix");
    expect(fix?.page).toBe("/studio/week");
    expect(fix?.steps.map((s) => s.key)).toContain("historyOpen");
  });

  it('names "What happened" in English', () => {
    expect(en.StudioGuide.historyOpen).toContain('"What happened"');
    expect(en.StudioWeek.history).toBe("What happened");
  });

  it('names "Wat er gebeurde" in Dutch', () => {
    expect(nl.StudioGuide.historyOpen).toContain('"Wat er gebeurde"');
    expect(nl.StudioWeek.history).toBe("Wat er gebeurde");
  });
});
