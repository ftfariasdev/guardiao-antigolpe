/* Service worker do Guardião: recebe o Web Push do alerta e abre o app no alerta ao tocar. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener("push", (evento) => {
  let dados = { titulo: "Alerta da família", corpo: "Abra o Guardião para ver.", url: "/" };
  try {
    dados = { ...dados, ...evento.data.json() };
  } catch {
    /* push sem corpo: mostra o aviso padrão */
  }
  evento.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.corpo,
      icon: "/brand/icon-192.png",
      badge: "/brand/icon-192.png",
      tag: dados.alerta_id ?? "alerta",
      requireInteraction: true,
      vibrate: [600, 150, 600, 150, 600],
      data: { url: dados.url },
    }),
  );
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url ?? "/", self.location.origin).href;
  evento.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => "focus" in j);
      if (aberta) return aberta.navigate(destino).then((j) => (j ?? aberta).focus());
      return self.clients.openWindow(destino);
    }),
  );
});
