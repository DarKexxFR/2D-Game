// Service worker de Last Pulse : jeu jouable hors connexion une fois chargé, et notifications.
//
// Stratégie de cache (aucune étape de construction, rien à tenir à jour à chaque fichier ajouté) :
//  - code et pages (HTML, JS, CSS, manifeste) : RÉSEAU D'ABORD. En ligne, le joueur a toujours la
//    dernière version (jamais un mélange d'anciens et de nouveaux modules) ; le cache ne sert que
//    hors connexion. Le serveur répond « 304 » si rien n'a changé, comme sans service worker.
//  - images, sons, polices : CACHE D'ABORD, revérifié en arrière-plan (fichiers lourds et stables).
//  - le reste (Supabase, pubs, autres sites) n'est jamais intercepté.
// Au premier chargement, la page n'est pas encore contrôlée : elle envoie la liste des fichiers déjà
// chargés (message « warm ») pour qu'ils soient mis en cache tout de suite (voir services/pwa.js).
//
// Changer VERSION seulement quand ce fichier change de comportement : l'ancien cache est alors vidé.

/// <reference lib="webworker" />
/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {any} */ (self);

const VERSION = 1;
const PREFIX = "last-pulse-";
const CODE_CACHE = `${PREFIX}code-v${VERSION}`;
const ASSET_CACHE = `${PREFIX}assets-v${VERSION}`;
const MAX_ASSETS = 200; // fichiers lourds gardés au plus (les plus anciens partent d'abord)
const SHELL = ["./", "./index.html", "./manifest.webmanifest"];
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
const CODE_EXT = /\.(?:html|js|mjs|css|webmanifest|json)$/;

sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CODE_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {}) // hors connexion à l'installation : le cache se remplira à la prochaine visite
      .then(() => sw.skipWaiting()),
  );
});

sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(PREFIX) && k !== CODE_CACHE && k !== ASSET_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => sw.clients.claim()),
  );
});

/** Catégorie d'une requête : "code", "asset" ou null (laissée au navigateur). */
function kindOf(request) {
  if (request.method !== "GET" || request.headers.has("range")) return null;
  const url = new URL(request.url);
  if (url.origin === location.origin) {
    if (request.mode === "navigate" || CODE_EXT.test(url.pathname)) return "code";
    return url.pathname.startsWith(new URL("./", location.href).pathname) ? "asset" : null;
  }
  return FONT_HOSTS.includes(url.hostname) ? "asset" : null;
}

const cacheable = (res) => res && (res.ok || res.type === "opaque") && res.status !== 206;

async function networkFirst(request) {
  const cache = await caches.open(CODE_CACHE);
  try {
    const res = await fetch(request);
    if (cacheable(res)) cache.put(request, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    // Hors connexion : version en cache ; une page (#modal=..., ?...) retombe sur l'accueil
    const hit =
      (await cache.match(request, { ignoreSearch: request.mode === "navigate" })) ||
      (request.mode === "navigate" ? await cache.match("./") : undefined);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, event) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (res) => {
      if (cacheable(res)) {
        await cache.put(request, res.clone());
        if (!hit) await trim(cache);
      }
      return res;
    })
    .catch(() => undefined);
  if (hit) {
    event.waitUntil(refresh);
    return hit;
  }
  return (await refresh) || Response.error();
}

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

sw.addEventListener("fetch", (event) => {
  const kind = kindOf(event.request);
  if (kind === "code") event.respondWith(networkFirst(event.request));
  else if (kind === "asset") event.respondWith(cacheFirst(event.request, event));
});

// La page envoie les fichiers déjà chargés avant que le service worker ne la contrôle.
sw.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "warm" || !Array.isArray(data.urls)) return;
  const job = Promise.all(
    data.urls.slice(0, 500).map(async (url) => {
      try {
        const request = new Request(url);
        const kind = kindOf(request);
        if (!kind) return;
        const cache = await caches.open(kind === "code" ? CODE_CACHE : ASSET_CACHE);
        if (await cache.match(request)) return;
        const res = await fetch(request);
        if (cacheable(res)) await cache.put(request, res);
      } catch {
        // fichier injoignable : il sera mis en cache à sa prochaine demande
      }
    }),
  ).then(() => event.ports[0]?.postMessage({ type: "warmed" }));
  event.waitUntil(job);
});

// --- NOTIFICATIONS ---
// Le serveur (supabase/functions/send-push) envoie { title, body, tag, url } ; le texte est écrit
// côté serveur pour pouvoir changer sans mettre le jeu à jour.

sw.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = String(data.title || "Last Pulse").slice(0, 80);
  event.waitUntil(
    sw.registration.showNotification(title, {
      body: String(data.body || "").slice(0, 200),
      tag: data.tag || "last-pulse",
      icon: "assets/icon-192.png",
      badge: "assets/badge-96.png",
      lang: "fr",
      data: { url: safeUrl(data.url) },
    }),
  );
});

/** Adresse à ouvrir au toucher : seulement dans le jeu (jamais un autre site). */
function safeUrl(url) {
  const scope = sw.registration.scope;
  try {
    const target = new URL(url || "./", scope);
    return target.href.startsWith(scope) ? target.href : scope;
  } catch {
    return scope;
  }
}

sw.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || sw.registration.scope;
  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
      // Jeu déjà ouvert : on le remet au premier plan (sans le recharger en pleine partie)
      const open = windows.find((w) => w.url.startsWith(sw.registration.scope));
      if (open) return open.focus();
      return sw.clients.openWindow(url);
    }),
  );
});
// Un abonnement renouvelé par le navigateur est renvoyé au serveur à la prochaine ouverture du jeu
// (services/notifications.js compare l'abonnement actuel à celui déjà envoyé).
