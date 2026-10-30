// A question that Nina answered does not show again until a run asks a follow-up (#178), with a stubbed fetch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { countNinaQuestions, listNinaQuestions } from "../src/lib/github";

const env = {
  GITHUB_TOKEN: "t",
  GITHUB_REPO: "o/r",
  GITHUB_API_URL: "https://stub.test",
} as unknown as NodeJS.ProcessEnv;
const body = "## For Nina\nWhich color?\n- A. Red\n- B. Blue\n";
const api = "GET https://stub.test/repos/o/r";

function stub(responses: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${url}`;
      if (!(key in responses)) return new Response("", { status: 404 });
      return new Response(JSON.stringify(responses[key]), { status: 200 });
    }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("answered questions", () => {
  it("leaves out a question whose last comment is an answer of Nina, keeps a follow-up and one with no comments", async () => {
    stub({
      [`${api}/issues?labels=for-nina&state=open&per_page=100`]: [
        { number: 1, title: "Answered", body, labels: [], comments: 2 },
        { number: 2, title: "Follow-up", body, labels: [], comments: 2 },
        { number: 3, title: "New", body, labels: [], comments: 0 },
      ],
      [`${api}/issues/1/comments?per_page=100`]: [{ body: "A run note" }, { body: "Nina's answer: B. Blue" }],
      [`${api}/issues/2/comments?per_page=100`]: [{ body: "Nina's answer: A. Red" }, { body: "And the size?" }],
    });
    expect((await listNinaQuestions(env)).map((q) => q.number)).toEqual([2, 3]);
    expect(await countNinaQuestions(env)).toBe(2);
  });
});
