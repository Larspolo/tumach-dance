// The questions for Nina on GitHub (#67): list, and post her answer, with a stubbed fetch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { listNinaQuestions, postNinaAnswer } from "../src/lib/github";

const env = { GITHUB_TOKEN: "t", GITHUB_REPO: "o/r", GITHUB_API_URL: "https://stub.test" } as unknown as NodeJS.ProcessEnv;
const body = "## For Nina\nWhich color?\n- A. Red\n- B. Blue\n";

function stub(responses: Record<string, unknown>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    if (!(key in responses)) return new Response("", { status: 404 });
    return new Response(JSON.stringify(responses[key]), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("listNinaQuestions", () => {
  it("gives the parsed questions, with no pull request and no body without For Nina", async () => {
    const fetchMock = stub({
      "GET https://stub.test/repos/o/r/issues?labels=for-nina&state=open&per_page=100": [
        { number: 1, title: "Question for Nina: Color", body, labels: [] },
        { number: 2, title: "PR", body, labels: [], pull_request: {} },
        { number: 3, title: "Other", body: "no section", labels: [] },
      ],
    });
    const questions = await listNinaQuestions(env);
    expect(questions.map((q) => q.number)).toEqual([1]);
    expect(questions[0].choices).toHaveLength(2);
    const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer t");
    expect(headers["X-GitHub-Api-Version"]).toBe("2022-11-28");
  });

  it("gives no question and calls no fetch with no token", async () => {
    const fetchMock = stub({});
    expect(await listNinaQuestions({ GITHUB_REPO: "o/r" } as unknown as NodeJS.ProcessEnv)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("postNinaAnswer", () => {
  it("posts one comment with the choice and the text on the issue", async () => {
    const fetchMock = stub({
      "GET https://stub.test/repos/o/r/issues/1": { number: 1, title: "Q", body, labels: [{ name: "for-nina" }] },
      "POST https://stub.test/repos/o/r/issues/1/comments": {},
    });
    await postNinaAnswer(1, { choice: "B", text: "Blue is calm." }, env);
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(JSON.parse(posts[0][1]?.body as string).body).toBe("Nina's answer: B. Blue\n\nBlue is calm.");
  });

  it("refuses an issue without the label for-nina", async () => {
    const fetchMock = stub({
      "GET https://stub.test/repos/o/r/issues/2": { number: 2, title: "Q", body, labels: [{ name: "bug" }] },
    });
    await expect(postNinaAnswer(2, { choice: "A", text: "" }, env)).rejects.toThrow();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });
});
