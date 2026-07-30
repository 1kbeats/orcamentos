// ════════════════════════════════════════════════════════════
// nav.js — Navegação entre painéis e controle do sidebar
// ════════════════════════════════════════════════════════════

const Nav = {

  painelAtual: 'listaOrcamentos',
  _plano: 'basico', // 'basico', 'profissional', 'admin'

  // Configura o menu de acordo com o perfil
  configurarMenu(isAdmin, plano) {
    this._plano = isAdmin ? 'admin' : (plano || 'basico');
    const isPro = this._plano === 'profissional' || this._plano === 'admin';

    // Seções PRO
    document.querySelectorAll('.pro-section').forEach(el => {
      el.style.display = 'block';
    });

    // Seção Financeiro label
    const secFin = document.getElementById('navSectionFinanceiro');
    if (secFin) secFin.textContent = isPro ? 'Financeiro' : 'Upgrade disponível';

    // Seção Operações label
    const secOp = document.getElementById('navSectionOperacoes');
    if (secOp) secOp.textContent = isPro ? 'Operações' : '';

    // Badges PRO — aparecem só no básico
    ['Gastos','Equipe','Fornecedores'].forEach(m => {
      const badge = document.getElementById('badge' + m);
      const item = document.getElementById('nav' + m);
      if (badge) badge.style.display = isPro ? 'none' : 'inline';
      if (item) {
        if (!isPro) item.classList.add('pro-bloqueado');
        else item.classList.remove('pro-bloqueado');
      }
    });

    // Admin
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isAdmin ? '' : 'none';
    });
  },

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
    if (panel === 'listaOrcamentos') ListaOrcamentos.carregar();
    if (panel === 'clientes')  Clientes.renderLista();
    if (panel === 'catalogo')  Catalogo.renderLista();
    if (panel === 'admin')     Usuarios.carregar();
  },

  // Mostra painel PRO ou tela de bloqueio
  showPanelPro(panel) {
    const isPro = this._plano === 'profissional' || this._plano === 'admin';
    if (isPro) {
      this.showPanel(panel);
    } else {
      this.showPanelBloqueado(panel);
    }
  },

  // Tela de bloqueio
  showPanelBloqueado(panel) {
    this.painelAtual = panel;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const nomes = { gastos: 'Gastos Diários', equipe: 'Equipe e Freelancers', fornecedores: 'Fornecedores' };
    const navEl = document.getElementById('nav' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (navEl) navEl.classList.add('active');

    const painelEl = document.getElementById('panel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (painelEl) {
      painelEl.classList.add('active');
      painelEl.querySelector('div').innerHTML =
        '<div class="pro-lock">' +
          '<div class="pro-lock-icon">🔒</div>' +
          '<div class="pro-lock-title">Módulo Profissional</div>' +
          '<div class="pro-lock-desc">O módulo <strong>' + nomes[panel] + '</strong> faz parte do <strong style="color:#D91A72">Plano Profissional</strong>. Entre em contato para fazer o upgrade.</div>' +
          '<a href="https://wa.me/5521999999999" class="pro-lock-btn" target="_blank">💬 Falar com Alessandro</a>' +
          '<div class="pro-lock-preco">R$ 2.000 implantação + R$ 250/mês</div>' +
        '</div>';
    }
    this.closeSidebar();
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
