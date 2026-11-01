// The contact message of a visitor to Nina (#150): the checks of the form, the email through the log transport, the
// language of Nina's newest device, and the Reply-To of the Mailgun request (a stubbed fetch).
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { type Contact, contactEmail, parseContact, sendContactMessage } from "../src/lib/contact";
import { sendEmail } from "../src/lib/email";
import { saveSubscription } from "../src/lib/push";

const good: Contact = { name: "Ana", email: "ana@example.com", message: "Can I come on Sunday?" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("parseContact", () => {
  test("accepts a good form and trims each value", () => {
    const result = parseContact(form({ name: "  Ana ", email: " ana@example.com ", message: " Hi \n there " }));
    expect(result).toEqual({ ok: true, value: { name: "Ana", email: "ana@example.com", message: "Hi \n there" } });
  });

  test("gives the error of each bad field", () => {
    const result = parseContact(form({ name: "", email: "ana.example.com", message: "  " }));
    expect(result).toEqual({
      ok: false,
      errors: {
        name: "Contact.errors.name",
        email: "Contact.errors.email",
        message: "Contact.errors.message",
      },
    });
  });

  test("a name of 101 characters or a line break in the name is an error", () => {
    expect(parseContact(form({ name: "a".repeat(101), email: "a@b.nl", message: "Hi" }))).toMatchObject({
      ok: false,
      errors: { name: "Contact.errors.name" },
    });
    expect(parseContact(form({ name: "Ana\nBob", email: "a@b.nl", message: "Hi" }))).toMatchObject({
      ok: false,
      errors: { name: "Contact.errors.name" },
    });
  });

  test("a message of 5001 characters is an error, 5000 is not", () => {
    expect(parseContact(form({ name: "Ana", email: "a@b.nl", message: "m".repeat(5000) })).ok).toBe(true);
    expect(parseContact(form({ name: "Ana", email: "a@b.nl", message: "m".repeat(5001) }))).toMatchObject({
      ok: false,
      errors: { message: "Contact.errors.message" },
    });
  });

  test("an email with two @ signs, a space or no dot in the domain is an error", () => {
    for (const email of ["a@@b.nl", "a b@c.nl", "a@bnl", "a@b.nl@x"]) {
      expect(parseContact(form({ name: "Ana", email, message: "Hi" }))).toMatchObject({
        ok: false,
        errors: { email: "Contact.errors.email" },
      });
    }
  });
});

describe("contact email", () => {
  let dir: string;
  let saved: NodeJS.ProcessEnv;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "contact-"));
    saved = { ...process.env };
    process.env.STUDIO_EMAIL = "nina@example.com";
    process.env.EMAIL_TRANSPORT = "log";
    process.env.EMAIL_LOG_FILE = join(dir, "email.log");
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  afterEach(() => {
    process.env = saved;
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  function logged(): { to: string; subject: string; text: string; replyTo?: string }[] {
    return readFileSync(process.env.EMAIL_LOG_FILE as string, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
  }

  test("sends one email to Nina with the visitor's address as Reply-To", async () => {
    const db = openDb(":memory:");
    await sendContactMessage(db, good);
    const emails = logged();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("nina@example.com");
    expect(emails[0].replyTo).toBe("ana@example.com");
    expect(emails[0].subject).toContain("Ana");
    expect(emails[0].text).toContain("Ana");
    expect(emails[0].text).toContain("ana@example.com");
    expect(emails[0].text).toContain("Can I come on Sunday?");
  });

  test("is in English with no push device of Nina", async () => {
    await sendContactMessage(openDb(":memory:"), good);
    expect(logged()[0].subject).toBe("Message from Ana via the website");
  });

  test.each([
    ["en", "Message from Ana via the website"],
    ["nl", "Bericht van Ana via de website"],
  ])("the subject is in %s when Nina's newest device is in that language", async (locale, subject) => {
    const db = openDb(":memory:");
    saveSubscription(db, { endpoint: "https://push.example/old", keys: { p256dh: "p", auth: "a" } }, 1, "en");
    saveSubscription(db, { endpoint: "https://push.example/new", keys: { p256dh: "p", auth: "a" } }, 2, locale as "en");
    await sendContactMessage(db, good);
    expect(logged()[0].subject).toBe(subject);
  });

  test("throws with an empty STUDIO_EMAIL", () => {
    process.env.STUDIO_EMAIL = "";
    expect(() => contactEmail(good, "en")).toThrow("STUDIO_EMAIL");
  });

  test("the Mailgun request has h:Reply-To", async () => {
    const fetchStub = vi.fn(async (_url: string, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchStub);
    const env = {
      MAILGUN_API_KEY: "key",
      MAILGUN_DOMAIN: "mg.example.com",
      EMAIL_FROM: "TUMACH <hello@mg.example.com>",
    } as unknown as NodeJS.ProcessEnv;
    await sendEmail(contactEmail(good, "en"), env);
    const body = fetchStub.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("h:Reply-To")).toBe("ana@example.com");
    expect(body.get("to")).toBe("nina@example.com");
  });
});
