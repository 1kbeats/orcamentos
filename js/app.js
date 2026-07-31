document.addEventListener('DOMContentLoaded', async () => {
  const authenticated = await Auth.verificarSessao();
  if (!authenticated) return;

  document.body.classList.add('app-ready');
  Nav.bindEvents?.();
  Orcamentos.init();
  ListaOrcamentos.bindEvents();
  Clientes.bindEvents();
  Catalogo.bindEvents();
  Financeiro.bindEvents();
  Usuarios.bindEvents();
  Dashboard.carregar();

  document.getElementById('btnExportarOrcamentos')?.addEventListener('click', () => ListaOrcamentos.exportar());
  document.getElementById('updateBanner')?.addEventListener('click', () => window.location.reload());
  document.getElementById('btnDashViewAll')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') Nav.showPanel('listaOrcamentos');
  });

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', event => {
          if (event.target.state === 'installed' && navigator.serviceWorker.controller) {
            document.getElementById('updateBanner')?.classList.add('show');
          }
        });
      });
    } catch (_) {}
  }
});
