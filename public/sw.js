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
