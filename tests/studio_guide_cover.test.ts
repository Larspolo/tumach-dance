// Each page of the studio app has a part in the guide (#779, epic #774): a new page with no part fails here.
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GUIDE_PARTS } from "@/lib/studio-guide";
import en from "../messages/en.json" with { type: "json" };
import nl from "../messages/nl.json" with { type: "json" };

const STUDIO = join(__dirname, "..", "src", "app", "studio");
const SKIP = new Set(["/studio/login", "/studio/[...rest]"]);

function pages(dir: string, path: string): string[] {
  const found = existsSync(join(dir, "page.tsx")) ? [path] : [];
  for (const entry of readdirSync(dir, { withFileTypes: true }))
    if (entry.isDirectory()) found.push(...pages(join(dir, entry.name), `${path}/${entry.name}`));
  return found;
}

describe("the guide covers the studio app", () => {
  const covered = new Set(GUIDE_PARTS.flatMap((p) => [p.page, ...(p.also ?? [])]));
  const studioPages = pages(STUDIO, "/studio").filter((p) => !SKIP.has(p));

  it("finds the nested pages too", () => {
    expect(studioPages).toContain("/studio/dancer/[id]");
  });
  for (const page of studioPages)
    it(`${page} has a part in the guide`, () => {
      expect(covered.has(page), `${page} has no part in GUIDE_PARTS of src/lib/studio-guide.ts`).toBe(true);
    });

  it("names the button texts of the new parts in each language", () => {
    for (const m of [en, nl]) {
      const g = m.StudioGuide;
      expect(g.hoursOpen).toContain(`"${m.StudioHome.hours}"`);
      expect(g.hoursSave).toContain(`"${m.StudioHours.save}"`);
      expect(g.offersOpen).toContain(`"${m.StudioHome.offers}"`);
      expect(g.offersAdd).toContain(`"${m.StudioOffers.add}"`);
      expect(g.classesOpen).toContain(`"${m.StudioHome.classes}"`);
      expect(g.classesAdd).toContain(`"${m.StudioClasses.add}"`);
      expect(g.classesTime).toContain(`"${m.StudioClasses.addTime}"`);
      expect(g.newsOpen).toContain(`"${m.StudioHome.news}"`);
      expect(g.newsRemove).toContain(`"${m.StudioNews.remove}"`);
      expect(g.photosOpen).toContain(`"${m.StudioHome.photos}"`);
      expect(g.photosAdd).toContain(`"${m.StudioPhotos.add}"`);
      expect(g.photosRemove).toContain(`"${m.StudioPhotos.removeConfirm}"`);
      expect(g.messagesOpen).toContain(`"${m.StudioHome.messages}"`);
      expect(g.messagesSend).toContain(`"${m.StudioMessages.send}"`);
      expect(g.devicesOpen).toContain(`"${m.StudioHome.devices}"`);
      expect(g.devicesLogOut).toContain(`"${m.Devices.logOut}"`);
      expect(g.ninaQuestions).toContain(`"${m.StudioHome.questions}"`);
      expect(g.ninaFeedback).toContain(`"${m.StudioHome.feedback}"`);
      expect(g.ninaFeedback).toContain(`"${m.StudioFeedback.send}"`);
    }
  });
});
