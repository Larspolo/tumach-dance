// A push to Nina for a new question (#69): one push per question, also with two checks at once and after a restart.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import type { NinaQuestion } from "../src/lib/nina-question";
import type { PushLocale, PushMessage } from "../src/lib/push";

const listNinaQuestions = vi.fn<() => Promise<NinaQuestion[]>>();
const sendPush = vi.fn<(db: unknown, message: (locale: PushLocale) => PushMessage) => Promise<number>>();
vi.mock("../src/lib/github", () => ({ listNinaQuestions }));
vi.mock("../src/lib/push", () => ({ sendPush }));

const { checkNewQuestions, startQuestionTimer } = await import("../src/lib/nina-notify");

const dir = mkdtempSync(join(tmpdir(), "nina-notify-"));
let n = 0;
const tempDb = () => join(dir, `${++n}.db`);

const question = (number: number): NinaQuestion => ({
  number,
  title: "Q",
  text: "Which?",
  tryPath: null,
  example: null,
  choices: [],
});

beforeEach(() => {
  listNinaQuestions.mockReset();
  sendPush.mockReset();
  // A push takes time: a second check at the same time must not send while the first one waits.
  sendPush.mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(1), 5)));
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("two checks with the same question send one push, a new question one more", async () => {
  const db = openDb(tempDb());
  listNinaQuestions.mockResolvedValue([question(7)]);
  expect(await checkNewQuestions(db)).toEqual([7]);
  expect(await checkNewQuestions(db)).toEqual([]);
  expect(sendPush).toHaveBeenCalledTimes(1);

  listNinaQuestions.mockResolvedValue([question(7), question(9)]);
  expect(await checkNewQuestions(db)).toEqual([9]);
  expect(sendPush).toHaveBeenCalledTimes(2);
});

test("two checks at the same time send one push for one new question", async () => {
  const db = openDb(tempDb());
  listNinaQuestions.mockResolvedValue([question(3)]);
  await Promise.all([checkNewQuestions(db), checkNewQuestions(db)]);
  expect(sendPush).toHaveBeenCalledTimes(1);
});

test("a check after a restart sends nothing for the stored questions", async () => {
  const path = tempDb();
  listNinaQuestions.mockResolvedValue([question(1), question(2)]);
  await checkNewQuestions(openDb(path));
  expect(sendPush).toHaveBeenCalledTimes(2);

  vi.resetModules();
  const restarted = await import("../src/lib/nina-notify");
  const { openDb: openAgain } = await import("../src/db");
  expect(await restarted.checkNewQuestions(openAgain(path))).toEqual([]);
  expect(sendPush).toHaveBeenCalledTimes(2);
});

test("a push that fails (no VAPID keys) is tried again at the next check", async () => {
  const db = openDb(tempDb());
  listNinaQuestions.mockResolvedValue([question(4)]);
  sendPush.mockRejectedValueOnce(new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are not set"));
  await expect(checkNewQuestions(db)).rejects.toThrow(/VAPID/);
  expect(await checkNewQuestions(db)).toEqual([4]);
});

test("the push links to the page For Nina in the language of each device", async () => {
  listNinaQuestions.mockResolvedValue([question(5)]);
  await checkNewQuestions(openDb(tempDb()));
  const message = sendPush.mock.calls[0][1];
  expect(message("en")).toEqual({
    title: "A new question for you",
    body: "Open it in the studio app and give your answer.",
    url: "/studio/questions",
  });
  expect(message("nl").title).toBe("Een nieuwe vraag voor jou");
  expect(message("sl").title).toBe("Novo vprašanje zate");
});

test("with no GITHUB_TOKEN no timer starts", () => {
  const setInterval = vi.spyOn(globalThis, "setInterval");
  expect(startQuestionTimer(openDb(":memory:"), {} as NodeJS.ProcessEnv)).toBeNull();
  expect(setInterval).not.toHaveBeenCalled();
  expect(listNinaQuestions).not.toHaveBeenCalled();
  setInterval.mockRestore();
});

test("with a GITHUB_TOKEN the timer checks now and every 5 minutes, and an error does not stop it", async () => {
  vi.useFakeTimers();
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  listNinaQuestions.mockRejectedValue(new Error("GitHub GET /issues: 502"));
  const timer = startQuestionTimer(openDb(":memory:"), { GITHUB_TOKEN: "t" } as unknown as NodeJS.ProcessEnv);
  expect(timer).not.toBeNull();
  await vi.advanceTimersByTimeAsync(10 * 60_000);
  expect(listNinaQuestions).toHaveBeenCalledTimes(3);
  expect(error).toHaveBeenCalledTimes(1);
  clearInterval(timer as NodeJS.Timeout);
  delete (globalThis as { tumachQuestionTimer?: unknown }).tumachQuestionTimer;
  error.mockRestore();
  vi.useRealTimers();
});
