// The parts of the guide (#776): each key is in both languages, at most 3 steps, and each part names a studio page.
import { describe, expect, it } from "vitest";
import { GUIDE_PARTS } from "@/lib/studio-guide";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

describe("GUIDE_PARTS", () => {
  it("has the 25 parts in order", () => {
    expect(GUIDE_PARTS.map((p) => p.id)).toEqual([
      "login",
      "install",
      "notifications",
      "approve",
      "add",
      "block",
      "move",
      "repeat",
      "sick",
      "holiday",
      "fix",
      "forget",
      "money",
      "search",
      "note",
      "whatsapp",
      "share",
      "hours",
      "offers",
      "classes",
      "news",
      "photos",
      "messages",
      "devices",
      "nina",
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
      expect(m.StudioGuide.repeatOpen).toContain(`"${m.StudioWeek.repeat}"`);
      expect(m.StudioGuide.repeatSave).toContain(`"${m.StudioWeek.repeatYes}"`);
      expect(m.StudioGuide.sickOpen).toContain(`"${m.StudioWeek.cancelDay}"`);
      expect(m.StudioGuide.sickYes).toContain(`"${m.StudioWeek.cancelDayYes}"`);
      expect(m.StudioGuide.holidayClose).toContain(`"${m.StudioHome.hours}"`);
      expect(m.StudioGuide.holidayClose).toContain(`"${m.StudioHours.close}"`);
      expect(m.StudioGuide.holidayList).toContain(`"${m.StudioHours.outsideTitle}"`);
      expect(m.StudioGuide.holidayCancel).toContain(`"${m.StudioHours.outsideCancel}"`);
      expect(m.StudioGuide.holidayCancel).toContain(`"${m.StudioHours.outsideYes}"`);
      expect(m.StudioGuide.fixOpen).toContain(`"${m.StudioWeek.fix}"`);
      expect(m.StudioGuide.fixSave).toContain(`"${m.StudioWeek.fixSave}"`);
      expect(m.StudioGuide.forgetOpen).toContain(`"${m.StudioWeek.forget}"`);
      expect(m.StudioGuide.forgetYes).toContain(`"${m.StudioWeek.forgetYes}"`);
      expect(m.StudioGuide.moneyOpen).toContain(`"${m.StudioHome.money}"`);
      expect(m.StudioGuide.moneyOpen).toContain(`"${m.StudioMoney.open}"`);
      expect(m.StudioGuide.moneyPaid).toContain(`"${m.StudioBookings.markPaid}"`);
      expect(m.StudioGuide.moneyYear).toContain(m.StudioMoney.yearDownload.replace("{year}", "…"));
      expect(m.StudioGuide.searchOpen).toContain(`"${m.StudioHome.search}"`);
      expect(m.StudioGuide.searchType).toContain(`"${m.StudioSearch.button}"`);
      expect(m.StudioGuide.noteOpen).toContain(`"${m.StudioDancer.link}"`);
      expect(m.StudioGuide.noteSave).toContain(`"${m.StudioDancer.noteSave}"`);
      expect(m.StudioGuide.whatsappOpen).toContain(`"${m.StudioHome.bookings}"`);
      expect(m.StudioGuide.whatsappOpen).toContain(`"${m.StudioBookings.whatsapp}"`);
      expect(m.StudioGuide.shareOpen).toContain(`"${m.StudioHome.offers}"`);
      expect(m.StudioGuide.shareOpen).toContain(`"${m.StudioShare.share}"`);
    }
  });
});
