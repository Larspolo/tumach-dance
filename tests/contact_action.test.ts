// The server action of the contact form (#152): a bad form gives the field errors and sends nothing, a failed email
// gives the general error and keeps the text of the visitor.
import { afterEach, describe, expect, test, vi } from "vitest";

const contact = vi.hoisted(() => ({ sendContactMessage: vi.fn() }));
vi.mock("../src/lib/contact", async (orig) => ({ ...(await orig<object>()), ...contact }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => ({}) }));

const { sendContact } = await import("../src/app/[locale]/contact-action");

const IDLE = { status: "idle" as const, errors: {}, values: { name: "", email: "", message: "" } };
const good = { name: "Ana", email: "ana@example.com", message: "Can I come on Sunday?" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("sendContact", () => {
  afterEach(() => vi.restoreAllMocks());

  test("a good form is sent", async () => {
    contact.sendContactMessage.mockResolvedValueOnce(undefined);
    const state = await sendContact(IDLE, form(good));
    expect(state.status).toBe("sent");
    expect(contact.sendContactMessage).toHaveBeenCalledWith({}, good);
  });

  test("a bad form gives the field errors, keeps the name and sends nothing", async () => {
    contact.sendContactMessage.mockClear();
    const state = await sendContact(IDLE, form({ name: "Ana", email: "bad", message: "" }));
    expect(state).toEqual({
      status: "invalid",
      errors: { email: "Contact.errors.email", message: "Contact.errors.message" },
      values: { name: "Ana", email: "bad", message: "" },
    });
    expect(contact.sendContactMessage).not.toHaveBeenCalled();
  });

  test("a failed email gives the general error, not the thank-you", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    contact.sendContactMessage.mockRejectedValueOnce(new Error("Mailgun answered 500"));
    const state = await sendContact(IDLE, form(good));
    expect(state).toEqual({ status: "failed", errors: {}, values: good });
    expect(console.error).toHaveBeenCalled();
  });
});
