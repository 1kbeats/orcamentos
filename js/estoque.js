const Estoque = {
  _data: { itens: [], movimentos: [], producoes: [] },
  _filters: { busca: '', categoria: '', situacao: 'ativos' },
  _itemPage: 1,
  _historyPage: 1,
  _selectedItem: '',
  PAGE_SIZE: 10,

  categories: {
    audio: 'Áudio', iluminacao: 'Iluminação', video: 'Vídeo', estrutura: 'Estrutura',
    cabos: 'Cabos', energia: 'Energia', acessorios: 'Acessórios', outros: 'Outros'
  },
  movementLabels: {
    cadastro: 'Cadastro inicial', saida_evento: 'Saída para evento', devolucao_evento: 'Devolução do evento',
    envio_manutencao: 'Envio para manutenção', retorno_manutencao: 'Retorno da manutenção',
    ajuste_entrada: 'Ajuste de entrada', ajuste_saida: 'Ajuste de saída'
  },

  async carregar() {
    if (!CONFIG.canViewOperations) return;
    const root = document.getElementById('estoqueContent');
    if (root) root.innerHTML = '<div class="ops-loading">Carregando estoque…</div>';
    try {
      const requests = [
        Api.request(Api.orgFilter('/rest/v1/estoque_itens?select=*&order=ativo.desc,nome.asc')),
        Api.request(Api.orgFilter('/rest/v1/estoque_movimentacoes?select=*,estoque_itens(nome,codigo),producoes(nome,data_evento,orcamentos(cliente_nome,referencia))&order=data_movimentacao.desc,created_at.desc')),
        Api.request(Api.orgFilter('/rest/v1/producoes?select=id,nome,data_evento,status,orcamentos(cliente_nome,referencia)&status=neq.cancelado&order=data_evento.desc'))
      ];
      const [itens, movimentos, producoes] = await Promise.all(requests);
      this._data = { itens: itens || [], movimentos: movimentos || [], producoes: producoes || [] };
      this.render();
    } catch (error) {
      if (root) root.innerHTML = '<div class="ops-empty">' + Utils.escapeHTML(Api.friendlyError(error, 'Não foi possível carregar o estoque.')) + '</div>';
    }
  },

  page(items, page) {
    const pages = Math.max(1, Math.ceil(items.length / this.PAGE_SIZE));
    const current = Math.min(Math.max(1, Number(page) || 1), pages);
    const start = (current - 1) * this.PAGE_SIZE;
    return { items: items.slice(start, start + this.PAGE_SIZE), current, pages, start, end: Math.min(start + this.PAGE_SIZE, items.length), total: items.length };
  },
  pagination(data, attr, noun) {
    if (!data.total) return '';
    return '<div class="compact-pagination"><span>Mostrando ' + (data.start + 1) + '–' + data.end + ' de ' + data.total + ' ' + noun + '</span><div><button type="button" ' + attr + '="' + (data.current - 1) + '"' + (data.current === 1 ? ' disabled' : '') + '>← Anterior</button><b>Página ' + data.current + ' de ' + data.pages + '</b><button type="button" ' + attr + '="' + (data.current + 1) + '"' + (data.current === data.pages ? ' disabled' : '') + '>Próxima →</button></div></div>';
  },
  option(value, label, selected) {
    return '<option value="' + Utils.escapeHTML(value) + '"' + (String(value) === String(selected || '') ? ' selected' : '') + '>' + Utils.escapeHTML(label) + '</option>';
  },
  money(value) { return Utils.fmt(Number(value) || 0); },
  status(item) {
    if (!item.ativo) return { key: 'arquivado', label: 'Arquivado' };
    if (!item.quantidade_total) return { key: 'sem_estoque', label: 'Sem estoque' };
    if (!item.quantidade_disponivel) return { key: 'indisponivel', label: 'Indisponível' };
    if (item.quantidade_disponivel < item.quantidade_total) return { key: 'parcial', label: 'Parcial' };
    return { key: 'disponivel', label: 'Disponível' };
  },
  productionLabel(item) {
    if (!item) return 'Sem evento vinculado';
    const quote = item.orcamentos;
    return item.nome + (quote?.cliente_nome ? ' · ' + quote.cliente_nome : '');
  },
  movementEffect(item) {
    const delta = Number(item.efeito_disponivel) || 0;
    return (delta > 0 ? '+' : '') + delta;
  },

  render() {
    const root = document.getElementById('estoqueContent');
    if (!root) return;
    const search = this._filters.busca.toLocaleLowerCase('pt-BR');
    const filtered = this._data.itens.filter(item => {
      const text = [item.nome, item.codigo, item.marca_modelo, item.numero_serie, item.localizacao].join(' ').toLocaleLowerCase('pt-BR');
      const situation = this.status(item).key;
      const matchesSituation = !this._filters.situacao ||
        (this._filters.situacao === 'ativos' && item.ativo) ||
        (this._filters.situacao === 'arquivados' && !item.ativo) ||
        (this._filters.situacao === situation);
      return (!search || text.includes(search)) && (!this._filters.categoria || item.categoria === this._filters.categoria) && matchesSituation;
    });
    const itemData = this.page(filtered, this._itemPage); this._itemPage = itemData.current;
    const total = this._data.itens.filter(item => item.ativo).reduce((sum, item) => sum + Number(item.quantidade_total || 0), 0);
    const available = this._data.itens.filter(item => item.ativo).reduce((sum, item) => sum + Number(item.quantidade_disponivel || 0), 0);
    const itemRows = itemData.items.map(item => {
      const state = this.status(item);
      const secondary = CONFIG.canManageOperations ? '<button type="button" data-edit-stock="' + Utils.safeId(item.id) + '">Editar cadastro</button><button type="button" data-stock-history="' + Utils.safeId(item.id) + '">Ver histórico</button><button type="button" class="' + (item.ativo ? 'danger' : '') + '" data-toggle-stock="' + Utils.safeId(item.id) + '">' + (item.ativo ? 'Arquivar' : 'Reativar') + '</button>' : '';
      return '<article class="compact-row stock-compact-row' + (item.ativo ? '' : ' archived') + '"><div class="compact-main"><h3>' + Utils.escapeHTML(item.nome) + '</h3><p>' + Utils.escapeHTML(item.marca_modelo || this.categories[item.categoria] || '') + '</p><span>' + Utils.escapeHTML(item.codigo || item.numero_serie || 'Sem código') + '</span></div><div class="stock-category"><small>CATEGORIA</small><strong>' + Utils.escapeHTML(this.categories[item.categoria] || item.categoria) + '</strong></div><div class="stock-location"><small>LOCALIZAÇÃO</small><strong>' + Utils.escapeHTML(item.localizacao || 'Não informada') + '</strong></div><div class="stock-quantity"><small>TOTAL</small><strong>' + Number(item.quantidade_total || 0) + '</strong></div><div class="stock-quantity available"><small>DISPONÍVEL</small><strong>' + Number(item.quantidade_disponivel || 0) + '</strong></div><div class="compact-status"><small>SITUAÇÃO</small><span class="ops-tag stock-status-' + state.key + '">' + state.label + '</span></div><div class="compact-actions">' + (CONFIG.canManageOperations && item.ativo ? '<button type="button" class="ops-btn secondary" data-move-stock="' + Utils.safeId(item.id) + '">Movimentar</button>' : '<button type="button" class="ops-btn secondary" data-stock-history="' + Utils.safeId(item.id) + '">Histórico</button>') + (secondary ? '<details class="compact-more"><summary aria-label="Mais ações" title="Mais ações">•••</summary><div>' + secondary + '</div></details>' : '') + '</div></article>';
    }).join('');

    const selected = this._data.itens.find(item => item.id === this._selectedItem);
    const history = this._data.movimentos.filter(item => !selected || item.item_id === selected.id);
    const historyData = this.page(history, this._historyPage); this._historyPage = historyData.current;
    const historyRows = historyData.items.map(item => {
      const effect = Number(item.efeito_disponivel) || 0;
      return '<tr><td>' + Utils.escapeHTML(Utils.fmtDate(String(item.data_movimentacao || '').slice(0, 10))) + '</td><td><strong>' + Utils.escapeHTML(item.estoque_itens?.nome || 'Equipamento') + '</strong><small>' + Utils.escapeHTML(item.estoque_itens?.codigo || '') + '</small></td><td><span class="ops-tag">' + Utils.escapeHTML(this.movementLabels[item.tipo] || item.tipo) + '</span></td><td class="stock-effect ' + (effect >= 0 ? 'positive' : 'negative') + '">' + this.movementEffect(item) + '</td><td>' + Utils.escapeHTML(item.producoes?.nome || '—') + '</td><td>' + Utils.escapeHTML(item.responsavel || '—') + '</td><td><strong>' + Number(item.saldo_disponivel_depois || 0) + '</strong> / ' + Number(item.saldo_total_depois || 0) + '</td></tr>';
    }).join('');
    const categoryOptions = '<option value="">Todas</option>' + Object.entries(this.categories).map(entry => this.option(entry[0], entry[1], this._filters.categoria)).join('');
    const situationOptions = '<option value="">Todas</option>' + [['ativos','Ativos'],['disponivel','Disponíveis'],['parcial','Parcialmente em uso'],['indisponivel','Indisponíveis'],['arquivados','Arquivados']].map(entry => this.option(entry[0], entry[1], this._filters.situacao)).join('');
    const clearHistory = selected ? '<button type="button" class="ops-btn secondary history-all" id="stockHistoryAll">Ver todos</button>' : '';
    root.innerHTML = '<div class="ops-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Estoque</h1><p>Equipamentos, disponibilidade, saídas, devoluções e manutenção.</p></div>' + (CONFIG.canManageOperations ? '<button class="ops-btn" id="stockNewItem">+ Cadastrar equipamento</button>' : '') + '</div><div class="ops-summary stock-summary"><div><span>Equipamentos ativos</span><strong>' + this._data.itens.filter(item => item.ativo).length + '</strong></div><div><span>Unidades totais</span><strong>' + total + '</strong></div><div><span>Disponíveis agora</span><strong class="positive">' + available + '</strong></div><div><span>Fora do estoque</span><strong class="' + (total - available > 0 ? 'negative' : '') + '">' + (total - available) + '</strong></div></div><div class="ops-filters stock-filters"><label><span>Buscar</span><input id="stockSearch" type="search" value="' + Utils.escapeHTML(this._filters.busca) + '" placeholder="Nome, código, série ou local"></label><label><span>Categoria</span><select id="stockCategory">' + categoryOptions + '</select></label><label><span>Situação</span><select id="stockSituation">' + situationOptions + '</select></label><button type="button" class="ops-filter-clear" id="stockClear">Limpar filtros</button></div><div class="compact-list-head stock-compact-head"><span>Equipamento</span><span>Categoria</span><span>Localização</span><span>Total</span><span>Disponível</span><span>Situação</span><span>Ações</span></div><div class="compact-list">' + (itemRows || '<div class="ops-empty">Nenhum equipamento encontrado.</div>') + '</div>' + this.pagination(itemData, 'data-stock-page', 'equipamentos') + '<div class="ops-card stock-history-card"><div class="ops-card-title"><div>' + (selected ? 'Histórico de ' + Utils.escapeHTML(selected.nome) : 'Histórico de movimentações') + ' <span>' + history.length + ' registro(s)</span></div>' + clearHistory + '</div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Equipamento</th><th>Movimento</th><th>Qtd.</th><th>Evento</th><th>Responsável</th><th>Saldo</th></tr></thead><tbody>' + (historyRows || '<tr><td colspan="7" class="ops-empty">Nenhuma movimentação registrada.</td></tr>') + '</tbody></table></div>' + this.pagination(historyData, 'data-stock-history-page', 'movimentações') + '</div></div>';
    this.bind(root);
  },

  bind(root) {
    root.querySelector('#stockNewItem')?.addEventListener('click', () => this.modalItem());
    root.querySelectorAll('[data-edit-stock]').forEach(button => button.addEventListener('click', () => this.modalItem(this._data.itens.find(item => item.id === button.dataset.editStock))));
    root.querySelectorAll('[data-move-stock]').forEach(button => button.addEventListener('click', () => this.modalMovement(this._data.itens.find(item => item.id === button.dataset.moveStock))));
    root.querySelectorAll('[data-stock-history]').forEach(button => button.addEventListener('click', () => { this._selectedItem = button.dataset.stockHistory; this._historyPage = 1; this.render(); }));
    root.querySelector('#stockHistoryAll')?.addEventListener('click', () => { this._selectedItem = ''; this._historyPage = 1; this.render(); });
    root.querySelectorAll('[data-toggle-stock]').forEach(button => button.addEventListener('click', () => this.toggleItem(button.dataset.toggleStock)));
    root.querySelectorAll('[data-stock-page]').forEach(button => button.addEventListener('click', () => { this._itemPage = Number(button.dataset.stockPage) || 1; this.render(); }));
    root.querySelectorAll('[data-stock-history-page]').forEach(button => button.addEventListener('click', () => { this._historyPage = Number(button.dataset.stockHistoryPage) || 1; this.render(); }));
    const reset = () => { this._itemPage = 1; this.render(); };
    root.querySelector('#stockSearch')?.addEventListener('input', event => { this._filters.busca = event.target.value; clearTimeout(this._timer); this._timer = setTimeout(reset, 280); });
    root.querySelector('#stockCategory')?.addEventListener('change', event => { this._filters.categoria = event.target.value; reset(); });
    root.querySelector('#stockSituation')?.addEventListener('change', event => { this._filters.situacao = event.target.value; reset(); });
    root.querySelector('#stockClear')?.addEventListener('click', () => { this._filters = { busca: '', categoria: '', situacao: 'ativos' }; reset(); });
  },

  field(label, name, type, value, required, extra) {
    return '<label class="ops-field"><span>' + label + '</span><input name="' + name + '" type="' + (type || 'text') + '" value="' + Utils.escapeHTML(value ?? '') + '"' + (required ? ' required' : '') + (extra || '') + '></label>';
  },
  select(label, name, options, required) { return '<label class="ops-field"><span>' + label + '</span><select name="' + name + '"' + (required ? ' required' : '') + '>' + options + '</select></label>'; },
  textarea(label, name, value) { return '<label class="ops-field full"><span>' + label + '</span><textarea name="' + name + '" rows="3">' + Utils.escapeHTML(value || '') + '</textarea></label>'; },
  openModal(title, body, onSave) {
    document.getElementById('stockModal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'stockModal'; wrap.className = 'ops-modal';
    wrap.innerHTML = '<div class="ops-modal-box stock-modal-box" role="dialog" aria-modal="true"><div class="ops-modal-head"><h2>' + Utils.escapeHTML(title) + '</h2><button class="ops-icon" type="button" data-close aria-label="Fechar">×</button></div><form id="stockForm">' + body + '<div class="ops-modal-actions"><button type="button" class="ops-btn secondary" data-close>Cancelar</button><button class="ops-btn" type="submit">Salvar</button></div></form></div>';
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => wrap.remove()));
    wrap.addEventListener('click', event => { if (event.target === wrap) wrap.remove(); });
    wrap.querySelector('#stockForm').addEventListener('submit', async event => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try { await onSave(new FormData(event.currentTarget)); wrap.remove(); await this.carregar(); Utils.toast('Registro salvo.'); }
      catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); button.disabled = false; }
    });
  },
  modalItem(item) {
    if (!CONFIG.canManageOperations) return;
    const categories = Object.entries(this.categories).map(entry => this.option(entry[0], entry[1], item?.categoria || 'audio')).join('');
    const quantity = item ? '<div class="ops-note full">Quantidade atual: <strong>' + item.quantidade_disponivel + ' disponível de ' + item.quantidade_total + '</strong>. Para alterar quantidades, registre uma movimentação.</div>' : this.field('Quantidade inicial', 'quantidade', 'number', 1, true, ' min="0" step="1" inputmode="numeric"');
    const active = item ? this.select('Situação do cadastro', 'ativo', this.option('true','Ativo',String(item.ativo)) + this.option('false','Arquivado',String(item.ativo)), true) : '';
    const body = '<div class="ops-form-grid">' + this.field('Nome do equipamento', 'nome', 'text', item?.nome, true) + this.select('Categoria', 'categoria', categories, true) + this.field('Código interno', 'codigo', 'text', item?.codigo) + this.field('Marca / modelo', 'marca_modelo', 'text', item?.marca_modelo) + this.field('Número de série', 'numero_serie', 'text', item?.numero_serie) + this.field('Localização', 'localizacao', 'text', item?.localizacao) + quantity + this.field('Valor de aquisição (R$)', 'valor_aquisicao', 'number', item?.valor_aquisicao ?? 0, false, ' min="0" step="0.01" inputmode="decimal"') + active + this.textarea('Observações', 'observacoes', item?.observacoes) + '</div>';
    this.openModal(item ? 'Editar equipamento' : 'Cadastrar equipamento', body, form => {
      const payload = { nome: Utils.sanitizeText(form.get('nome'),180), categoria: form.get('categoria'), codigo: Utils.sanitizeText(form.get('codigo'),80) || null, marca_modelo: Utils.sanitizeText(form.get('marca_modelo'),180) || null, numero_serie: Utils.sanitizeText(form.get('numero_serie'),120) || null, localizacao: Utils.sanitizeText(form.get('localizacao'),180) || null, valor_aquisicao: Math.max(0,Number(String(form.get('valor_aquisicao') || 0).replace(',','.')) || 0), observacoes: Utils.sanitizeText(form.get('observacoes'),2000) || null };
      if (item) { payload.ativo = form.get('ativo') === 'true'; return Api.request(Api.orgFilter('/rest/v1/estoque_itens?id=eq.' + encodeURIComponent(item.id)), { method:'PATCH', body:JSON.stringify(payload) }); }
      const quantityValue = Math.max(0,Math.floor(Number(form.get('quantidade')) || 0));
      return Api.request('/rest/v1/estoque_itens', { method:'POST', body:JSON.stringify(Api.orgPayload({ ...payload, quantidade_total:quantityValue, quantidade_disponivel:quantityValue })) });
    });
  },
  modalMovement(item) {
    if (!item || !CONFIG.canManageOperations) return;
    const types = [['saida_evento','Saída para evento'],['devolucao_evento','Devolução do evento'],['envio_manutencao','Envio para manutenção'],['retorno_manutencao','Retorno da manutenção'],['ajuste_entrada','Ajuste de entrada'],['ajuste_saida','Ajuste de saída']];
    const typeOptions = types.map(entry => this.option(entry[0],entry[1],'saida_evento')).join('');
    const productionOptions = '<option value="">Sem evento vinculado</option>' + this._data.producoes.map(prod => this.option(prod.id,this.productionLabel(prod),'')).join('');
    const now = new Date(); const local = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
    const body = '<div class="stock-balance-box"><span>Saldo atual</span><strong>' + item.quantidade_disponivel + ' disponível de ' + item.quantidade_total + '</strong></div><div class="ops-form-grid">' + this.select('Tipo de movimentação','tipo',typeOptions,true) + this.field('Quantidade','quantidade','number',1,true,' min="1" step="1" inputmode="numeric"') + this.select('Produção / evento','producao_id',productionOptions) + this.field('Data e horário','data_movimentacao','datetime-local',local,true) + this.field('Responsável','responsavel','text','') + this.textarea('Observações','observacoes','') + '</div>';
    this.openModal('Movimentar · ' + item.nome,body,form => Api.request('/rest/v1/rpc/registrar_movimentacao_estoque',{method:'POST',body:JSON.stringify({p_item_id:item.id,p_tipo:form.get('tipo'),p_quantidade:Math.floor(Number(form.get('quantidade'))||0),p_producao_id:form.get('producao_id')||null,p_responsavel:Utils.sanitizeText(form.get('responsavel'),180)||null,p_data_movimentacao:new Date(form.get('data_movimentacao')).toISOString(),p_observacoes:Utils.sanitizeText(form.get('observacoes'),2000)||null})}));
  },
  async toggleItem(id) {
    if (!CONFIG.canManageOperations) return;
    const item = this._data.itens.find(row => row.id === id); if (!item) return;
    if (item.ativo && item.quantidade_disponivel !== item.quantidade_total) return Utils.toast('Devolva todas as unidades antes de arquivar.', 'erro');
    try { await Api.request(Api.orgFilter('/rest/v1/estoque_itens?id=eq.' + encodeURIComponent(id)),{method:'PATCH',body:JSON.stringify({ativo:!item.ativo})}); await this.carregar(); Utils.toast(item.ativo?'Equipamento arquivado.':'Equipamento reativado.'); }
    catch(error){ Utils.toast(Api.friendlyError(error),'erro'); }
  }
};