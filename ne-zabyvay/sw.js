const CACHE = "self-care-v5";
const asset = (name) => new URL(name, self.registration.scope).href;
self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "SHOW_REMINDER") {
    const { title, body, tag } = event.data;
    event.waitUntil(self.registration.showNotification(title, { body, tag, icon: asset("app-icon-192.png"), badge: asset("app-icon-192.png"), vibrate: [120, 80, 120] }));
  }
});
self.addEventListener("push", (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(self.registration.showNotification(data.title || "Не забывай", {
    body: data.body || "Пора немного позаботиться о себе", tag: data.tag || "self-care", icon: asset("app-icon-192.png"), badge: asset("app-icon-192.png"),
  }));
});
self.addEventListener("notificationclick", (event) => { event.notification.close(); event.waitUntil(self.clients.openWindow(self.registration.scope)); });
