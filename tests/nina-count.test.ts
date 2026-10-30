// The number of open questions for Nina on the start page (#130), with a stubbed fetch.
import { afterEach, describe, expect, it, vi } from "vitest";
import { countNinaQuestions } from "../src/lib/github";

const env = {
  GITHUB_TOKEN: "t",
  GITHUB_REPO: "o/r",
  GITHUB_API_URL: "https://stub.test",
} as unknown as NodeJS.ProcessEnv;
const body = "## For Nina\nWhich color?\n- A. Red\n";

afterEach(() => vi.unstubAllGlobals());

describe("countNinaQuestions", () => {
  it("counts the open questions", async () => {
    const issues = [1, 2].map((number) => ({ number, title: "Q", body, labels: [] }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(issues), { status: 200 })),
    );
    expect(await countNinaQuestions(env)).toBe(2);
  });

  it("gives null when GitHub fails, so the start page still shows", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    expect(await countNinaQuestions(env)).toBeNull();
  });

  it("gives 0 with no token", async () => {
    expect(await countNinaQuestions({} as NodeJS.ProcessEnv)).toBe(0);
  });
});
