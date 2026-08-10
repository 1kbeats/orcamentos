const CACHE_NAME = '1kbeats-v6-secure-23';
const APP_SHELL = [
  './',
  './index.html',
  './login.html',
  './reset-password.html',
  './ver.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/styles.css',
  './css/secure.css',
  './js/config.js',
  './js/password-toggle.js',
  './js/pwa-install.js',
  './js/api.js',
  './js/utils.js',
  './js/auth.js',
  './js/login.js',
  './js/reset-password.js',
  './js/nav.js',
  './js/nav-events.js',
  './js/clientes.js',
  './js/financeiro.js',
  './js/operacoes.js',
  './js/operacoes-profissional.js',
  './js/producoes.js',
  './js/producoes-profissional.js',
  './js/ordens-servico.js',
  './js/compact-lists.js',
  './js/estoque.js',
  './js/usuarios.js',
  './js/catalogo.js',
  './js/orcamentos.js',
  './js/secure-overrides.js',
  './js/public-quote.js',
  './js/app.js'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.hostname.endsWith('supabase.co')) return;

  const isHtml = event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  const isCodeAsset = url.pathname.endsWith('.css') || url.pathname.endsWith('.js');
  if (isHtml || isCodeAsset) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && !url.pathname.endsWith('/ver.html')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          if (url.pathname.endsWith('/ver.html')) return caches.match('./ver.html');
          return caches.match(event.request).then(cached => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response.ok) {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
      }
      return response;
    }))
  );
});
