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
