const Producoes = {
  _data: { producoes: [], orcamentos: [], gastos: [], diarias: [], fornecedoresEvento: [], equipe: [], fornecedores: [] },
  _atual: null,

  async carregar() {
    if (!CONFIG.canViewOperations) return this.semPermissao();
    try {
      const requests = [
        ['producoes', '/rest/v1/producoes?select=*,orcamentos(id,numero,referencia,cliente_nome,total,status)&order=data_evento.asc.nullslast,created_at.desc'],
        ['orcamentos', '/rest/v1/orcamentos?select=id,numero,referencia,cliente_nome,total,status&order=created_at.desc&limit=100'],
        ['gastos', '/rest/v1/gastos?select=*&order=data.desc'],
        ['diarias', '/rest/v1/equipe_diarias?select=*,equipe(nome)&order=data.desc'],
        ['fornecedoresEvento', '/rest/v1/fornecedor_eventos?select=*,fornecedores(nome,tipo)&order=data.desc'],
        ['equipe', '/rest/v1/equipe?select=id,nome,funcao,valor_diaria,ativo&ativo=is.true&order=nome.asc'],
        ['fornecedores', '/rest/v1/fornecedores?select=id,nome,tipo,ativo&ativo=is.true&order=nome.asc']
      ];
      const results = await Promise.all(requests.map(async ([key, path]) => [key, await Api.request(Api.orgFilter(path)) || []]));
      results.forEach(([key, value]) => { this._data[key] = value; });
      this._atual ? this.renderDetalhe(this._atual) : this.renderLista();
    } catch (error) { Utils.toast(Api.friendlyError(error, 'Não foi possível carregar as produções.'), 'erro'); }
  },

  semPermissao() {
    const root = document.getElementById('producoesContent');
    if (root) root.innerHTML = '<div class="ops-page"><div class="ops-empty"><strong>Acesso administrativo necessário</strong><br>As produções e seus custos são restritos à administração.</div></div>';
  },

  escape(value) { return Utils.escapeHTML(value || '—'); },
  money(value) { return Utils.escapeHTML(Utils.fmt(value)); },
  quoteLabel(quote) { return quote ? '#' + Utils.fmtNumero(quote.numero) + (quote.referencia ? ' · ' + quote.referencia : '') + (quote.cliente_nome ? ' · ' + quote.cliente_nome : '') : '—'; },
  dateValue() { return new Date().toISOString().slice(0, 10); },
  itemTotal(items, field = 'valor') { return items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0); },
  getByQuote(items, quoteId) { return items.filter(item => item.orcamento_id === quoteId); },

  renderLista() {
    const root = document.getElementById('producoesContent');
    if (!root) return;
    const rows = this._data.producoes.map(producao => {
      const quoteId = producao.orcamento_id;
      const custo = this.itemTotal(this.getByQuote(this._data.gastos, quoteId)) + this.itemTotal(this.getByQuote(this._data.diarias, quoteId), 'valor_diaria') + this.itemTotal(this.getByQuote(this._data.fornecedoresEvento, quoteId));
      const receita = Number(producao.orcamentos?.total) || 0;
      const status = { planejamento: 'Planejamento', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' }[producao.status] || producao.status;
      return '<article class="production-card"><div class="production-card-head"><div><span class="ops-tag">' + this.escape(status) + '</span><h3>' + this.escape(producao.nome) + '</h3><p>' + this.escape(producao.orcamentos?.cliente_nome) + '</p></div><button class="ops-btn secondary" data-open="' + Utils.safeId(producao.id) + '">Abrir produção</button></div><div class="production-meta"><span>📅 ' + this.escape(Utils.fmtDate(producao.data_evento) || 'Data a definir') + '</span><span>📍 ' + this.escape(producao.local_evento || producao.endereco || 'Local a definir') + '</span></div><div class="production-numbers"><div><span>Receita</span><strong>' + this.money(receita) + '</strong></div><div><span>Custo lançado</span><strong>' + this.money(custo) + '</strong></div><div><span>Margem</span><strong class="' + (receita - custo >= 0 ? 'positive' : 'negative') + '">' + this.money(receita - custo) + '</strong></div></div></article>';
    }).join('');
    root.innerHTML = '<div class="ops-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Produções e eventos</h1><p>Central de montagem: equipe, fornecedores, gastos e resultado de cada evento.</p></div><button class="ops-btn" id="btnNovaProducao">+ Nova produção</button></div><div class="production-guide"><strong>Como funciona:</strong> crie a produção a partir de um orçamento aprovado. Depois, registre todos os custos e a escala dentro dela.</div><div class="production-grid">' + (rows || '<div class="ops-empty">Nenhuma produção criada. Comece transformando um orçamento aprovado em evento.</div>') + '</div></div>';
    root.querySelector('#btnNovaProducao')?.addEventListener('click', () => this.modalNova());
    root.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => { this._atual = this._data.producoes.find(p => p.id === button.dataset.open); this.renderDetalhe(this._atual); }));
  },

  renderDetalhe(producao) {
    const root = document.getElementById('producoesContent');
    if (!root || !producao) return this.renderLista();
    const quoteId = producao.orcamento_id;
    const gastos = this.getByQuote(this._data.gastos, quoteId);
    const diarias = this.getByQuote(this._data.diarias, quoteId);
    const fornecedores = this.getByQuote(this._data.fornecedoresEvento, quoteId);
    const gastosTotal = this.itemTotal(gastos);
    const equipeTotal = this.itemTotal(diarias, 'valor_diaria');
    const fornecedoresTotal = this.itemTotal(fornecedores);
    const receita = Number(producao.orcamentos?.total) || 0;
    const custo = gastosTotal + equipeTotal + fornecedoresTotal;
    const item = (label, detail, amount) => '<div class="production-line"><div><strong>' + this.escape(label) + '</strong><small>' + this.escape(detail) + '</small></div><b>' + this.money(amount) + '</b></div>';
    root.innerHTML = '<div class="ops-page"><button class="production-back" id="btnVoltarProducoes">← Todas as produções</button><div class="production-detail-head"><div><div class="ops-kicker">PRODUÇÃO • ' + this.escape(this.quoteLabel(producao.orcamentos)) + '</div><h1>' + this.escape(producao.nome) + '</h1><p>' + this.escape(producao.orcamentos?.cliente_nome) + ' · ' + this.escape(Utils.fmtDate(producao.data_evento) || 'Data a definir') + '</p></div><span class="ops-tag">' + this.escape(producao.status) + '</span></div><div class="production-info"><div><span>Montagem</span><strong>' + this.escape(producao.hora_montagem || 'A definir') + '</strong></div><div><span>Início do evento</span><strong>' + this.escape(producao.hora_evento || 'A definir') + '</strong></div><div><span>Local</span><strong>' + this.escape(producao.local_evento || producao.endereco || 'A definir') + '</strong></div><div><span>Veículo</span><strong>' + this.escape(producao.veiculo || 'A definir') + '</strong></div></div><div class="production-actions"><button class="ops-btn" id="btnProdGasto">+ Lançar gasto</button><button class="ops-btn secondary" id="btnProdDiaria">+ Escalar técnico</button><button class="ops-btn secondary" id="btnProdFornecedor">+ Adicionar fornecedor</button></div><div class="ops-summary"><div><span>Orçamento aprovado</span><strong>' + this.money(receita) + '</strong></div><div><span>Custo lançado</span><strong>' + this.money(custo) + '</strong></div><div><span>Margem prevista</span><strong class="' + (receita - custo >= 0 ? 'positive' : 'negative') + '">' + this.money(receita - custo) + '</strong></div><div><span>Status</span><strong>' + this.escape(producao.status) + '</strong></div></div><div class="production-columns"><section class="ops-card"><div class="ops-card-title">Equipe técnica <span>' + diarias.length + ' pessoa(s)</span></div><div class="production-list">' + (diarias.map(d => item(d.equipe?.nome, d.funcao_evento || 'Diária', d.valor_diaria)).join('') || '<div class="ops-empty">Nenhum técnico escalado.</div>') + '</div></section><section class="ops-card"><div class="ops-card-title">Fornecedores externos <span>' + fornecedores.length + ' lançamento(s)</span></div><div class="production-list">' + (fornecedores.map(f => item(f.fornecedores?.nome, f.descricao_servico || f.fornecedores?.tipo, f.valor)).join('') || '<div class="ops-empty">Nenhum fornecedor lançado.</div>') + '</div></section><section class="ops-card"><div class="ops-card-title">Gastos da produção <span>' + gastos.length + ' lançamento(s)</span></div><div class="production-list">' + (gastos.map(g => item(g.descricao, g.categoria, g.valor)).join('') || '<div class="ops-empty">Nenhum gasto lançado.</div>') + '</div></section></div><div class="ops-note">Endereço: ' + this.escape(producao.endereco || 'não informado') + (producao.observacoes ? '<br>Observações: ' + this.escape(producao.observacoes) : '') + '</div></div>';
    root.querySelector('#btnVoltarProducoes').addEventListener('click', () => { this._atual = null; this.renderLista(); });
    root.querySelector('#btnProdGasto')?.addEventListener('click', () => this.modalGasto(producao));
    root.querySelector('#btnProdDiaria')?.addEventListener('click', () => this.modalDiaria(producao));
    root.querySelector('#btnProdFornecedor')?.addEventListener('click', () => this.modalFornecedor(producao));
  },

  modal(title, body, onSave) {
    document.getElementById('opsModal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'opsModal'; wrap.className = 'ops-modal';
    wrap.innerHTML = '<div class="ops-modal-box" role="dialog" aria-modal="true"><div class="ops-modal-head"><h2>' + title + '</h2><button class="ops-icon" type="button" data-close>×</button></div><form id="opsForm">' + body + '<div class="ops-modal-actions"><button type="button" class="ops-btn secondary" data-close>Cancelar</button><button class="ops-btn" type="submit">Salvar</button></div></form></div>';
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => wrap.remove()));
    wrap.addEventListener('click', event => { if (event.target === wrap) wrap.remove(); });
    wrap.querySelector('#opsForm').addEventListener('submit', async event => {
      event.preventDefault(); const button = event.submitter; button.disabled = true;
      try { await onSave(new FormData(event.currentTarget)); wrap.remove(); await this.carregar(); Utils.toast('Registro salvo.'); }
      catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); button.disabled = false; }
    });
  },
  field(...args) { return Operacoes.field(...args); },
  select(...args) { return Operacoes.select(...args); },
  text(...args) { return Operacoes.text(...args); },
  value(form, name, max = 300) { return Utils.sanitizeText(form.get(name), max) || null; },
  number(form, name) { return Math.max(0, Number(String(form.get(name) || '').replace(',', '.')) || 0); },
  date(form, name) { return this.value(form, name, 10) || this.dateValue(); },
  time(form, name) { return this.value(form, name, 5); },

  modalNova() {
    const available = this._data.orcamentos.filter(q => q.status === 'aprovado' && !this._data.producoes.some(p => p.orcamento_id === q.id));
    const options = '<option value="">Selecione o orçamento aprovado</option>' + available.map(q => '<option value="' + Utils.safeId(q.id) + '">' + this.escape(this.quoteLabel(q)) + '</option>').join('');
    this.modal('Nova produção / evento', '<div class="ops-form-grid">' + this.select('Orçamento aprovado', 'orcamento_id', options, true) + this.field('Nome do evento / serviço', 'nome', 'text', true) + this.field('Data do evento', 'data_evento', 'date') + this.field('Horário de montagem', 'hora_montagem', 'time') + this.field('Horário de início', 'hora_evento', 'time') + this.field('Local / casa de eventos', 'local_evento') + this.field('Endereço completo', 'endereco') + this.field('Veículo designado', 'veiculo') + this.select('Status', 'status', '<option value="planejamento">Planejamento</option><option value="confirmado">Confirmado</option>') + this.text('Informações operacionais', 'observacoes') + '</div>', async form => Api.request('/rest/v1/producoes', { method: 'POST', body: JSON.stringify(Api.orgPayload({ orcamento_id: this.value(form, 'orcamento_id', 50), nome: this.value(form, 'nome', 180), data_evento: this.value(form, 'data_evento', 10), hora_montagem: this.time(form, 'hora_montagem'), hora_evento: this.time(form, 'hora_evento'), local_evento: this.value(form, 'local_evento', 180), endereco: this.value(form, 'endereco', 300), veiculo: this.value(form, 'veiculo', 120), status: form.get('status'), observacoes: this.value(form, 'observacoes', 3000) })) }));

    const modal = document.getElementById('opsModal');
    const quoteSelect = modal?.querySelector('[name="orcamento_id"]');
    const nameInput = modal?.querySelector('[name="nome"]');
    if (!quoteSelect || !nameInput) return;

    nameInput.placeholder = 'Ex.: Inauguração da Praça XV';
    let lastSuggestedName = '';
    quoteSelect.addEventListener('change', () => {
      const quote = available.find(item => item.id === quoteSelect.value);
      const suggestedName = quote?.referencia || '';
      if (!nameInput.value.trim() || nameInput.value === lastSuggestedName) {
        nameInput.value = suggestedName;
      }
      lastSuggestedName = suggestedName;
    });
  },

  modalGasto(producao) { this.modal('Lançar gasto da produção', '<div class="ops-form-grid">' + this.field('Data', 'data', 'date', true, producao.data_evento || this.dateValue()) + this.select('Categoria', 'categoria', '<option value="combustivel">Combustível</option><option value="alimentacao">Alimentação</option><option value="manutencao">Manutenção</option><option value="equipamento">Equipamento</option><option value="logistica">Logística</option><option value="nota_fiscal">Nota fiscal</option><option value="outro">Outro</option>', true) + this.field('Descrição', 'descricao', 'text', true) + this.field('Valor (R$)', 'valor', 'number', true) + this.field('Fornecedor / posto', 'fornecedor') + this.field('Número da NF', 'nota_fiscal') + this.select('Pagamento', 'status_pagamento', '<option value="pago">Pago</option><option value="pendente">Pendente</option>') + this.text('Observações', 'observacoes') + '</div>', async form => Api.request('/rest/v1/gastos', { method: 'POST', body: JSON.stringify(Api.orgPayload({ orcamento_id: producao.orcamento_id, data: this.date(form, 'data'), categoria: form.get('categoria'), descricao: this.value(form, 'descricao'), valor: this.number(form, 'valor'), fornecedor: this.value(form, 'fornecedor'), nota_fiscal: this.value(form, 'nota_fiscal'), status_pagamento: form.get('status_pagamento'), observacoes: this.value(form, 'observacoes', 2000) })) })); },
  modalDiaria(producao) { const options = '<option value="">Selecione o técnico</option>' + this._data.equipe.map(p => '<option value="' + Utils.safeId(p.id) + '">' + this.escape(p.nome + (p.funcao ? ' · ' + p.funcao : '')) + '</option>').join(''); this.modal('Escalar técnico', '<div class="ops-form-grid">' + this.select('Técnico / freelancer', 'equipe_id', options, true) + this.field('Data', 'data', 'date', true, producao.data_evento || this.dateValue()) + this.field('Valor da diária (R$)', 'valor_diaria', 'number', true) + this.field('Função no evento', 'funcao_evento') + this.field('Início', 'horario_inicio', 'time') + this.field('Fim', 'horario_fim', 'time') + this.text('Observações', 'observacoes') + '</div>', async form => Api.request('/rest/v1/equipe_diarias', { method: 'POST', body: JSON.stringify(Api.orgPayload({ orcamento_id: producao.orcamento_id, equipe_id: this.value(form, 'equipe_id', 50), data: this.date(form, 'data'), valor_diaria: this.number(form, 'valor_diaria'), funcao_evento: this.value(form, 'funcao_evento'), horario_inicio: this.time(form, 'horario_inicio'), horario_fim: this.time(form, 'horario_fim'), observacoes: this.value(form, 'observacoes', 2000) })) })); },
  modalFornecedor(producao) { const options = '<option value="">Selecione o fornecedor</option>' + this._data.fornecedores.map(p => '<option value="' + Utils.safeId(p.id) + '">' + this.escape(p.nome + ' · ' + p.tipo) + '</option>').join(''); this.modal('Adicionar fornecedor', '<div class="ops-form-grid">' + this.select('Fornecedor', 'fornecedor_id', options, true) + this.field('Data', 'data', 'date', true, producao.data_evento || this.dateValue()) + this.field('Valor contratado (R$)', 'valor', 'number', true) + this.field('Serviço contratado', 'descricao_servico') + this.field('Horário de chegada', 'horario_chegada', 'time') + this.select('Pagamento', 'status_pagamento', '<option value="pendente">Pendente</option><option value="pago">Pago</option>') + this.text('Observações', 'observacoes') + '</div>', async form => Api.request('/rest/v1/fornecedor_eventos', { method: 'POST', body: JSON.stringify(Api.orgPayload({ orcamento_id: producao.orcamento_id, fornecedor_id: this.value(form, 'fornecedor_id', 50), data: this.date(form, 'data'), valor: this.number(form, 'valor'), descricao_servico: this.value(form, 'descricao_servico'), horario_chegada: this.time(form, 'horario_chegada'), status_pagamento: form.get('status_pagamento'), observacoes: this.value(form, 'observacoes', 2000) })) })); }
};
