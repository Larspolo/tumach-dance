// The feedback of Nina as a GitHub ticket (#108), with a stubbed fetch.
import { DateTime } from "luxon";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNinaFeedback } from "../src/lib/github";

const env = {
  GITHUB_TOKEN: "t",
  GITHUB_REPO: "o/r",
  GITHUB_API_URL: "https://stub.test",
  SITE_ENV: "live",
} as unknown as NodeJS.ProcessEnv;
// 2026-07-01 10:00 UTC is 12:00 in Amsterdam (summer time); 2026-12-01 10:00 UTC is 11:00 (winter time).
const summer = DateTime.fromISO("2026-07-01T10:00:00Z");

function stub() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ number: 7 }), { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("createNinaFeedback", () => {
  it("posts one issue with the title, the quoted body and the label from-nina", async () => {
    const fetchMock = stub();
    const result = await createNinaFeedback("More classes\nOn Friday too", env, summer);
    expect(result).toEqual({ ok: true, number: 7 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://stub.test/repos/o/r/issues");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      title: "Feedback from Nina: More classes",
      body: "> More classes\n> On Friday too\n\nSent from the studio app (live, 2026-07-01 12:00 Europe/Amsterdam)",
      labels: ["from-nina"],
    });
  });

  it("uses winter time and the preview site", async () => {
    const fetchMock = stub();
    await createNinaFeedback("Hi", { ...env, SITE_ENV: "" }, DateTime.fromISO("2026-12-01T10:00:00Z"));
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(String(init.body)).body).toContain("(preview, 2026-12-01 11:00 Europe/Amsterdam)");
  });

  it("cuts a long first line: the title is at most 80 characters", async () => {
    const fetchMock = stub();
    await createNinaFeedback("x".repeat(200), env, summer);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const { title } = JSON.parse(String(init.body));
    expect(title.length).toBe(80);
  });

  it("refuses an empty or space-only text with no fetch", async () => {
    const fetchMock = stub();
    expect(await createNinaFeedback("", env)).toEqual({ ok: false, error: "empty" });
    expect(await createNinaFeedback("  \n ", env)).toEqual({ ok: false, error: "empty" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls no fetch and gives an error with no GITHUB_TOKEN", async () => {
    const fetchMock = stub();
    const result = await createNinaFeedback("Hi", { ...env, GITHUB_TOKEN: "" });
    expect(result).toEqual({ ok: false, error: "notSent" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives an error when GitHub fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    expect(await createNinaFeedback("Hi", env)).toEqual({ ok: false, error: "notSent" });
  });
});
