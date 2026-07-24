var CACHE = '1kbeats-orcamentos-v7';
var FILES = [
  './',
  './index.html',
  './ver.html',
  './login.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './css/styles.css',
  './js/config.js',
  './js/utils.js',
  './js/auth.js',
  './js/nav.js',
  './js/clientes.js',
  './js/financeiro.js',
  './js/usuarios.js',
  './js/catalogo.js',
  './js/orcamentos.js'
];

self.addEventListener('install', function(e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(FILES);
    })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  // Ignorar requisições não-GET (POST, PATCH, DELETE)
  if (e.request.method !== 'GET') return;

  // Ignorar requisições ao Supabase
  if (e.request.url.indexOf('supabase.co') !== -1) return;

  var isHTML = e.request.url.endsWith('.html') || e.request.url.endsWith('/');

  if (isHTML) {
    // HTML: rede primeiro, cache como fallback
    e.respondWith(
      fetch(e.request)
        .then(function(response) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(e.request);
        })
    );
  } else {
    // Assets: cache primeiro
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        return cached || fetch(e.request).then(function(response) {
          var clone = response.clone();
          caches.open(CACHE).then(function(cache) {
            cache.put(e.request, clone);
          });
          return response;
        });
      })
    );
  }
});

self.addEventListener('message', function(e) {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
