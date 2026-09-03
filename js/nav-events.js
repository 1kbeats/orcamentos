Nav.bindEvents = function bindEvents() {
  const on = (id, action) => document.getElementById(id)?.addEventListener('click', action);
  on('navDashboard', () => this.showPanel('dashboard'));
  on('navOrcamentos', () => this.showPanel('listaOrcamentos'));
  on('navAgenda', () => this.showPanelPro('agenda'));
  on('navFinanceiroEventos', () => this.showPanelPro('financeiroEventos'));
  on('navClientes', () => this.showPanel('clientes'));
  on('navCatalogo', () => this.showPanel('catalogo'));
  on('navGastos', () => this.showPanelPro('gastos'));
  on('navEquipe', () => this.showPanelPro('equipe'));
  on('navFornecedores', () => this.showPanelPro('fornecedores'));
  on('navEstoque', () => this.showPanelPro('estoque'));
  on('navOrdemServico', () => this.showPanelPro('ordemServico'));
  on('navAdmin', () => this.showPanel('admin'));
  on('navAssinatura', () => this.showPanel('assinatura'));
  on('btnSidebarPassword', () => Usuarios.abrirAlterarSenha());
  on('btnLogout', () => Auth.logout());
  on('sidebarOverlay', () => this.closeSidebar());
  on('btnMenuMobile', () => this.openSidebar());
  on('btnDashNewQuote', () => {
    this.showPanel('listaOrcamentos');
    document.getElementById('btnNovoOrcamento')?.click();
  });
  on('btnDashViewAll', () => this.showPanel('listaOrcamentos'));
  on('btnQuickQuote', () => {
    this.showPanel('listaOrcamentos');
    document.getElementById('btnNovoOrcamento')?.click();
  });
  on('btnQuickClient', () => {
    this.showPanel('clientes');
    Clientes.abrirNovo();
  });
  on('btnQuickCatalog', () => {
    this.showPanel('catalogo');
    Catalogo.abrirNovo();
  });
  on('btnDiscPct', () => Orcamentos.setDiscTipo('pct'));
  on('btnDiscVal', () => Orcamentos.setDiscTipo('val'));
};
