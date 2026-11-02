// The answer of Nina removes `needs-human` (#294): with the label, no run picks the ticket, and the feedback window
// of 6 hours (`framework/tools/feedback.py`) dropped her 14 answers of 2026-10-31 for ever.
import { afterEach, expect, it, vi } from "vitest";
import { postNinaAnswer } from "../src/lib/github";

const env = {
  GITHUB_TOKEN: "t",
  GITHUB_REPO: "o/r",
  GITHUB_API_URL: "https://stub.test",
} as unknown as NodeJS.ProcessEnv;
const body = "## For Nina\nIs it easy?\n- A. Easy\n- B. Not clear\n";

function stub(labels: string[], deleteStatus = 200) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url}`;
    if (key === "GET https://stub.test/repos/o/r/issues/5")
      return new Response(JSON.stringify({ number: 5, title: "Q", body, labels: labels.map((name) => ({ name })) }));
    if (key === "POST https://stub.test/repos/o/r/issues/5/comments") return new Response("{}");
    if (key === "DELETE https://stub.test/repos/o/r/issues/5/labels/needs-human")
      return new Response("[]", { status: deleteStatus });
    return new Response("", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const methods = (fetchMock: ReturnType<typeof stub>) => fetchMock.mock.calls.map(([, init]) => init?.method ?? "GET");

afterEach(() => vi.unstubAllGlobals());

it("removes needs-human after the answer, so that a run picks the ticket", async () => {
  const fetchMock = stub(["for-nina", "needs-human"]);
  await postNinaAnswer(5, { choice: "A", text: "" }, env);
  expect(methods(fetchMock)).toEqual(["GET", "POST", "DELETE"]);
});

it("removes no label when the ticket has no needs-human", async () => {
  const fetchMock = stub(["for-nina"]);
  await postNinaAnswer(5, { choice: "A", text: "" }, env);
  expect(methods(fetchMock)).toEqual(["GET", "POST"]);
});

it("does not fail when the label removal fails: the answer is on the ticket, and a second send makes a copy", async () => {
  const fetchMock = stub(["for-nina", "needs-human"], 403);
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  await expect(postNinaAnswer(5, { choice: "B", text: "Step 2" }, env)).resolves.toBeUndefined();
  expect(methods(fetchMock)).toEqual(["GET", "POST", "DELETE"]);
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});
