// ════════════════════════════════════════════════════════════
// nav.js — Navegação entre painéis e controle do sidebar
// ════════════════════════════════════════════════════════════

const Nav = {

  painelAtual: 'dashboard',
  _plano: 'basico', // 'basico', 'professional', 'admin'

  // Configura o menu de acordo com o perfil
  configurarMenu() {
    const canViewOperations = CONFIG.canViewOperations;
    const canManageUsers = CONFIG.canManageUsers;

    document.querySelectorAll('.pro-section').forEach(element => {
      element.style.display = canViewOperations ? 'block' : 'none';
    });
    ['navAgenda', 'navFinanceiroEventos', 'navGastos', 'navEquipe', 'navFornecedores', 'navEstoque', 'navOrdemServico'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.style.display = canViewOperations ? 'flex' : 'none';
    });

    const financeSection = document.getElementById('navSectionFinanceiro');
    if (financeSection) financeSection.textContent = canViewOperations ? 'Financeiro' : '';
    const operationsSection = document.getElementById('navSectionOperacoes');
    if (operationsSection) operationsSection.textContent = canViewOperations ? 'Operações' : '';

    ['badgeGastos', 'badgeEquipe', 'badgeFornecedores'].forEach(id => {
      const badge = document.getElementById(id);
      if (badge) badge.style.display = 'none';
    });

    const serviceOrder = document.getElementById('navOrdemServico');
    if (serviceOrder) serviceOrder.style.display = canViewOperations ? 'flex' : 'none';

    document.querySelectorAll('.admin-only').forEach(element => {
      element.style.display = canManageUsers ? '' : 'none';
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
    if (panel === 'dashboard') Dashboard.carregar();
    if (panel === 'listaOrcamentos') ListaOrcamentos.carregar();
    if (panel === 'clientes')  Clientes.renderLista();
    if (panel === 'catalogo')  Catalogo.renderLista();
    if (panel === 'admin')     Usuarios.carregar();
    if (panel === 'producoes') Producoes.carregar();
    if (panel === 'agenda') Agenda.carregar();
    if (panel === 'financeiroEventos') FinanceiroEventos.carregar();
    if (panel === 'ordemServico') OrdensServico.carregar();
    if (panel === 'estoque') Estoque.carregar();
    if (['gastos', 'equipe', 'fornecedores'].includes(panel)) Operacoes.carregar();
  },

  // Mostra painel PRO ou teaser
  showPanelPro(panel) {
    if (CONFIG.canViewOperations) {
      this.showPanel(panel);
    } else {
      this.showPanelBloqueado(panel);
    }
  },
  // Tela de teaser por módulo
  _teasers: {
    gastos: {
      titulo: 'Controle de Gastos Diários',
      desc: 'Registre todas as despesas da sua operação e tenha controle total do que entra e sai no seu negócio.',
      recursos: [
        { icone: '🧾', titulo: 'Notas fiscais', desc: 'Registre notas por data, descrição e valor' },
        { icone: '⛽', titulo: 'Gastos de veículos', desc: 'Abastecimentos e manutenções por carro' },
        { icone: '📊', titulo: 'Total por período', desc: 'Veja quanto gastou no mês ou por evento' },
        { icone: '🏷️', titulo: 'Por categoria', desc: 'Separe por combustível, alimentação, material' },
      ]
    },
    equipe: {
      titulo: 'Equipe e Freelancers',
      desc: 'Cadastre seus técnicos e freelancers, controle diárias e saiba quem trabalhou em cada evento.',
      recursos: [
        { icone: '👤', titulo: 'Cadastro completo', desc: 'Nome, RG, CPF e filiação de cada técnico' },
        { icone: '💰', titulo: 'Registro de diárias', desc: 'Valor e evento de cada trabalho realizado' },
        { icone: '📋', titulo: 'Histórico por técnico', desc: 'Veja todos os eventos que cada um participou' },
        { icone: '📞', titulo: 'Contato rápido', desc: 'Acesso direto ao WhatsApp de cada profissional' },
      ]
    },
    fornecedores: {
      titulo: 'Controle de Fornecedores',
      desc: 'Registre carregadores, fornecedores externos e prestadores de serviço por evento.',
      recursos: [
        { icone: '🚚', titulo: 'Cadastro por evento', desc: 'Vincule o fornecedor ao evento correspondente' },
        { icone: '🕐', titulo: 'Horário e valor', desc: 'Registre horário de chegada e valor contratado' },
        { icone: '📝', titulo: 'Histórico completo', desc: 'Veja todos os fornecedores por evento' },
        { icone: '⭐', titulo: 'Avaliação', desc: 'Marque os melhores para usar novamente' },
      ]
    }
  },

  showPanelBloqueado(panel) {
    this.painelAtual = panel;
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const navEl = document.getElementById('nav' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (navEl) navEl.classList.add('active');

    const t = this._teasers[panel] || {};
    const recursos = (t.recursos || []).map(r =>
      '<div style="background:#fff;border:0.5px solid #E0E0EA;border-radius:10px;padding:14px 16px;display:flex;gap:12px;align-items:flex-start">' +
        '<div style="font-size:22px;flex-shrink:0">' + r.icone + '</div>' +
        '<div>' +
          '<div style="font-size:13px;font-weight:600;color:#1A1A22;margin-bottom:3px">' + r.titulo + '</div>' +
          '<div style="font-size:12px;color:#666;line-height:1.5">' + r.desc + '</div>' +
        '</div>' +
      '</div>'
    ).join('');

    const painelEl = document.getElementById('panel' + panel.charAt(0).toUpperCase() + panel.slice(1));
    if (painelEl) {
      painelEl.classList.add('active');
      painelEl.querySelector('div').innerHTML =
        '<div style="padding:32px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:70vh">' +
          '<div style="background:rgba(217,26,114,0.1);border:1px solid rgba(217,26,114,0.3);border-radius:20px;padding:4px 14px;font-size:11px;font-weight:700;color:#D91A72;letter-spacing:.08em;margin-bottom:20px">PLANO PROFISSIONAL</div>' +
          '<div style="font-size:22px;font-weight:600;color:#1A1A22;margin-bottom:8px;text-align:center">' + (t.titulo || '') + '</div>' +
          '<div style="font-size:14px;color:#666;margin-bottom:28px;text-align:center;max-width:400px;line-height:1.7">' + (t.desc || '') + '</div>' +
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;width:100%;max-width:560px;margin-bottom:28px">' + recursos + '</div>' +
          '<div style="padding:12px 20px;background:#F5F5FA;border-radius:8px;color:#555;font-size:13px">Solicite o upgrade ao responsável pela sua conta.</div>' +
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
