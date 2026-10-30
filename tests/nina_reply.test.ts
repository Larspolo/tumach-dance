// A reply of a run to the answer of Nina does not ask her again; a follow-up with `## For Nina` does (#195).
import { afterEach, describe, expect, it, vi } from "vitest";
import { listNinaQuestions } from "../src/lib/github";

const env = {
  GITHUB_TOKEN: "t",
  GITHUB_REPO: "o/r",
  GITHUB_API_URL: "https://stub.test",
} as unknown as NodeJS.ProcessEnv;
const body = "## For Nina\nRefunds?\n- A. Yes\n- B. No\n";
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

describe("a reply after the answer of Nina", () => {
  it("hides a question with a run reply after her answer, shows one with a follow-up question", async () => {
    stub({
      [`${api}/issues?labels=for-nina&state=open&per_page=100`]: [
        { number: 1, title: "Replied", body, labels: [], comments: 2 },
        { number: 2, title: "Follow-up", body, labels: [], comments: 3 },
      ],
      [`${api}/issues/1/comments?per_page=100`]: [
        { body: "Nina's answer: B. No" },
        { body: "Thank you. Rule: no refunds." },
      ],
      [`${api}/issues/2/comments?per_page=100`]: [
        { body: "Nina's answer: B. No" },
        { body: "Thank you." },
        { body: "One more:\n\n## For Nina\nAlso no refund for a sick day?\n- A. Yes\n- B. No" },
      ],
    });
    expect((await listNinaQuestions(env)).map((q) => q.number)).toEqual([2]);
  });
});
