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
  const initialPanel = [
    ['dashboard','dashboard'], ['listaOrcamentos','orcamentos'], ['agenda','agenda'],
    ['clientes','clientes_catalogo'], ['financeiroEventos','financeiro'], ['gastos','despesas'],
    ['equipe','equipe'], ['fornecedores','fornecedores'], ['estoque','estoque']
  ].find(([, module]) => CONFIG.canViewModule(module));
  if (initialPanel) Nav.showPanel(initialPanel[0]);

  document.getElementById('btnExportarOrcamentos')?.addEventListener('click', () => ListaOrcamentos.exportar());
  document.getElementById('btnExcluirSelecionados')?.addEventListener('click', () => ListaOrcamentos.excluirSelecionados());
  document.getElementById('checkTodosOrcamentos')?.addEventListener('change', event => {
    document.querySelectorAll('.quote-check input').forEach(input => { input.checked = event.target.checked; input.dispatchEvent(new Event('change')); });
  });
  const updateBanner = document.getElementById('updateBanner');
  updateBanner?.addEventListener('click', () => {
    sessionStorage.setItem('1kbeats_update_reloaded_at', String(Date.now()));
    updateBanner.classList.remove('show');
    window.location.reload();
  });
  document.getElementById('btnDashViewAll')?.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') Nav.showPanel('listaOrcamentos');
  });

  if ('serviceWorker' in navigator) {
    try {
      // O endereço do service worker deve permanecer estável. A versão do cache,
      // definida no próprio sw.js, é quem controla as atualizações.
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => {
        registration.installing?.addEventListener('statechange', event => {
          if (event.target.state === 'installed' && navigator.serviceWorker.controller) {
            const lastReload = Number(sessionStorage.getItem('1kbeats_update_reloaded_at') || 0);
            const justReloaded = Date.now() - lastReload < 120000;
            if (!justReloaded) updateBanner?.classList.add('show');
          }
        });
      });
    } catch (_) {}
  }
});
