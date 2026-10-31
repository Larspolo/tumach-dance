// A text question for Nina (no choices) is not sent empty (#259): the server action checks it, not only the browser.
import { afterEach, describe, expect, it, vi } from "vitest";

const postNinaAnswer = vi.fn();
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/lib/auth", () => ({ getStudioSession: async () => ({ user: { id: "nina" } }) }));
vi.mock("@/lib/github", () => ({ postNinaAnswer }));

const { sendAnswer } = await import("../src/app/studio/questions/actions");
const start = { error: false, choice: null, text: "" };

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

afterEach(() => postNinaAnswer.mockReset());

describe("text question", () => {
  it("posts nothing for an answer of only spaces", async () => {
    const state = await sendAnswer(start, form({ number: "7", text: "   \n " }));
    expect(state).toMatchObject({ error: false, empty: true });
    expect(postNinaAnswer).not.toHaveBeenCalled();
  });

  it("posts a text answer", async () => {
    await expect(sendAnswer(start, form({ number: "7", text: "About me" }))).rejects.toThrow("redirect");
    expect(postNinaAnswer).toHaveBeenCalledWith(7, { choice: null, text: "About me" });
  });

  it("posts a choice with no text", async () => {
    await expect(sendAnswer(start, form({ number: "7", choice: "A", text: "" }))).rejects.toThrow("redirect");
    expect(postNinaAnswer).toHaveBeenCalledWith(7, { choice: "A", text: "" });
  });
});
