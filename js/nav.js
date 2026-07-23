// ════════════════════════════════════════════════════════════
// nav.js — Navegação entre painéis e controle do sidebar
// ════════════════════════════════════════════════════════════

const Nav = {

  painelAtual: 'orcamentos',

  // Mostra painel e atualiza nav ativo
  showPanel(panel) {
    this.painelAtual = panel;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const painelEl = document.getElementById('panel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    const navEl    = document.getElementById('nav'   + panel.charAt(0).toUpperCase() + panel.slice(1));

    if (painelEl) painelEl.classList.add('active');
    if (navEl)    navEl.classList.add('active');

    this.closeSidebar();

    // Carregar dados do painel ao entrar
    if (panel === 'clientes')   Clientes.renderLista();
    if (panel === 'financeiro') Financeiro.carregar();
    if (panel === 'admin')      Usuarios.carregar();
  },

  openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('open');
  },

  closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('open');
  }
};
