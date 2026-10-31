// The fixed form of a question for Nina in a ticket body (#66), read by the page "For Nina".
import { describe, expect, it } from "vitest";
import { parseNinaQuestion } from "../src/lib/nina-question";

const FORM = `## Goal
Ask Nina about the offers.

## For Nina
Which lesson should the offers page show first?
Try: /studio/offers
- A. The short lesson
- B. The long lesson

## For the owner
Kind: question
`;

describe("parseNinaQuestion", () => {
  it("reads the title, the text, the path and the choices of the form", () => {
    expect(parseNinaQuestion({ number: 7, title: "Question for Nina: Which lesson first?", body: FORM })).toEqual({
      number: 7,
      title: "Which lesson first?",
      text: "Which lesson should the offers page show first?",
      tryPath: "/studio/offers",
      example: null,
      choices: [
        { key: "A", text: "The short lesson" },
        { key: "B", text: "The long lesson" },
      ],
    });
  });

  it("returns null when the body has no section For Nina", () => {
    expect(parseNinaQuestion({ number: 8, title: "Question for Nina: x", body: "## Goal\nNo question." })).toBeNull();
    expect(parseNinaQuestion({ number: 8, title: "x", body: null })).toBeNull();
  });

  it("gives no path for a full URL", () => {
    const body = "## For Nina\nLook at the page.\nTry: https://tumach.dance/studio/offers\n- A. Yes\n- B. No";
    expect(parseNinaQuestion({ number: 9, title: "Question for Nina: x", body })?.tryPath).toBeNull();
  });

  it("gives no choices when the section has none", () => {
    const body = "## For Nina\nDo you like the new colour?\nTry: /\n\n## Verify\nLevel 1.";
    expect(parseNinaQuestion({ number: 10, title: "Question for Nina: x", body })).toEqual({
      number: 10,
      title: "x",
      text: "Do you like the new colour?",
      tryPath: "/",
      example: null,
      choices: [],
    });
  });

  it("ends the section at the next heading", () => {
    const body = "## For Nina\nQuestion?\n- A. One\n## Verify\n- B. Not a choice of Nina";
    expect(parseNinaQuestion({ number: 11, title: "x", body })?.choices).toEqual([{ key: "A", text: "One" }]);
  });
});
