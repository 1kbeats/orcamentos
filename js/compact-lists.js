(function installCompactOperationalLists() {
  const PAGE_SIZE = 10;

  function pageData(items, page) {
    const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (current - 1) * PAGE_SIZE;
    return { items: items.slice(start, start + PAGE_SIZE), current, pages, start, end: Math.min(start + PAGE_SIZE, items.length), total: items.length };
  }

  function pagination(data, noun) {
    if (!data.total) return '';
    return '<div class="compact-pagination"><span>Mostrando ' + (data.start + 1) + '–' + data.end + ' de ' + data.total + ' ' + noun + '</span><div><button type="button" data-page="' + (data.current - 1) + '"' + (data.current === 1 ? ' disabled' : '') + '>← Anterior</button><b>Página ' + data.current + ' de ' + data.pages + '</b><button type="button" data-page="' + (data.current + 1) + '"' + (data.current === data.pages ? ' disabled' : '') + '>Próxima →</button></div></div>';
  }

  function bindPagination(root, owner) {
    root.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
      owner._page = Number(button.dataset.page) || 1;
      owner.renderLista();
    }));
  }

  function moreMenu(content) {
    return '<details class="compact-more"><summary aria-label="Mais ações" title="Mais ações">•••</summary><div>' + content + '</div></details>';
  }

  Producoes._page = 1;
  Producoes.renderLista = function renderListaCompacta() {
    const root = document.getElementById('producoesContent');
    if (!root) return;
    const term = this._filters.busca.toLocaleLowerCase('pt-BR');
    const filtered = this._data.producoes.filter(producao => {
      const searchable = [producao.nome, producao.local_evento, producao.endereco, producao.orcamentos?.cliente_nome, producao.orcamentos?.referencia]
        .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
      return (!term || searchable) && (!this._filters.mes || String(producao.data_evento || '').slice(0, 7) === this._filters.mes) && (!this._filters.status || producao.status === this._filters.status);
    });
    const data = pageData(filtered, this._page); this._page = data.current;
    const labels = { planejamento: 'Planejamento', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' };
    const rows = data.items.map(producao => {
      const quoteId = producao.orcamento_id;
      const cost = this.itemTotal(this.getByQuote(this._data.gastos, quoteId)) + this.itemTotal(this.getByQuote(this._data.diarias, quoteId), 'valor_diaria') + this.itemTotal(this.getByQuote(this._data.fornecedoresEvento, quoteId));
      const income = Number(producao.orcamentos?.total) || 0; const margin = income - cost;
      const secondary = CONFIG.canManageOperations ? '<button type="button" data-edit-production="' + Utils.safeId(producao.id) + '">Editar</button><button type="button" class="danger" data-toggle-production="' + Utils.safeId(producao.id) + '">' + (producao.status === 'cancelado' ? 'Reativar' : 'Cancelar') + '</button>' : '';
      return '<article class="compact-row production-compact-row' + (producao.status === 'cancelado' ? ' archived' : '') + '"><div class="compact-date"><small>DATA</small><strong>' + this.escape(Utils.fmtDate(producao.data_evento) || 'A definir') + '</strong></div><div class="compact-main"><h3>' + this.escape(producao.nome) + '</h3><p>' + this.escape(producao.orcamentos?.cliente_nome) + '</p><span>' + this.escape(producao.local_evento || producao.endereco || 'Local a definir') + '</span></div><div class="compact-status"><small>STATUS</small><span class="ops-tag status-' + Utils.safeId(producao.status) + '">' + this.escape(labels[producao.status] || producao.status) + '</span></div><div class="compact-money"><small>RECEITA</small><strong>' + this.money(income) + '</strong></div><div class="compact-money compact-margin"><small>MARGEM</small><strong class="' + (margin >= 0 ? 'positive' : 'negative') + '">' + this.money(margin) + '</strong></div><div class="compact-actions"><button type="button" class="ops-btn secondary" data-open="' + Utils.safeId(producao.id) + '">Visualizar</button>' + (secondary ? moreMenu(secondary) : '') + '</div></article>';
    }).join('');
    const statusOptions = '<option value="">Todos</option>' + Object.entries(labels).map(entry => Operacoes.option(entry[0], entry[1], this._filters.status)).join('');
    const filters = '<div class="ops-filters">' + this.filterField('Buscar', 'productionSearch', 'search', this._filters.busca) + this.filterField('Mês do evento', 'productionMonth', 'month', this._filters.mes) + this.filterField('Status', 'productionStatus', 'select', '', statusOptions) + '<button type="button" class="ops-filter-clear" id="productionClear">Limpar filtros</button></div>';
    root.innerHTML = '<div class="ops-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Produções e eventos</h1><p>Central de montagem: equipe, fornecedores, gastos e resultado de cada evento.</p></div>' + (CONFIG.canManageOperations ? '<button class="ops-btn" id="btnNovaProducao">+ Nova produção</button>' : '') + '</div><div class="production-guide"><strong>Fluxo profissional:</strong> crie a produção a partir de um orçamento aprovado e atualize os dados sempre que a operação mudar.</div>' + filters + '<div class="compact-list-head production-compact-head"><span>Data</span><span>Evento e local</span><span>Status</span><span>Receita</span><span>Margem</span><span>Ações</span></div><div class="compact-list">' + (rows || '<div class="ops-empty">Nenhuma produção encontrada com estes filtros.</div>') + '</div>' + pagination(data, 'produções') + '</div>';

    root.querySelector('#btnNovaProducao')?.addEventListener('click', () => this.modalNova());
    root.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => { this._atual = this._data.producoes.find(item => item.id === button.dataset.open); this.renderDetalhe(this._atual); }));
    root.querySelectorAll('[data-edit-production]').forEach(button => button.addEventListener('click', () => { const item = this._data.producoes.find(producao => producao.id === button.dataset.editProduction); if (item) this.modalEditar(item); }));
    root.querySelectorAll('[data-toggle-production]').forEach(button => button.addEventListener('click', async () => {
      const item = this._data.producoes.find(producao => producao.id === button.dataset.toggleProduction); if (!item) return;
      const nextStatus = item.status === 'cancelado' ? 'planejamento' : 'cancelado';
      if (nextStatus === 'cancelado' && !confirm('Cancelar esta produção? O histórico e os custos serão preservados.')) return;
      try { await Api.request(Api.orgFilter('/rest/v1/producoes?id=eq.' + encodeURIComponent(item.id)), { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }); item.status = nextStatus; this.renderLista(); Utils.toast(nextStatus === 'cancelado' ? 'Produção cancelada e preservada.' : 'Produção reativada.'); } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); }
    }));
    const resetAndRender = () => { this._page = 1; this.renderLista(); };
    root.querySelector('#productionSearch')?.addEventListener('input', event => { this._filters.busca = event.target.value; clearTimeout(this._professionalFilterTimer); this._professionalFilterTimer = setTimeout(resetAndRender, 280); });
    root.querySelector('#productionMonth')?.addEventListener('change', event => { this._filters.mes = event.target.value; resetAndRender(); });
    root.querySelector('#productionStatus')?.addEventListener('change', event => { this._filters.status = event.target.value; resetAndRender(); });
    root.querySelector('#productionClear')?.addEventListener('click', () => { this._filters = { busca: '', mes: '', status: '' }; resetAndRender(); });
    bindPagination(root, this);
  };

  OrdensServico._page = 1;
  OrdensServico.renderLista = function renderListaCompacta() {
    const root = document.getElementById('ordemServicoContent'); if (!root) return;
    const search = this._filters.busca.toLocaleLowerCase('pt-BR');
    const filtered = this._data.ordens.filter(order => { const text = [order.titulo, order.cliente_nome, order.responsavel_nome, order.local_evento, this.numero(order.numero)].join(' ').toLocaleLowerCase('pt-BR'); return (!search || text.includes(search)) && (!this._filters.status || order.status === this._filters.status); });
    const data = pageData(filtered, this._page); this._page = data.current;
    const rows = data.items.map(order => {
      const secondary = CONFIG.canManageOperations ? '<button type="button" data-edit-os="' + Utils.safeId(order.id) + '">Editar</button>' + (order.status !== 'confirmada' ? '<button type="button" data-confirm-os="' + Utils.safeId(order.id) + '">Confirmar</button>' : '') : '';
      return '<article class="compact-row service-order-compact-row"><div class="compact-os-number"><small>ORDEM</small><strong>OS ' + this.numero(order.numero) + '</strong></div><div class="compact-date"><small>DATA</small><strong>' + this.escape(Utils.fmtDate(order.data_evento) || 'A definir') + '</strong></div><div class="compact-main"><h3>' + this.escape(order.titulo) + '</h3><p>' + this.escape(order.cliente_nome) + '</p><span>' + this.escape(order.local_evento || order.endereco || 'Local a definir') + '</span></div><div class="compact-person"><small>RESPONSÁVEL</small><strong>' + this.escape(order.responsavel_nome || 'A definir') + '</strong></div><div class="compact-status"><small>STATUS</small><span class="ops-tag status-' + Utils.safeId(order.status) + '">' + this.escape(this.statusLabel(order.status)) + '</span></div><div class="compact-actions"><button type="button" class="ops-btn secondary" data-view-os="' + Utils.safeId(order.id) + '">Visualizar</button>' + (secondary ? moreMenu(secondary) : '') + '</div></article>';
    }).join('');
    const hasAvailable = this._data.producoes.some(prod => !this._data.ordens.some(order => order.producao_id === prod.id));
    root.innerHTML = '<div class="ops-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Ordens de serviço</h1><p>Informações operacionais prontas para orientar técnicos e equipes.</p></div>' + (CONFIG.canManageOperations ? '<button class="ops-btn" id="btnNovaOS"' + (hasAvailable ? '' : ' disabled title="Todas as produções já possuem OS"') + '>+ Nova ordem de serviço</button>' : '') + '</div><div class="production-guide"><strong>Fluxo:</strong> gere a OS a partir de uma produção, revise as informações e envie ao técnico pelo WhatsApp.</div><div class="ops-filters service-order-filters"><label class="ops-field"><span>Buscar</span><input id="osBusca" type="search" value="' + this.safe(this._filters.busca) + '" placeholder="Número, evento, cliente ou técnico"></label><label class="ops-field"><span>Status</span><select id="osStatus"><option value="">Todos</option><option value="rascunho"' + (this._filters.status === 'rascunho' ? ' selected' : '') + '>Rascunho</option><option value="enviada"' + (this._filters.status === 'enviada' ? ' selected' : '') + '>Enviada</option><option value="confirmada"' + (this._filters.status === 'confirmada' ? ' selected' : '') + '>Confirmada</option></select></label><button class="ops-filter-clear" id="osLimpar">Limpar filtros</button></div><div class="compact-list-head service-order-compact-head"><span>OS</span><span>Data</span><span>Evento e local</span><span>Responsável</span><span>Status</span><span>Ações</span></div><div class="compact-list">' + (rows || '<div class="ops-empty">' + (this._data.ordens.length ? 'Nenhuma ordem encontrada com estes filtros.' : 'Nenhuma ordem de serviço criada. Crie uma produção primeiro e gere a OS por aqui.') + '</div>') + '</div>' + pagination(data, 'ordens de serviço') + '</div>';
    root.querySelector('#btnNovaOS')?.addEventListener('click', () => this.abrirEditor());
    const resetAndRender = () => { this._page = 1; this.renderLista(); };
    root.querySelector('#osBusca')?.addEventListener('input', event => { this._filters.busca = event.target.value; clearTimeout(this._timer); this._timer = setTimeout(resetAndRender, 280); });
    root.querySelector('#osStatus')?.addEventListener('change', event => { this._filters.status = event.target.value; resetAndRender(); });
    root.querySelector('#osLimpar')?.addEventListener('click', () => { this._filters = { busca: '', status: '' }; resetAndRender(); });
    root.querySelectorAll('[data-view-os]').forEach(button => button.addEventListener('click', () => this.abrirPreview(this._data.ordens.find(order => order.id === button.dataset.viewOs))));
    root.querySelectorAll('[data-edit-os]').forEach(button => button.addEventListener('click', () => this.abrirEditor(this._data.ordens.find(order => order.id === button.dataset.editOs))));
    root.querySelectorAll('[data-confirm-os]').forEach(button => button.addEventListener('click', () => this.confirmar(this._data.ordens.find(order => order.id === button.dataset.confirmOs))));
    bindPagination(root, this);
  };

  Operacoes._equipePage = 1;
  Operacoes._historicoPage = 1;
  Operacoes._equipeSelecionada = '';

  Operacoes.renderEquipe = function renderEquipeCompacta() {
    const root = document.getElementById('equipeContent');
    if (!root) return;
    if (typeof this._filters.equipeStatus === 'undefined') this._filters.equipeStatus = 'ativos';
    const term = String(this._filters.equipeBusca || '').toLocaleLowerCase('pt-BR');
    const filteredPeople = this._data.equipe.filter(person => {
      const matchesSearch = !term || [person.nome, person.funcao, person.telefone].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
      const matchesStatus = !this._filters.equipeStatus || (this._filters.equipeStatus === 'ativos' && person.ativo) || (this._filters.equipeStatus === 'arquivados' && !person.ativo);
      return matchesSearch && matchesStatus;
    });
    const peopleData = pageData(filteredPeople, this._equipePage); this._equipePage = peopleData.current;
    const peopleRows = peopleData.items.map(person => {
      const history = this._data.diarias.filter(item => item.equipe_id === person.id);
      const total = history.reduce((sum, item) => sum + (Number(item.valor_diaria) || 0), 0);
      const secondary = CONFIG.canManageOperations ? '<button type="button" data-edit="equipe" data-id="' + Utils.safeId(person.id) + '">Editar</button><button type="button" class="' + (person.ativo ? 'danger' : '') + '" data-archive="equipe" data-id="' + Utils.safeId(person.id) + '">' + (person.ativo ? 'Arquivar' : 'Reativar') + '</button>' : '';
      return '<article class="compact-row team-compact-row' + (person.ativo ? '' : ' archived') + '"><div class="compact-main team-person"><div class="ops-avatar">' + this.escape(person.nome.charAt(0).toUpperCase()) + '</div><div><h3>' + this.escape(person.nome) + '</h3><p>' + this.escape(person.funcao || 'Freelancer') + '</p></div></div><div class="compact-contact"><small>CONTATO</small><strong>' + this.escape(person.telefone || 'Sem telefone') + '</strong></div><div class="compact-money"><small>DIÁRIA PADRÃO</small><strong>' + this.money(person.valor_diaria) + '</strong></div><div class="compact-count"><small>EVENTOS</small><strong>' + history.length + '</strong></div><div class="compact-money compact-team-total"><small>TOTAL RECEBIDO</small><strong>' + this.money(total) + '</strong></div><div class="compact-status"><small>SITUAÇÃO</small><span class="ops-tag ' + (person.ativo ? 'status-confirmado' : 'status-cancelado') + '">' + (person.ativo ? 'Ativo' : 'Arquivado') + '</span></div><div class="compact-actions"><button type="button" class="ops-btn secondary" data-team-history="' + Utils.safeId(person.id) + '">' + (this._equipeSelecionada === person.id ? 'Exibindo' : 'Ver histórico') + '</button>' + (secondary ? moreMenu(secondary) : '') + '</div></article>';
    }).join('');
    const selected = this._data.equipe.find(person => person.id === this._equipeSelecionada);
    const filteredDiaries = this._data.diarias.filter(item => (!selected || item.equipe_id === selected.id) && (!this._filters.diariasEvento || item.orcamento_id === this._filters.diariasEvento));
    const historyData = pageData(filteredDiaries, this._historicoPage); this._historicoPage = historyData.current;
    const historyRows = historyData.items.map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.equipe?.nome) + '</strong><small>' + this.escape(item.funcao_evento || '') + '</small></td><td>' + this.escape(this.quoteLabel(item.orcamentos)) + '</td><td>' + this.escape(item.horario_inicio || '—') + '</td><td class="ops-money">' + this.money(item.valor_diaria) + '</td><td>' + this.actionButtons('equipe_diarias', item.id) + '</td></tr>').join('');
    const statusOptions = '<option value="">Todos</option>' + this.option('ativos', 'Ativos', this._filters.equipeStatus) + this.option('arquivados', 'Arquivados', this._filters.equipeStatus);
    const filters = '<div class="ops-filters team-filters">' + this.filterField('Buscar profissional', 'opsEquipeBusca', 'search', this._filters.equipeBusca) + this.filterField('Situação', 'opsEquipeStatus', 'select', '', statusOptions) + this.filterField('Evento das diárias', 'opsDiariasEvento', 'select', '', this.filterQuoteOptions(this._filters.diariasEvento)) + '<button type="button" class="ops-filter-clear" id="opsEquipeLimpar">Limpar filtros</button></div>';
    const historyTitle = selected ? 'Histórico de ' + this.escape(selected.nome) : 'Histórico de trabalho';
    const clearSelected = selected ? '<button type="button" class="ops-btn secondary history-all" id="opsHistoricoTodos">Ver todos</button>' : '';
    root.innerHTML = '<div class="ops-page">' + this.titulo('Equipe e freelancers', 'Técnicos de áudio, luz, vídeo e apoio, com diárias por evento.', 'Cadastrar profissional', 'opsNovaEquipe') + '<div class="ops-actions">' + (CONFIG.canManageOperations ? '<button class="ops-btn secondary" id="opsNovaDiaria">+ Registrar diária</button>' : '') + '<span>Arquivar mantém o histórico e retira o profissional dos novos lançamentos.</span></div>' + filters + '<div class="compact-list-head team-compact-head"><span>Profissional</span><span>Contato</span><span>Diária</span><span>Eventos</span><span>Total</span><span>Situação</span><span>Ações</span></div><div class="compact-list">' + (peopleRows || '<div class="ops-empty">Nenhum profissional encontrado.</div>') + '</div>' + pagination(peopleData, 'profissionais').replaceAll('data-page=', 'data-team-page=') + '<div class="ops-card team-history-card"><div class="ops-card-title"><div>' + historyTitle + ' <span>' + filteredDiaries.length + ' registro(s)</span></div>' + clearSelected + '</div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Profissional</th><th>Evento</th><th>Início</th><th>Diária</th><th>Ações</th></tr></thead><tbody>' + (historyRows || '<tr><td colspan="6" class="ops-empty">Nenhuma diária encontrada.</td></tr>') + '</tbody></table></div>' + pagination(historyData, 'diárias').replaceAll('data-page=', 'data-history-page=') + '</div></div>';
    root.querySelector('#opsNovaEquipe')?.addEventListener('click', () => this.modalEquipe());
    root.querySelector('#opsNovaDiaria')?.addEventListener('click', () => this.modalDiaria());
    root.querySelectorAll('[data-team-history]').forEach(button => button.addEventListener('click', () => { this._equipeSelecionada = button.dataset.teamHistory; this._historicoPage = 1; this.renderEquipe(); }));
    root.querySelector('#opsHistoricoTodos')?.addEventListener('click', () => { this._equipeSelecionada = ''; this._historicoPage = 1; this.renderEquipe(); });
    root.querySelectorAll('[data-team-page]').forEach(button => button.addEventListener('click', () => { this._equipePage = Number(button.dataset.teamPage) || 1; this.renderEquipe(); }));
    root.querySelectorAll('[data-history-page]').forEach(button => button.addEventListener('click', () => { this._historicoPage = Number(button.dataset.historyPage) || 1; this.renderEquipe(); }));
    const resetPeople = () => { this._equipePage = 1; this.renderEquipe(); };
    root.querySelector('#opsEquipeBusca')?.addEventListener('input', event => { this._filters.equipeBusca = event.target.value; clearTimeout(this._professionalFilterTimer); this._professionalFilterTimer = setTimeout(resetPeople, 280); });
    root.querySelector('#opsEquipeStatus')?.addEventListener('change', event => { this._filters.equipeStatus = event.target.value; resetPeople(); });
    root.querySelector('#opsDiariasEvento')?.addEventListener('change', event => { this._filters.diariasEvento = event.target.value; this._historicoPage = 1; this.renderEquipe(); });
    root.querySelector('#opsEquipeLimpar')?.addEventListener('click', () => { this._filters.equipeBusca = ''; this._filters.equipeStatus = 'ativos'; this._filters.diariasEvento = ''; this._equipeSelecionada = ''; this._equipePage = 1; this._historicoPage = 1; this.renderEquipe(); });
    this.bindProfessionalActions(root);
  };})();