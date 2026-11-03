// The service worker keeps the last studio home and gives it with no internet (#746), with a fake `self` and caches.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

const code = readFileSync("public/sw.js", "utf8");
const ORIGIN = "https://tumach.test";

/** A response as `fetch` gives it: with its final address and `redirected`, also in a clone (as in a browser). */
function answer(body: string, { status = 200, url = `${ORIGIN}/studio`, redirected = false } = {}): Response {
  const make = (base: Response): Response => {
    const clone = base.clone.bind(base);
    return Object.defineProperties(base, {
      url: { value: url },
      redirected: { value: redirected },
      clone: { value: () => make(clone()) },
      // An opaque redirect (a navigation with `redirect: "manual"`) has the status 0, which `new Response` refuses.
      ...(status === 0 ? { status: { value: 0 }, type: { value: "opaqueredirect" } } : {}),
    });
  };
  return make(new Response(status === 0 ? null : body, { status: status === 0 ? 200 : status }));
}

function load(network: (request: unknown) => Promise<Response>) {
  const handlers: Record<string, (event: unknown) => void> = {};
  const store = new Map<string, Map<string, Response>>();
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const entries = store.get(name) as Map<string, Response>;
      return {
        put: async (key: string, response: Response) => void entries.set(key, response),
        match: async (key: string) => entries.get(key)?.clone(),
      };
    },
    delete: async (name: string) => store.delete(name),
  };
  const claim = vi.fn(async () => {});
  const self = {
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      handlers[type] = handler;
    },
    location: new URL(`${ORIGIN}/sw.js`),
    skipWaiting: vi.fn(),
    registration: { pushManager: {}, showNotification: vi.fn() },
    clients: { claim },
  };
  const fetch = vi.fn(network);
  new Function("self", "fetch", "caches", code)(self, fetch, caches);

  /** A navigation (or another request): the response that the worker gives, `undefined` when it lets it pass. */
  async function navigate(path: string, { method = "GET", mode = "navigate" } = {}) {
    const waits: Promise<unknown>[] = [];
    let given: Promise<Response> | undefined;
    handlers.fetch({
      request: { url: `${ORIGIN}${path}`, method, mode },
      respondWith: (p: Promise<Response>) => {
        given = p;
      },
      waitUntil: (p: Promise<unknown>) => void waits.push(p),
    });
    const response = given ? await given.catch((error: unknown) => error) : undefined;
    await Promise.all(waits);
    return response;
  }
  async function activate() {
    let done: Promise<unknown> = Promise.resolve();
    handlers.activate({ waitUntil: (p: Promise<unknown>) => (done = p) });
    await done;
  }
  const kept = async () => store.get("studio-v1")?.get("/studio")?.clone().text();
  return { navigate, activate, kept, fetch, claim };
}

describe("the studio home with no internet", () => {
  it("keeps the studio home and gives it when the network fails", async () => {
    let online = true;
    const sw = load(async () => {
      if (!online) throw new TypeError("Failed to fetch");
      return answer("home of 10:00");
    });
    const first = (await sw.navigate("/studio")) as Response;
    expect(await first.text()).toBe("home of 10:00");
    expect(await sw.kept()).toBe("home of 10:00");
    online = false;
    const offline = (await sw.navigate("/studio")) as Response;
    expect(await offline.text()).toBe("home of 10:00");
  });

  it("gives the error of the network when nothing is kept", async () => {
    const sw = load(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await sw.navigate("/studio")).toBeInstanceOf(TypeError);
  });

  it("deletes the kept home at a redirect (no session) and at the login page", async () => {
    let next = answer("home");
    const sw = load(async () => next);
    await sw.navigate("/studio");
    expect(await sw.kept()).toBe("home");
    next = answer("", { status: 0 });
    await sw.navigate("/studio");
    expect(await sw.kept()).toBeUndefined();

    next = answer("home again");
    await sw.navigate("/studio");
    expect(await sw.kept()).toBe("home again");
    expect(await sw.navigate("/studio/login")).toBeUndefined();
    expect(await sw.kept()).toBeUndefined();
  });

  it("keeps no error page and no other studio page", async () => {
    let next = answer("error", { status: 500 });
    const sw = load(async () => next);
    await sw.navigate("/studio");
    expect(await sw.kept()).toBeUndefined();
    next = answer("login", { url: `${ORIGIN}/studio/login`, redirected: true });
    await sw.navigate("/studio");
    expect(await sw.kept()).toBeUndefined();
  });

  it("lets all other requests pass to the network", async () => {
    const sw = load(async () => answer("home"));
    expect(await sw.navigate("/studio/bookings")).toBeUndefined();
    expect(await sw.navigate("/en")).toBeUndefined();
    expect(await sw.navigate("/studio", { mode: "cors" })).toBeUndefined();
    expect(await sw.navigate("/studio", { method: "POST" })).toBeUndefined();
    expect(sw.fetch).not.toHaveBeenCalled();
  });

  it("keeps the studio home at the first activation, then takes the open pages", async () => {
    const sw = load(async () => answer("home at install"));
    await sw.activate();
    expect(sw.fetch).toHaveBeenCalledWith("/studio", { credentials: "same-origin", redirect: "manual" });
    expect(await sw.kept()).toBe("home at install");
    expect(sw.claim).toHaveBeenCalled();
  });

  it("still takes the open pages when the first keep fails", async () => {
    const sw = load(async () => {
      throw new TypeError("Failed to fetch");
    });
    await sw.activate();
    expect(sw.claim).toHaveBeenCalled();
  });
});
