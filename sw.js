// Service Worker — PCDF Delegado 2026
// Estratégia: network-first para index.html (pega sempre a versão mais recente),
// cache-first para os assets estáticos (ícones, manifest).

const CACHE_STATIC  = 'pcdf-static-v1';
const CACHE_DYNAMIC = 'pcdf-dynamic-v1';

const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-180.png',
];

// ── Install: pré-cache dos assets estáticos ──────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Falha silenciosa — assets podem não existir ainda no primeiro deploy
      });
    })
  );
  self.skipWaiting();
});

// ── Activate: limpa caches antigos ───────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_STATIC && k !== CACHE_DYNAMIC)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first para HTML, cache-first para o resto ─────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Só intercepta requests do mesmo domínio
  if (url.origin !== location.origin) return;

  // HTML (index / raiz) — sempre tenta a rede primeiro para pegar bloco atualizado
  if (event.request.mode === 'navigate' ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Assets estáticos — cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
