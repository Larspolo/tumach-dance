// The contact messages in the studio app (#533): the store, the push, Nina's answer by email (en and nl, plain and
// HTML), the mark "answered", and the removal after MESSAGE_KEEP_MONTHS in Amsterdam time.
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), sendPush: vi.fn() }));
vi.mock("../src/lib/email", async (orig) => ({ ...(await orig<object>()), sendEmail: mocks.sendEmail }));
vi.mock("../src/lib/push", async (orig) => ({ ...(await orig<object>()), sendPush: mocks.sendPush }));

const dbModule = await import("../src/db");
const { sendContactMessage } = await import("../src/lib/contact");
const store = await import("../src/lib/contact-store");

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const good = { name: "Ana", email: "ana@example.com", message: "Can I come on Sunday?\n\nThanks!" };

let db: ReturnType<typeof dbModule.openDb>;

beforeEach(() => {
  db = dbModule.openDb(":memory:");
  mocks.sendEmail.mockReset().mockResolvedValue(undefined);
  mocks.sendPush.mockReset().mockResolvedValue(1);
  vi.stubEnv("STUDIO_EMAIL", "nina@example.com");
});

describe("a new contact message", () => {
  test("is stored with the language of the visitor, pushed to Nina and emailed to Nina", async () => {
    await sendContactMessage(db, good, "nl");
    const [row] = store.listContactMessages(db);
    expect(row).toMatchObject({ ...good, locale: "nl", answer: null, answeredAt: null });
    expect(store.countUnanswered(db)).toBe(1);
    expect(mocks.sendPush).toHaveBeenCalledOnce();
    const push = mocks.sendPush.mock.calls[0][1]("nl");
    expect(push).toEqual({ title: "Nieuw bericht van Ana", body: good.message, url: "/studio/messages" });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "nina@example.com", replyTo: good.email }),
    );
  });

  test("a failed push still stores the message and sends the email", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.sendPush.mockRejectedValueOnce(new Error("no VAPID"));
    await sendContactMessage(db, good);
    expect(store.listContactMessages(db)).toHaveLength(1);
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  test("an unknown language gives English", () => {
    expect(store.saveContactMessage(db, good, "fr").locale).toBe("en");
  });
});

describe("the answer of Nina", () => {
  test("goes to the visitor as a formatted email in English and marks the message answered", async () => {
    const msg = store.saveContactMessage(db, good, "en", at("2026-11-02T10:00"));
    const result = await store.answerContactMessage(db, msg.id, "  Yes, see you on Sunday!  ", at("2026-11-02T12:00"));
    expect(result).toBe("sent");
    const email = mocks.sendEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: good.email, subject: "Your message to TUMACH", replyTo: "nina@example.com" });
    expect(email.text).toContain("Hi Ana,");
    expect(email.text).toContain("Yes, see you on Sunday!");
    expect(email.text).toContain("Can I come on Sunday?");
    expect(email.html).toContain('lang="en"');
    expect(email.html).toContain("Yes, see you on Sunday!");
    const [row] = store.listContactMessages(db);
    expect(row).toMatchObject({ answer: "Yes, see you on Sunday!", answeredAt: at("2026-11-02T12:00") });
    expect(store.countUnanswered(db)).toBe(0);
  });

  test("is in Dutch for a visitor of the Dutch site, and the HTML escapes the text", async () => {
    const msg = store.saveContactMessage(db, good, "nl");
    await store.answerContactMessage(db, msg.id, "Ja <b>graag</b>");
    const email = mocks.sendEmail.mock.calls[0][0];
    expect(email.subject).toBe("Je bericht aan TUMACH");
    expect(email.html).toContain('lang="nl"');
    expect(email.html).toContain("&lt;b&gt;graag");
  });

  test("an empty answer or an unknown message sends nothing", async () => {
    const msg = store.saveContactMessage(db, good, "en");
    expect(await store.answerContactMessage(db, msg.id, "   ")).toBe("empty");
    expect(await store.answerContactMessage(db, msg.id + 1, "Hi")).toBe("notFound");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  test("a failed email throws and does not mark the message answered", async () => {
    const msg = store.saveContactMessage(db, good, "en");
    mocks.sendEmail.mockRejectedValueOnce(new Error("Mailgun answered 500"));
    await expect(store.answerContactMessage(db, msg.id, "Hi")).rejects.toThrow();
    expect(store.countUnanswered(db)).toBe(1);
  });
});

describe("forgetOldMessages", () => {
  test("removes the messages older than the keep time, in Amsterdam time across summer time", () => {
    expect(store.MESSAGE_KEEP_MONTHS).toBe(6);
    const old = store.saveContactMessage(db, good, "en", at("2026-04-01T09:59"));
    const kept = store.saveContactMessage(db, good, "en", at("2026-04-01T10:01"));
    // 1 October is summer time, 1 April too; the limit is 1 April 10:00 local.
    expect(store.forgetOldMessages(db, at("2026-10-01T10:00"))).toEqual([old.id]);
    expect(store.listContactMessages(db).map((m) => m.id)).toEqual([kept.id]);
    expect(store.forgetOldMessages(db, at("2026-10-01T10:00"))).toEqual([]);
    expect(store.forgetOldMessages(db, at("2026-11-01T10:00"))).toEqual([kept.id]);
  });
});
