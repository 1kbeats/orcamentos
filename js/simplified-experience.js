(function simplifiedExperience() {
  const categories = {
    combustivel: 'Combustível', alimentacao: 'Alimentação', manutencao: 'Manutenção',
    equipamento: 'Equipamento', logistica: 'Logística', nota_fiscal: 'Nota fiscal', outro: 'Outro'
  };
  const palette = ['#d91a72', '#282834', '#7357c5', '#f09a3e', '#2f9b78', '#8b8b9b', '#d65d5d'];
  const total = (list, field = 'valor') => list.reduce((sum, item) => sum + (Number(item[field]) || 0), 0);
  const monthKey = value => String(value || '').slice(0, 7);
  const monthLabel = key => new Date(key + '-02T12:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const inFilter = values => 'in.(' + values.map(encodeURIComponent).join(',') + ')';

  Operacoes.modalGasto = function modalGasto(item) {
    const options = Object.entries(categories);
    this.modal(item ? 'Editar despesa da empresa' : 'Nova despesa da empresa',
      '<div class="ops-form-grid">' +
      this.editField('Data', 'data', 'date', true, item?.data || new Date().toISOString().slice(0, 10)) +
      this.select('Categoria', 'categoria', this.choices(options, item?.categoria), true) +
      this.editField('Descrição', 'descricao', 'text', true, item?.descricao) +
      this.editField('Valor (R$)', 'valor', 'number', true, item?.valor) +
      this.editField('Fornecedor / estabelecimento', 'fornecedor', 'text', false, item?.fornecedor) +
      this.editField('Número da NF', 'nota_fiscal', 'text', false, item?.nota_fiscal) +
      this.select('Pagamento', 'status_pagamento', this.choices([['pago', 'Pago'], ['pendente', 'Pendente']], item?.status_pagamento || 'pago')) +
      this.editText('Observações', 'observacoes', item?.observacoes) + '</div>',
      form => this.saveRecord('gastos', item, {
        data: this.date(form, 'data'), categoria: form.get('categoria'), descricao: this.val(form, 'descricao'),
        fornecedor: this.val(form, 'fornecedor'), nota_fiscal: this.val(form, 'nota_fiscal'), valor: this.num(form, 'valor'),
        orcamento_id: null, status_pagamento: form.get('status_pagamento'), observacoes: this.val(form, 'observacoes', 2000)
      })
    );
  };

  Operacoes.renderGastos = function renderGastos() {
    const root = document.getElementById('gastosContent'); if (!root) return;
    const month = this._filters.gastosMes;
    const companyExpenses = this._data.gastos.filter(item => !item.orcamento_id);
    const visible = companyExpenses.filter(item => this.sameMonth(item, month) && (!this._filters.gastosPagamento || item.status_pagamento === this._filters.gastosPagamento));
    const paid = total(visible.filter(item => item.status_pagamento === 'pago'));
    const pending = total(visible.filter(item => item.status_pagamento !== 'pago'));
    const byCategory = visible.reduce((acc, item) => { acc[item.categoria] = (acc[item.categoria] || 0) + (Number(item.valor) || 0); return acc; }, {});
    const mainCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const rows = visible.map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.descricao) + '</strong><small>' + this.escape(item.fornecedor || item.nota_fiscal || '') + '</small></td><td><span class="ops-tag">' + this.escape(categories[item.categoria] || item.categoria) + '</span></td><td><span class="ops-tag status-' + this.escape(item.status_pagamento) + '">' + this.escape(item.status_pagamento === 'pago' ? 'Pago' : 'Pendente') + '</span></td><td class="ops-money">' + this.money(item.valor) + '</td><td>' + this.actionButtons('gastos', item.id) + '</td></tr>').join('');
    const payment = '<option value="">Todos</option>' + this.option('pago', 'Pago', this._filters.gastosPagamento) + this.option('pendente', 'Pendente', this._filters.gastosPagamento);
    const filters = this.filtersHtml(this.filterField('Mês', 'opsGastosMes', 'month', month) + this.filterField('Pagamento', 'opsGastosPagamento', 'select', '', payment));
    root.innerHTML = '<div class="ops-page">' + this.titulo('Despesas da empresa', 'Custos que não pertencem a um evento específico.', 'Nova despesa', 'opsNovoGasto') +
      '<p class="company-expense-note">Custos de eventos devem ser registrados dentro do evento na Agenda. Aqui ficam somente despesas gerais da empresa.</p>' +
      '<div class="ops-summary"><div><span>Total do mês</span><strong>' + this.money(paid + pending) + '</strong></div><div><span>Pago</span><strong class="positive">' + this.money(paid) + '</strong></div><div><span>Pendente</span><strong>' + this.money(pending) + '</strong></div><div><span>Maior categoria</span><strong>' + this.escape(mainCategory ? categories[mainCategory[0]] || mainCategory[0] : '—') + '</strong></div></div>' +
      filters + '<div class="ops-card"><div class="ops-card-title">Despesas do período <span>' + visible.length + ' registro(s)</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Pagamento</th><th>Valor</th><th>Ações</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="ops-empty">Nenhuma despesa da empresa neste período.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovoGasto')?.addEventListener('click', () => this.modalGasto());
    this.bindProfessionalFilters(root, { opsGastosMes: 'gastosMes', opsGastosPagamento: 'gastosPagamento' }, () => this.renderGastos());
    this.bindProfessionalActions(root);
  };

  Dashboard.carregar = async function carregarDashboardExecutivo() {
    const root = document.querySelector('#panelDashboard .dashboard-page'); if (!root) return;
    root.className = 'executive-dashboard';
    root.innerHTML = '<div class="ops-empty">Carregando visão geral...</div>';
    const now = new Date(), keys = [];
    for (let offset = 5; offset >= 0; offset--) { const d = new Date(now.getFullYear(), now.getMonth() - offset, 1); keys.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')); }
    const start = keys[0] + '-01', last = new Date(now.getFullYear(), now.getMonth() + 1, 0), end = last.getFullYear() + '-' + String(last.getMonth() + 1).padStart(2, '0') + '-' + String(last.getDate()).padStart(2, '0');
    try {
      const productions = await Api.request(Api.orgFilter('/rest/v1/producoes?select=id,data_evento,orcamento_id,orcamentos(total,status)&data_evento=gte.' + start + '&data_evento=lte.' + end)) || [];
      const quoteIds = [...new Set(productions.map(item => item.orcamento_id).filter(Boolean))];
      const filter = quoteIds.length ? inFilter(quoteIds) : '';
      const [eventExpenses, diaries, suppliers, companyExpenses] = await Promise.all([
        filter ? Api.request(Api.orgFilter('/rest/v1/gastos?select=orcamento_id,valor,categoria&orcamento_id=' + filter)) : [],
        filter ? Api.request(Api.orgFilter('/rest/v1/equipe_diarias?select=orcamento_id,valor_diaria&orcamento_id=' + filter)) : [],
        filter ? Api.request(Api.orgFilter('/rest/v1/fornecedor_eventos?select=orcamento_id,valor&orcamento_id=' + filter)) : [],
        Api.request(Api.orgFilter('/rest/v1/gastos?select=data,valor,categoria,orcamento_id&orcamento_id=is.null&data=gte.' + start + '&data=lte.' + end))
      ]);
      const monthly = Object.fromEntries(keys.map(key => [key, { income: 0, eventCost: 0, companyCost: 0 }]));
      productions.forEach(item => { const key = monthKey(item.data_evento); if (!monthly[key]) return; const id = item.orcamento_id; monthly[key].income += Number(item.orcamentos?.total) || 0; monthly[key].eventCost += total((eventExpenses || []).filter(row => row.orcamento_id === id)) + total((diaries || []).filter(row => row.orcamento_id === id), 'valor_diaria') + total((suppliers || []).filter(row => row.orcamento_id === id)); });
      (companyExpenses || []).forEach(item => { const key = monthKey(item.data); if (monthly[key]) monthly[key].companyCost += Number(item.valor) || 0; });
      const current = monthly[keys[keys.length - 1]], result = current.income - current.eventCost - current.companyCost;
      const maxValue = Math.max(1, ...Object.values(monthly).flatMap(item => [item.income, item.eventCost + item.companyCost]));
      const bars = keys.map(key => { const item = monthly[key], costs = item.eventCost + item.companyCost; return '<div class="executive-month"><div class="executive-bar-space"><i class="executive-bar income" style="height:' + Math.max(3, item.income / maxValue * 100) + '%" title="Faturamento: ' + Utils.fmt(item.income) + '"></i><i class="executive-bar cost" style="height:' + Math.max(3, costs / maxValue * 100) + '%" title="Custos: ' + Utils.fmt(costs) + '"></i></div><strong>' + monthLabel(key) + '</strong><small>' + Utils.fmt(item.income - costs) + '</small></div>'; }).join('');
      const currentCompany = (companyExpenses || []).filter(item => monthKey(item.data) === keys[keys.length - 1]);
      const grouped = currentCompany.reduce((acc, item) => { acc[item.categoria] = (acc[item.categoria] || 0) + Number(item.valor || 0); return acc; }, {}), catEntries = Object.entries(grouped).sort((a,b) => b[1]-a[1]);
      let angle = 0; const grand = Math.max(1, total(currentCompany)); const stops = catEntries.map((entry, index) => { const begin = angle; angle += entry[1] / grand * 360; return palette[index % palette.length] + ' ' + begin + 'deg ' + angle + 'deg'; }).join(', ') || '#ededf2 0deg 360deg';
      const catRows = catEntries.slice(0, 6).map((entry,index) => '<div class="executive-category" style="--cat-color:' + palette[index % palette.length] + '"><span>' + Utils.escapeHTML(categories[entry[0]] || entry[0]) + '</span><strong>' + Utils.fmt(entry[1]) + '</strong></div>').join('') || '<div class="ops-empty">Nenhuma despesa geral no mês.</div>';
      const name = document.getElementById('userNome')?.textContent || '';
      root.innerHTML = '<div class="executive-head"><div><div class="ops-kicker">VISÃO GERAL</div><h1>' + Utils.saudacao() + (name ? ', ' + Utils.escapeHTML(name) : '') + '</h1><p>Resumo simples da operação e do financeiro da 1K Beats.</p></div><button class="ops-btn" id="executiveNewQuote">+ Novo orçamento</button></div>' +
        '<div class="executive-kpis"><div class="executive-kpi"><span>Faturamento dos eventos</span><strong>' + Utils.fmt(current.income) + '</strong><small>mês atual</small></div><div class="executive-kpi"><span>Custos dos eventos</span><strong>' + Utils.fmt(current.eventCost) + '</strong><small>equipe, fornecedores e gastos</small></div><div class="executive-kpi"><span>Despesas da empresa</span><strong>' + Utils.fmt(current.companyCost) + '</strong><small>sem vínculo com evento</small></div><div class="executive-kpi"><span>Resultado estimado</span><strong class="' + (result >= 0 ? 'positive' : 'negative') + '">' + Utils.fmt(result) + '</strong><small>faturamento menos todos os custos</small></div></div>' +
        '<div class="executive-grid"><section class="executive-card"><div class="executive-card-head"><h2>Faturamento e custos · últimos 6 meses</h2><div class="executive-legend"><span><i style="background:#d91a72"></i>Faturamento</span><span><i style="background:#282834"></i>Custos</span></div></div><div class="executive-bars">' + bars + '</div></section><section class="executive-card"><div class="executive-card-head"><h2>Despesas da empresa por categoria</h2></div><div class="executive-donut" style="background:conic-gradient(' + stops + ')"><strong>' + Utils.fmt(total(currentCompany)) + '</strong></div><div class="executive-categories">' + catRows + '</div></section></div>';
      document.getElementById('executiveNewQuote')?.addEventListener('click', () => { Nav.showPanel('listaOrcamentos'); document.getElementById('btnNovoOrcamento')?.click(); });
    } catch (error) { root.innerHTML = '<div class="ops-empty">Não foi possível carregar a visão geral.</div>'; Utils.toast(Api.friendlyError(error), 'erro'); }
  };

  Agenda.abrirAcaoEvento = async function(evento, acao) {
    await this.carregarBaseOperacional();
    const producao = Producoes._data.producoes.find(item => item.id === evento.id) || evento;
    const concluir = async () => { await this.carregar(); Utils.toast('Evento atualizado.'); };
    if (acao === 'custo') return Producoes.modalGasto(producao, concluir);
    if (acao === 'fornecedor') return Producoes.modalFornecedor(producao, concluir);
  };

  Agenda.abrirFinanceiroEvento = async function(evento) {
    document.getElementById('opsModal')?.remove(); Nav.showPanel('financeiroEventos');
    if (evento.data_evento) FinanceiroEventos.mes = evento.data_evento.slice(0, 7);
    await FinanceiroEventos.carregar(); FinanceiroEventos.selecionadoId = evento.id; FinanceiroEventos.render();
  };

  Agenda.abrirOrdemEvento = async function(evento) {
    document.getElementById('opsModal')?.remove(); await OrdensServico.carregar();
    const producao = OrdensServico._data.producoes.find(item => item.id === evento.id) || evento;
    const existente = OrdensServico._data.ordens.find(item => item.producao_id === evento.id);
    if (!existente) return OrdensServico.abrirEditor(null, producao);
    const atual = OrdensServico.snapshot(producao);
    OrdensServico.abrirPreview({ ...existente, ...atual, id: existente.id, numero: existente.numero, producao_id: existente.producao_id, orcamento_id: existente.orcamento_id, status: existente.status, orientacoes: existente.orientacoes || atual.orientacoes, traje: existente.traje, observacoes: existente.observacoes });
  };

  Agenda.detalhes = function(evento) {
    if (!evento) return; document.getElementById('opsModal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'opsModal'; wrap.className = 'ops-modal';
    const lista = (titulo, valores) => '<section class="agenda-detail-section"><small>' + titulo + '</small><p>' + (valores.length ? valores.map(this.escape.bind(this)).join('<br>') : 'A definir') + '</p></section>';
    const actions = CONFIG.canManageOperations ? '<div class="agenda-central-actions"><button class="ops-btn secondary" data-event-action="edit">Editar evento</button><button class="ops-btn secondary" data-event-action="team">Equipe</button><button class="ops-btn secondary" data-event-action="cost">Registrar custo</button><button class="ops-btn secondary" data-event-action="supplier">Fornecedor externo</button><button class="ops-btn secondary" data-event-action="stock">Materiais / estoque</button><button class="ops-btn secondary" data-event-action="finance">Ver financeiro</button><button class="ops-btn" data-event-action="service-order">' + (evento.os ? 'Abrir ordem de serviço' : 'Gerar ordem de serviço') + '</button></div>' : '';
    wrap.innerHTML = '<div class="ops-modal-box agenda-detail" role="dialog" aria-modal="true"><div class="ops-modal-head"><div><small>EVENTO · ORÇAMENTO ' + this.escape(evento.orcamentos?.numero ? '#' + Utils.fmtNumero(evento.orcamentos.numero) : 'A DEFINIR') + '</small><h2>' + this.escape(evento.nome) + '</h2></div><button class="ops-icon" data-close>×</button></div><div class="agenda-detail-grid"><section><small>Data e montagem</small><p>' + this.escape(Utils.fmtDate(evento.data_evento)) + ' · ' + this.escape(evento.hora_montagem) + '</p></section><section><small>Produtor responsável</small><p>' + this.escape(evento.produtor_responsavel) + '</p></section><section class="full"><small>Local</small><p>' + this.escape(evento.local_evento) + '<br>' + this.escape(evento.endereco) + '</p></section>' + lista('Equipe técnica', evento.equipe) + lista('Materiais e serviços', evento.materiais) + '<section class="full"><small>Veículo</small><p>' + this.escape(evento.veiculo) + '</p></section></div>' + actions + '<div class="ops-modal-actions"><button class="ops-btn secondary" data-close>Fechar</button></div></div>';
    document.body.appendChild(wrap); const close = () => wrap.remove(); wrap.querySelectorAll('[data-close]').forEach(button => button.onclick = close); wrap.onclick = e => { if (e.target === wrap) close(); };
    wrap.querySelector('[data-event-action="edit"]')?.addEventListener('click', () => { close(); this.editarEvento(evento); });
    wrap.querySelector('[data-event-action="team"]')?.addEventListener('click', () => { close(); this.gerenciarEquipe(evento); });
    wrap.querySelector('[data-event-action="cost"]')?.addEventListener('click', () => { close(); this.abrirAcaoEvento(evento, 'custo'); });
    wrap.querySelector('[data-event-action="supplier"]')?.addEventListener('click', () => { close(); this.abrirAcaoEvento(evento, 'fornecedor'); });
    wrap.querySelector('[data-event-action="stock"]')?.addEventListener('click', () => { close(); Nav.showPanel('estoque'); });
    wrap.querySelector('[data-event-action="finance"]')?.addEventListener('click', () => this.abrirFinanceiroEvento(evento));
    wrap.querySelector('[data-event-action="service-order"]')?.addEventListener('click', () => this.abrirOrdemEvento(evento));
  };
})();
