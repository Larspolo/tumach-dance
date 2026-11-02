// Spam bots on the contact form (#151): a honeypot, a signed time of the page and a limit per address. A bot gets
// `sent` and no email goes out; a person after 3 seconds sends one email.

import { NextIntlClientProvider } from "next-intl";
import { type ComponentProps, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import en from "../messages/en.json";

const contact = vi.hoisted(() => ({ sendContactMessage: vi.fn() }));
const address = vi.hoisted(() => ({ ip: "203.0.113.1" }));
vi.mock("../src/lib/contact", async (orig) => ({ ...(await orig<object>()), ...contact }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => ({}) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": `${address.ip}, 10.0.0.1` }) }));

const { sendContact } = await import("../src/app/[locale]/contact-action");
const { clientAddress, contactStamp, resetContactLimit } = await import("../src/lib/contact-spam");
const { ContactForm } = await import("../src/components/home/ContactForm");

const IDLE = { status: "idle" as const, errors: {}, values: { name: "", email: "", message: "" } };
const good = { name: "Ana", email: "ana@example.com", message: "Can I come on Sunday?" };

function form(extra: Record<string, string> = {}, ageMs = 4000): FormData {
  const data = new FormData();
  data.set("stamp", contactStamp(Date.now() - ageMs));
  for (const [key, value] of Object.entries({ ...good, ...extra })) data.set(key, value);
  return data;
}

async function send(data: FormData) {
  contact.sendContactMessage.mockClear();
  const state = await sendContact(IDLE, data);
  // #298: a person always sees the answer; only the honeypot and a real send give the thank-you.
  const calls = contact.sendContactMessage.mock.calls.length;
  const honeypot = data.get("website");
  expect(state.status).toBe(calls === 1 || honeypot ? "sent" : "notSent");
  return contact.sendContactMessage.mock.calls.length;
}

describe("contact spam", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    contact.sendContactMessage.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    resetContactLimit();
    address.ip = "203.0.113.1";
  });

  test("a person after 3 seconds sends one email", async () => {
    expect(await send(form())).toBe(1);
  });

  test("a filled honeypot sends no email", async () => {
    expect(await send(form({ website: "http://spam.test" }))).toBe(0);
  });

  test("a send after 1 second and a page older than 1 day send no email", async () => {
    expect(await send(form({}, 1000))).toBe(0);
    expect(await send(form({}, 25 * 60 * 60 * 1000))).toBe(0);
  });

  test("a changed time, a changed signature or no stamp sends no email", async () => {
    const [time, signature] = contactStamp(Date.now() - 4000).split(".");
    expect(await send(form({ stamp: `${Number(time) - 1000}.${signature}` }))).toBe(0);
    expect(await send(form({ stamp: `${time}.${"0".repeat(signature.length)}` }))).toBe(0);
    const none = form();
    none.delete("stamp");
    expect(await send(none)).toBe(0);
  });

  test("the sixth message in an hour from one address sends no email; another address still sends", async () => {
    for (let i = 0; i < 5; i++) expect(await send(form())).toBe(1);
    expect(await send(form())).toBe(0);
    address.ip = "203.0.113.2";
    expect(await send(form())).toBe(1);
  });

  test("the address: Cloudflare first, else the first of x-forwarded-for", () => {
    expect(clientAddress(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientAddress(new Headers({ "x-forwarded-for": "2.2.2.2, 3.3.3.3" }))).toBe("2.2.2.2");
  });

  test("the Tab key and a screen reader do not reach the honeypot", () => {
    const html = renderToStaticMarkup(
      createElement(
        NextIntlClientProvider,
        { locale: "en", messages: en, timeZone: "Europe/Amsterdam" } as unknown as ComponentProps<
          typeof NextIntlClientProvider
        >,
        createElement(ContactForm, { stamp: "1.x" }),
      ),
    );
    const honeypot = html.match(/<input[^>]*name="website"[^>]*>/)?.[0] ?? "";
    expect(honeypot).toContain('tabindex="-1"');
    expect(honeypot).toContain('aria-hidden="true"');
    expect(honeypot).toMatch(/autocomplete="off"/i);
    expect(html).toMatch(/<input[^>]*type="hidden"[^>]*name="stamp"[^>]*value="1.x"/);
  });
});
