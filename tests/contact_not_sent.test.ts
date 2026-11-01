// A real person whose send looks like a bot (too fast, an old page, the limit) is told that the message was not sent
// (#298): no silent drop. Only the honeypot, which a person never fills, gets the normal thank-you.
import { afterEach, describe, expect, test, vi } from "vitest";

const contact = vi.hoisted(() => ({ sendContactMessage: vi.fn() }));
vi.mock("../src/lib/contact", async (orig) => ({ ...(await orig<object>()), ...contact }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => ({}) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { sendContact } = await import("../src/app/[locale]/contact-action");
const { contactStamp, resetContactLimit } = await import("../src/lib/contact-spam");

const IDLE = { status: "idle" as const, errors: {}, values: { name: "", email: "", message: "" } };
const good = { name: "Ana", email: "ana@example.com", message: "Can I come on Sunday?" };

function form(stamp: string, extra: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("stamp", stamp);
  for (const [key, value] of Object.entries({ ...good, ...extra })) data.set(key, value);
  return data;
}

describe("sendContact of a send that looks like a bot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetContactLimit();
    contact.sendContactMessage.mockReset();
  });

  test("a send less than 3 seconds after the page opens is not sent and the visitor is told", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await sendContact(IDLE, form(contactStamp(Date.now() - 500)));
    expect(state).toEqual({ status: "notSent", errors: {}, values: good });
    expect(contact.sendContactMessage).not.toHaveBeenCalled();
  });

  test("a page older than one day gives the not-sent answer", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await sendContact(IDLE, form(contactStamp(Date.now() - 25 * 60 * 60 * 1000)));
    expect(state.status).toBe("notSent");
  });

  test("the honeypot still gets the normal thank-you and no email", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await sendContact(IDLE, form(contactStamp(Date.now() - 5000), { website: "x" }));
    expect(state.status).toBe("sent");
    expect(contact.sendContactMessage).not.toHaveBeenCalled();
  });
});
