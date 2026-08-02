(function enhanceOperations() {
  Operacoes._filters = {
    gastosMes: new Date().toISOString().slice(0, 7),
    gastosEvento: '',
    gastosPagamento: '',
    equipeBusca: '',
    diariasEvento: '',
    fornecedorBusca: '',
    fornecedorEvento: '',
    fornecedorPagamento: ''
  };

  Operacoes.option = function option(value, label, selected) {
    return '<option value="' + Utils.escapeHTML(value) + '"' + (String(value) === String(selected || '') ? ' selected' : '') + '>' + Utils.escapeHTML(label || '') + '</option>';
  };

  Operacoes.choices = function choices(items, selected) {
    return items.map(item => this.option(item[0], item[1], selected)).join('');
  };

  Operacoes.editField = function editField(label, name, type, required, value) {
    const inputMode = type === 'number' ? ' inputmode="decimal"' : (type === 'tel' ? ' inputmode="tel"' : '');
    return '<label class="ops-field"><span>' + label + '</span><input name="' + name + '" type="' + (type || 'text') + '"' +
      (type === 'number' ? ' min="0" step="0.01"' : '') + inputMode + ' value="' + Utils.escapeHTML(value ?? '') + '"' +
      (required ? ' required' : '') + '></label>';
  };

  Operacoes.editText = function editText(label, name, value) {
    return '<label class="ops-field full"><span>' + label + '</span><textarea name="' + name + '" rows="3">' + Utils.escapeHTML(value || '') + '</textarea></label>';
  };

  Operacoes.quoteOptionsFor = function quoteOptionsFor(selected) {
    return '<option value="">Sem evento vinculado</option>' + this._data.orcamentos.map(quote =>
      this.option(quote.id, this.quoteLabel(quote), selected)
    ).join('');
  };

  Operacoes.entityOptions = function entityOptions(items, label, selected) {
    return '<option value="">Selecione</option>' + items.map(item => this.option(item.id, label(item), selected)).join('');
  };

  Operacoes.saveRecord = function saveRecord(table, item, payload) {
    return Api.request(item
      ? Api.orgFilter('/rest/v1/' + table + '?id=eq.' + encodeURIComponent(item.id))
      : '/rest/v1/' + table, {
        method: item ? 'PATCH' : 'POST',
        body: JSON.stringify(item ? payload : Api.orgPayload(payload))
      });
  };

  Operacoes.modalGasto = function modalGasto(item) {
    const categories = [['combustivel', 'Combustível'], ['alimentacao', 'Alimentação'], ['manutencao', 'Manutenção'], ['equipamento', 'Equipamento'], ['logistica', 'Logística'], ['nota_fiscal', 'Nota fiscal'], ['outro', 'Outro']];
    this.modal(item ? 'Editar gasto' : 'Registrar gasto',
      '<div class="ops-form-grid">' +
      this.editField('Data', 'data', 'date', true, item?.data || new Date().toISOString().slice(0, 10)) +
      this.select('Categoria', 'categoria', this.choices(categories, item?.categoria), true) +
      this.editField('Descrição', 'descricao', 'text', true, item?.descricao) +
      this.editField('Valor (R$)', 'valor', 'number', true, item?.valor) +
      this.editField('Fornecedor / posto', 'fornecedor', 'text', false, item?.fornecedor) +
      this.editField('Número da NF', 'nota_fiscal', 'text', false, item?.nota_fiscal) +
      this.select('Evento (opcional)', 'orcamento_id', this.quoteOptionsFor(item?.orcamento_id)) +
      this.select('Pagamento', 'status_pagamento', this.choices([['pago', 'Pago'], ['pendente', 'Pendente']], item?.status_pagamento || 'pago')) +
      this.editText('Observações', 'observacoes', item?.observacoes) + '</div>',
      form => this.saveRecord('gastos', item, {
        data: this.date(form, 'data'), categoria: form.get('categoria'), descricao: this.val(form, 'descricao'),
        fornecedor: this.val(form, 'fornecedor'), nota_fiscal: this.val(form, 'nota_fiscal'), valor: this.num(form, 'valor'),
        orcamento_id: this.val(form, 'orcamento_id', 50), status_pagamento: form.get('status_pagamento'),
        observacoes: this.val(form, 'observacoes', 2000)
      })
    );
  };

  Operacoes.modalEquipe = function modalEquipe(item) {
    this.modal(item ? 'Editar profissional' : 'Cadastrar profissional',
      '<div class="ops-form-grid">' +
      this.editField('Nome completo', 'nome', 'text', true, item?.nome) +
      this.editField('Função principal', 'funcao', 'text', false, item?.funcao) +
      this.editField('Telefone / WhatsApp', 'telefone', 'tel', false, item?.telefone) +
      this.editField('E-mail', 'email', 'email', false, item?.email) +
      this.editField('Diária padrão (R$)', 'valor_diaria', 'number', true, item?.valor_diaria ?? 0) +
      this.editField('CPF (restrito)', 'cpf', 'text', false, item?.cpf) +
      this.editField('RG (restrito)', 'rg', 'text', false, item?.rg) +
      this.editField('Filiação (restrito)', 'filiacao', 'text', false, item?.filiacao) +
      this.editText('Observações', 'observacoes', item?.observacoes) + '</div>',
      form => this.saveRecord('equipe', item, {
        nome: this.val(form, 'nome'), funcao: this.val(form, 'funcao'), telefone: this.val(form, 'telefone'),
        email: this.val(form, 'email'), valor_diaria: this.num(form, 'valor_diaria'), cpf: this.val(form, 'cpf', 30),
        rg: this.val(form, 'rg', 30), filiacao: this.val(form, 'filiacao', 200), observacoes: this.val(form, 'observacoes', 2000)
      })
    );
  };

  Operacoes.modalDiaria = function modalDiaria(item) {
    const people = this._data.equipe.filter(person => person.ativo || person.id === item?.equipe_id);
    this.modal(item ? 'Editar diária' : 'Registrar diária',
      '<div class="ops-form-grid">' +
      this.select('Profissional', 'equipe_id', this.entityOptions(people, person => person.nome, item?.equipe_id), true) +
      this.select('Evento', 'orcamento_id', this.quoteOptionsFor(item?.orcamento_id)) +
      this.editField('Data', 'data', 'date', true, item?.data || new Date().toISOString().slice(0, 10)) +
      this.editField('Valor da diária (R$)', 'valor_diaria', 'number', true, item?.valor_diaria) +
      this.editField('Função no evento', 'funcao_evento', 'text', false, item?.funcao_evento) +
      this.editField('Horário de início', 'horario_inicio', 'time', false, item?.horario_inicio) +
      this.editField('Horário de fim', 'horario_fim', 'time', false, item?.horario_fim) +
      this.editText('Observações', 'observacoes', item?.observacoes) + '</div>',
      form => this.saveRecord('equipe_diarias', item, {
        equipe_id: this.val(form, 'equipe_id', 50), orcamento_id: this.val(form, 'orcamento_id', 50),
        data: this.date(form, 'data'), valor_diaria: this.num(form, 'valor_diaria'),
        funcao_evento: this.val(form, 'funcao_evento'), horario_inicio: this.time(form, 'horario_inicio'),
        horario_fim: this.time(form, 'horario_fim'), observacoes: this.val(form, 'observacoes', 2000)
      })
    );
  };

  Operacoes.modalFornecedor = function modalFornecedor(item) {
    const types = [['carregador', 'Carregador'], ['transporte', 'Transporte'], ['locacao', 'Locação'], ['prestador', 'Prestador'], ['outro', 'Outro']];
    this.modal(item ? 'Editar fornecedor' : 'Cadastrar fornecedor',
      '<div class="ops-form-grid">' +
      this.editField('Nome / empresa', 'nome', 'text', true, item?.nome) +
      this.select('Tipo', 'tipo', this.choices(types, item?.tipo || 'prestador'), true) +
      this.editField('Pessoa de contato', 'contato', 'text', false, item?.contato) +
      this.editField('Telefone / WhatsApp', 'telefone', 'tel', false, item?.telefone) +
      this.editField('E-mail', 'email', 'email', false, item?.email) +
      this.editText('Observações', 'observacoes', item?.observacoes) + '</div>',
      form => this.saveRecord('fornecedores', item, {
        nome: this.val(form, 'nome'), tipo: form.get('tipo'), contato: this.val(form, 'contato'),
        telefone: this.val(form, 'telefone'), email: this.val(form, 'email'), observacoes: this.val(form, 'observacoes', 2000)
      })
    );
  };

  Operacoes.modalFornecedorEvento = function modalFornecedorEvento(item) {
    const suppliers = this._data.fornecedores.filter(supplier => supplier.ativo || supplier.id === item?.fornecedor_id);
    this.modal(item ? 'Editar fornecedor do evento' : 'Vincular fornecedor ao evento',
      '<div class="ops-form-grid">' +
      this.select('Fornecedor', 'fornecedor_id', this.entityOptions(suppliers, supplier => supplier.nome + ' · ' + supplier.tipo, item?.fornecedor_id), true) +
      this.select('Evento', 'orcamento_id', this.quoteOptionsFor(item?.orcamento_id)) +
      this.editField('Data', 'data', 'date', true, item?.data || new Date().toISOString().slice(0, 10)) +
      this.editField('Valor contratado (R$)', 'valor', 'number', true, item?.valor) +
      this.editField('Serviço contratado', 'descricao_servico', 'text', false, item?.descricao_servico) +
      this.editField('Horário de chegada', 'horario_chegada', 'time', false, item?.horario_chegada) +
      this.select('Pagamento', 'status_pagamento', this.choices([['pendente', 'Pendente'], ['pago', 'Pago']], item?.status_pagamento || 'pendente')) +
      this.editText('Observações', 'observacoes', item?.observacoes) + '</div>',
      form => this.saveRecord('fornecedor_eventos', item, {
        fornecedor_id: this.val(form, 'fornecedor_id', 50), orcamento_id: this.val(form, 'orcamento_id', 50),
        data: this.date(form, 'data'), valor: this.num(form, 'valor'), descricao_servico: this.val(form, 'descricao_servico'),
        horario_chegada: this.time(form, 'horario_chegada'), status_pagamento: form.get('status_pagamento'),
        observacoes: this.val(form, 'observacoes', 2000)
      })
    );
  };

  Operacoes.actionButtons = function actionButtons(kind, id, archiveLabel) {
    if (!CONFIG.canManageOperations) return '';
    return '<div class="ops-row-actions"><button type="button" class="ops-action edit" data-edit="' + kind + '" data-id="' + Utils.safeId(id) + '">Editar</button>' +
      (archiveLabel
        ? '<button type="button" class="ops-action archive" data-archive="' + kind + '" data-id="' + Utils.safeId(id) + '">' + archiveLabel + '</button>'
        : '<button type="button" class="ops-action danger" data-delete="' + kind + '" data-id="' + Utils.safeId(id) + '">Excluir</button>') +
      '</div>';
  };

  Operacoes.filterQuoteOptions = function filterQuoteOptions(selected) {
    return '<option value="">Todos os eventos</option>' + this._data.orcamentos.map(quote => this.option(quote.id, this.quoteLabel(quote), selected)).join('');
  };

  Operacoes.filtersHtml = function filtersHtml(fields) {
    return '<div class="ops-filters">' + fields + '<button type="button" class="ops-filter-clear" data-clear-filters>Limpar filtros</button></div>';
  };

  Operacoes.filterField = function filterField(label, id, type, value, content) {
    return '<label><span>' + label + '</span>' + (type === 'select'
      ? '<select id="' + id + '">' + content + '</select>'
      : '<input id="' + id + '" type="' + type + '" value="' + Utils.escapeHTML(value || '') + '" autocomplete="off">') + '</label>';
  };

  Operacoes.bindProfessionalFilters = function bindProfessionalFilters(root, mapping, render) {
    Object.entries(mapping).forEach(entry => {
      const field = root.querySelector('#' + entry[0]);
      field?.addEventListener(field.type === 'search' ? 'input' : 'change', event => {
        this._filters[entry[1]] = event.target.value;
        if (field.type === 'search') {
          clearTimeout(this._professionalFilterTimer);
          this._professionalFilterTimer = setTimeout(render, 280);
          return;
        }
        render();
      });
    });
    root.querySelector('[data-clear-filters]')?.addEventListener('click', () => {
      Object.values(mapping).forEach(key => { this._filters[key] = key.toLowerCase().includes('mes') ? this.monthStart() : ''; });
      render();
    });
  };

  Operacoes.bindProfessionalActions = function bindProfessionalActions(root) {
    if (!CONFIG.canManageOperations) return;
    const editMap = {
      gastos: ['gastos', item => this.modalGasto(item)],
      equipe: ['equipe', item => this.modalEquipe(item)],
      equipe_diarias: ['diarias', item => this.modalDiaria(item)],
      fornecedores: ['fornecedores', item => this.modalFornecedor(item)],
      fornecedor_eventos: ['eventos', item => this.modalFornecedorEvento(item)]
    };
    root.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
      const config = editMap[button.dataset.edit];
      const item = config && this._data[config[0]].find(row => row.id === button.dataset.id);
      if (item) config[1](item);
    }));
    root.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
      if (!confirm('Excluir este registro? Esta ação não pode ser desfeita.')) return;
      try {
        await Api.request(Api.orgFilter('/rest/v1/' + button.dataset.delete + '?id=eq.' + encodeURIComponent(button.dataset.id)), { method: 'DELETE' });
        await this.carregar(); Utils.toast('Registro excluído.');
      } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); }
    }));
    root.querySelectorAll('[data-archive]').forEach(button => button.addEventListener('click', async () => {
      const source = button.dataset.archive === 'equipe' ? this._data.equipe : this._data.fornecedores;
      const item = source.find(row => row.id === button.dataset.id);
      if (!item) return;
      try {
        await Api.request(Api.orgFilter('/rest/v1/' + button.dataset.archive + '?id=eq.' + encodeURIComponent(item.id)), {
          method: 'PATCH', body: JSON.stringify({ ativo: !item.ativo })
        });
        await this.carregar(); Utils.toast(item.ativo ? 'Cadastro arquivado.' : 'Cadastro reativado.');
      } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); }
    }));
  };

  Operacoes.renderGastos = function renderGastos() {
    const root = document.getElementById('gastosContent');
    if (!root) return;
    const month = this._filters.gastosMes;
    const visible = this._data.gastos.filter(item => this.sameMonth(item, month) &&
      (!this._filters.gastosEvento || item.orcamento_id === this._filters.gastosEvento) &&
      (!this._filters.gastosPagamento || item.status_pagamento === this._filters.gastosPagamento));
    const gastos = this.total(this._data.gastos, month);
    const diarias = this.total(this._data.diarias, month, 'valor_diaria');
    const suppliers = this.total(this._data.eventos, month);
    const income = this._data.orcamentos.filter(quote => quote.status === 'aprovado').reduce((sum, quote) => sum + (Number(quote.total) || 0), 0);
    const rows = visible.map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.descricao) + '</strong><small>' + this.escape(item.fornecedor || item.nota_fiscal || '') + '</small></td><td><span class="ops-tag">' + this.escape(item.categoria.replace('_', ' ')) + '</span></td><td>' + this.escape(this.quoteLabel(this._data.orcamentos.find(quote => quote.id === item.orcamento_id))) + '</td><td><span class="ops-tag">' + this.escape(item.status_pagamento) + '</span></td><td class="ops-money">' + this.money(item.valor) + '</td><td>' + this.actionButtons('gastos', item.id) + '</td></tr>').join('');
    const payment = '<option value="">Todos</option>' + this.option('pago', 'Pago', this._filters.gastosPagamento) + this.option('pendente', 'Pendente', this._filters.gastosPagamento);
    const filters = this.filtersHtml(this.filterField('Mês', 'opsGastosMes', 'month', month) + this.filterField('Evento', 'opsGastosEvento', 'select', '', this.filterQuoteOptions(this._filters.gastosEvento)) + this.filterField('Pagamento', 'opsGastosPagamento', 'select', '', payment));
    root.innerHTML = '<div class="ops-page">' + this.titulo('Gastos diários', 'Notas fiscais, abastecimentos e despesas da operação.', 'Registrar gasto', 'opsNovoGasto') +
      '<div class="ops-summary"><div><span>Gastos do período</span><strong>' + this.money(gastos) + '</strong></div><div><span>Diárias do período</span><strong>' + this.money(diarias) + '</strong></div><div><span>Fornecedores do período</span><strong>' + this.money(suppliers) + '</strong></div><div><span>Margem estimada</span><strong class="' + (income - gastos - diarias - suppliers >= 0 ? 'positive' : 'negative') + '">' + this.money(income - gastos - diarias - suppliers) + '</strong></div></div>' +
      filters + '<div class="ops-card"><div class="ops-card-title">Lançamentos <span>' + visible.length + ' de ' + this._data.gastos.length + '</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th>Evento</th><th>Pagamento</th><th>Valor</th><th>Ações</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="ops-empty">Nenhum gasto encontrado.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovoGasto')?.addEventListener('click', () => this.modalGasto());
    this.bindProfessionalFilters(root, { opsGastosMes: 'gastosMes', opsGastosEvento: 'gastosEvento', opsGastosPagamento: 'gastosPagamento' }, () => this.renderGastos());
    this.bindProfessionalActions(root);
  };

  Operacoes.renderEquipe = function renderEquipe() {
    const root = document.getElementById('equipeContent');
    if (!root) return;
    const term = this._filters.equipeBusca.toLocaleLowerCase('pt-BR');
    const people = this._data.equipe.filter(person => !term || [person.nome, person.funcao, person.telefone].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
    const diaries = this._data.diarias.filter(item => !this._filters.diariasEvento || item.orcamento_id === this._filters.diariasEvento);
    const cards = people.map(person => {
      const history = this._data.diarias.filter(item => item.equipe_id === person.id);
      const total = history.reduce((sum, item) => sum + (Number(item.valor_diaria) || 0), 0);
      return '<article class="ops-person' + (person.ativo ? '' : ' archived') + '"><div class="ops-person-top"><div class="ops-avatar">' + this.escape(person.nome.charAt(0).toUpperCase()) + '</div><div><strong>' + this.escape(person.nome) + '</strong><span>' + this.escape(person.funcao || 'Freelancer') + (person.ativo ? '' : ' · Arquivado') + '</span></div></div><div class="ops-person-meta">' + this.escape(person.telefone || 'Sem telefone') + '<br>Diária padrão: <b>' + this.money(person.valor_diaria) + '</b></div><div class="ops-person-foot"><span>' + history.length + ' evento(s)</span><strong>' + this.money(total) + '</strong></div>' + this.actionButtons('equipe', person.id, person.ativo ? 'Arquivar' : 'Reativar') + '</article>';
    }).join('');
    const rows = diaries.map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.equipe?.nome) + '</strong><small>' + this.escape(item.funcao_evento || '') + '</small></td><td>' + this.escape(this.quoteLabel(item.orcamentos)) + '</td><td>' + this.escape(item.horario_inicio || '—') + '</td><td class="ops-money">' + this.money(item.valor_diaria) + '</td><td>' + this.actionButtons('equipe_diarias', item.id) + '</td></tr>').join('');
    const filters = this.filtersHtml(this.filterField('Buscar profissional', 'opsEquipeBusca', 'search', this._filters.equipeBusca) + this.filterField('Evento das diárias', 'opsDiariasEvento', 'select', '', this.filterQuoteOptions(this._filters.diariasEvento)));
    root.innerHTML = '<div class="ops-page">' + this.titulo('Equipe e freelancers', 'Técnicos de áudio, luz, vídeo e apoio, com diárias por evento.', 'Cadastrar profissional', 'opsNovaEquipe') +
      '<div class="ops-actions">' + (CONFIG.canManageOperations ? '<button class="ops-btn secondary" id="opsNovaDiaria">+ Registrar diária</button>' : '') + '<span>Arquivar mantém o histórico e retira o profissional dos novos lançamentos.</span></div>' + filters +
      '<div class="ops-person-grid">' + (cards || '<div class="ops-empty">Nenhum profissional encontrado.</div>') + '</div><div class="ops-card"><div class="ops-card-title">Histórico de trabalho <span>' + diaries.length + ' registros</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Profissional</th><th>Evento</th><th>Início</th><th>Diária</th><th>Ações</th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="ops-empty">Nenhuma diária encontrada.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovaEquipe')?.addEventListener('click', () => this.modalEquipe());
    document.getElementById('opsNovaDiaria')?.addEventListener('click', () => this.modalDiaria());
    this.bindProfessionalFilters(root, { opsEquipeBusca: 'equipeBusca', opsDiariasEvento: 'diariasEvento' }, () => this.renderEquipe());
    this.bindProfessionalActions(root);
  };

  Operacoes.renderFornecedores = function renderFornecedores() {
    const root = document.getElementById('fornecedoresContent');
    if (!root) return;
    const term = this._filters.fornecedorBusca.toLocaleLowerCase('pt-BR');
    const suppliers = this._data.fornecedores.filter(item => !term || [item.nome, item.tipo, item.contato, item.telefone].some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term)));
    const events = this._data.eventos.filter(item => (!this._filters.fornecedorEvento || item.orcamento_id === this._filters.fornecedorEvento) && (!this._filters.fornecedorPagamento || item.status_pagamento === this._filters.fornecedorPagamento));
    const cards = suppliers.map(item => '<article class="ops-person' + (item.ativo ? '' : ' archived') + '"><div class="ops-person-top"><div class="ops-avatar ops-avatar-alt">' + this.escape(item.nome.charAt(0).toUpperCase()) + '</div><div><strong>' + this.escape(item.nome) + '</strong><span>' + this.escape(item.tipo) + (item.ativo ? '' : ' · Arquivado') + '</span></div></div><div class="ops-person-meta">' + this.escape(item.contato || 'Sem contato') + '<br>' + this.escape(item.telefone || 'Sem telefone') + '</div>' + this.actionButtons('fornecedores', item.id, item.ativo ? 'Arquivar' : 'Reativar') + '</article>').join('');
    const rows = events.map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.fornecedores?.nome) + '</strong><small>' + this.escape(item.descricao_servico || '') + '</small></td><td>' + this.escape(this.quoteLabel(item.orcamentos)) + '</td><td>' + this.escape(item.horario_chegada || '—') + '</td><td><span class="ops-tag">' + this.escape(item.status_pagamento) + '</span></td><td class="ops-money">' + this.money(item.valor) + '</td><td>' + this.actionButtons('fornecedor_eventos', item.id) + '</td></tr>').join('');
    const payment = '<option value="">Todos</option>' + this.option('pago', 'Pago', this._filters.fornecedorPagamento) + this.option('pendente', 'Pendente', this._filters.fornecedorPagamento);
    const filters = this.filtersHtml(this.filterField('Buscar fornecedor', 'opsFornecedorBusca', 'search', this._filters.fornecedorBusca) + this.filterField('Evento', 'opsFornecedorEvento', 'select', '', this.filterQuoteOptions(this._filters.fornecedorEvento)) + this.filterField('Pagamento', 'opsFornecedorPagamento', 'select', '', payment));
    root.innerHTML = '<div class="ops-page">' + this.titulo('Fornecedores externos', 'Carregadores, transporte, locação e prestadores por evento.', 'Cadastrar fornecedor', 'opsNovoFornecedor') +
      '<div class="ops-actions">' + (CONFIG.canManageOperations ? '<button class="ops-btn secondary" id="opsNovoFornecedorEvento">+ Vincular a evento</button>' : '') + '<span>Arquive cadastros antigos sem perder o histórico.</span></div>' + filters +
      '<div class="ops-person-grid">' + (cards || '<div class="ops-empty">Nenhum fornecedor encontrado.</div>') + '</div><div class="ops-card"><div class="ops-card-title">Fornecedores por evento <span>' + events.length + ' registros</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Fornecedor</th><th>Evento</th><th>Chegada</th><th>Pagamento</th><th>Valor</th><th>Ações</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="ops-empty">Nenhum fornecedor encontrado.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovoFornecedor')?.addEventListener('click', () => this.modalFornecedor());
    document.getElementById('opsNovoFornecedorEvento')?.addEventListener('click', () => this.modalFornecedorEvento());
    this.bindProfessionalFilters(root, { opsFornecedorBusca: 'fornecedorBusca', opsFornecedorEvento: 'fornecedorEvento', opsFornecedorPagamento: 'fornecedorPagamento' }, () => this.renderFornecedores());
    this.bindProfessionalActions(root);
  };
})();
