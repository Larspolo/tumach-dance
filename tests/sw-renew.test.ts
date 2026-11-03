// The service worker sends a renewed push subscription to the server (#569), with a fake `self`.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const code = readFileSync("public/sw.js", "utf8");

function load() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const subscribe = vi.fn(async (options: unknown) => ({ endpoint: "https://push.test/new2", options }));
  const fetch = vi.fn(async () => new Response("", { status: 200 }));
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    registration: { pushManager: { subscribe }, showNotification: vi.fn() },
    clients: {},
  };
  new Function("self", "fetch", code)(self, fetch);
  async function fire(event: Record<string, unknown>) {
    let done: Promise<unknown> = Promise.resolve();
    handlers.pushsubscriptionchange({ ...event, waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  return { fire, subscribe, fetch };
}

describe("pushsubscriptionchange", () => {
  it("posts the new subscription of the browser", async () => {
    const { fire, subscribe, fetch } = load();
    await fire({ newSubscription: { endpoint: "https://push.test/new" } });
    expect(subscribe).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("/api/studio/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "https://push.test/new" }),
    });
  });

  it("subscribes again with the old options when the browser gives no new subscription", async () => {
    const { fire, subscribe, fetch } = load();
    const options = { userVisibleOnly: true, applicationServerKey: "key" };
    await fire({ oldSubscription: { options } });
    expect(subscribe).toHaveBeenCalledWith(options);
    const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string).endpoint).toBe("https://push.test/new2");
  });

  it("changes nothing and does not throw with neither subscription", async () => {
    const { fire, subscribe, fetch } = load();
    await expect(fire({})).resolves.toBeUndefined();
    expect(subscribe).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
