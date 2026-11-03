// The service worker of the studio app (#25): it shows a push notification and opens the studio app on a click.
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "TUMACH", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      data: { url: data.url || "/studio" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/studio";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) if (client.url.includes("/studio") && "focus" in client) return client.focus();
      return self.clients.openWindow(url);
    }),
  );
});

// The browser renews or ends the push subscription (#569): send the new one to the server, so that the pushes continue.
// A failed renew changes nothing: the check at the next open of the app repairs it.
self.addEventListener("pushsubscriptionchange", (event) => {
  const options = event.oldSubscription?.options;
  const renew = event.newSubscription
    ? Promise.resolve(event.newSubscription)
    : options
      ? self.registration.pushManager.subscribe(options)
      : Promise.resolve(null);
  event.waitUntil(
    renew
      .then((subscription) => {
        if (!subscription) return;
        return fetch("/api/studio/push/subscribe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(subscription),
        });
      })
      .catch(() => {}),
  );
});

// The studio home with no internet (#746, epic #745): the last studio home that the server sent stays in a cache, and
// a navigation to the studio home with no network gets it. Only the studio home (the lessons of today and tomorrow):
// the cache holds the names of dancers on Nina's phone. A redirect of the studio home (no session: the login page) and
// a navigation to the login page delete it. All other requests go to the network as before.
const STUDIO_CACHE = "studio-v1";
const STUDIO_HOME = "/studio";
const STUDIO_LOGIN = "/studio/login";

/** Keep a response of the studio home: only a 200 of the page itself, else (a redirect) delete the cache. */
async function keepHome(response) {
  const path = response.url ? new URL(response.url).pathname : "";
  if (response.status === 200 && !response.redirected && path === STUDIO_HOME) {
    const cache = await caches.open(STUDIO_CACHE);
    await cache.put(STUDIO_HOME, response);
  } else {
    await caches.delete(STUDIO_CACHE);
  }
}

/** Network first; with no network, the kept studio home, else the error of the network (the page of the browser). */
async function homeResponse(event) {
  try {
    const response = await fetch(event.request);
    event.waitUntil(keepHome(response.clone()).catch(() => {}));
    return response;
  } catch (error) {
    const kept = await caches.open(STUDIO_CACHE).then((cache) => cache.match(STUDIO_HOME));
    if (kept) return kept;
    throw error;
  }
}

self.addEventListener("install", () => self.skipWaiting());

// The first install keeps the studio home at once (the page that registered the worker came before it), then takes
// the open pages, so that the next open with no internet works.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    fetch(STUDIO_HOME, { credentials: "same-origin", redirect: "manual" })
      .then(keepHome)
      .catch(() => {})
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === STUDIO_LOGIN) {
    event.waitUntil(caches.delete(STUDIO_CACHE));
    return;
  }
  if (url.pathname === STUDIO_HOME) event.respondWith(homeResponse(event));
});
