import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";

// The privacy page names Nina's private note about a dancer (#698, epic #691), in both languages.
describe("privacy page: the private note about a dancer", () => {
  it("names the note in English", () => {
    const text = en.Privacy.dancerNote;
    expect(text).toMatch(/private note/);
    expect(text).toMatch(/Only Nina sees it/);
    expect(text).toMatch(/other data of the dancer/);
  });

  it("names the note in Dutch", () => {
    const text = nl.Privacy.dancerNote;
    expect(text).toMatch(/persoonlijke notitie/);
    expect(text).toMatch(/Alleen Nina ziet/);
    expect(text).toMatch(/andere gegevens van de danser/);
  });
});
