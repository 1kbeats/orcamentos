(function enhanceProductions() {
  const originalDetail = Producoes.renderDetalhe.bind(Producoes);

  Producoes._filters = {
    busca: '',
    mes: '',
    status: ''
  };

  Producoes.modalEditar = function modalEditar(producao, onComplete) {
    const statuses = [['planejamento', 'Planejamento'], ['confirmado', 'Confirmado'], ['realizado', 'Realizado'], ['cancelado', 'Cancelado']];
    this.modal('Editar produção / evento',
      '<div class="ops-form-grid">' +
      '<label class="ops-field full"><span>Orçamento vinculado</span><input type="text" value="' + Utils.escapeHTML(this.quoteLabel(producao.orcamentos)) + '" disabled></label>' +
      Operacoes.editField('Nome do evento / serviço', 'nome', 'text', true, producao.nome) +
      Operacoes.editField('Produtor responsável', 'produtor_responsavel', 'text', false, producao.produtor_responsavel) +
      Operacoes.editField('Data do evento', 'data_evento', 'date', false, producao.data_evento) +
      Operacoes.editField('Horário de montagem', 'hora_montagem', 'time', false, producao.hora_montagem) +
      Operacoes.editField('Horário de início', 'hora_evento', 'time', false, producao.hora_evento) +
      Operacoes.editField('Local / casa de eventos', 'local_evento', 'text', false, producao.local_evento) +
      Operacoes.editField('Endereço completo', 'endereco', 'text', false, producao.endereco) +
      Operacoes.editField('Veículo designado', 'veiculo', 'text', false, producao.veiculo) +
      this.select('Status', 'status', Operacoes.choices(statuses, producao.status)) +
      Operacoes.editText('Informações operacionais', 'observacoes', producao.observacoes) + '</div>',
      async form => {
        const payload = {
          nome: this.value(form, 'nome', 180),
          produtor_responsavel: this.value(form, 'produtor_responsavel', 120),
          data_evento: this.value(form, 'data_evento', 10),
          hora_montagem: this.time(form, 'hora_montagem'),
          hora_evento: this.time(form, 'hora_evento'),
          local_evento: this.value(form, 'local_evento', 180),
          endereco: this.value(form, 'endereco', 300),
          veiculo: this.value(form, 'veiculo', 120),
          status: form.get('status'),
          observacoes: this.value(form, 'observacoes', 3000)
        };
        await Api.request(Api.orgFilter('/rest/v1/producoes?id=eq.' + encodeURIComponent(producao.id)), {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        Object.assign(producao, payload);
      },
      onComplete
    );
  };

  Producoes.filterField = function filterField(label, id, type, value, content) {
    return '<label><span>' + label + '</span>' + (type === 'select'
      ? '<select id="' + id + '">' + content + '</select>'
      : '<input id="' + id + '" type="' + type + '" value="' + Utils.escapeHTML(value || '') + '" autocomplete="off">') + '</label>';
  };

  Producoes.renderLista = function renderLista() {
    const root = document.getElementById('producoesContent');
    if (!root) return;
    const term = this._filters.busca.toLocaleLowerCase('pt-BR');
    const visible = this._data.producoes.filter(producao => {
      const searchable = [producao.nome, producao.local_evento, producao.endereco, producao.orcamentos?.cliente_nome, producao.orcamentos?.referencia]
        .some(value => String(value || '').toLocaleLowerCase('pt-BR').includes(term));
      const sameMonth = !this._filters.mes || String(producao.data_evento || '').slice(0, 7) === this._filters.mes;
      const sameStatus = !this._filters.status || producao.status === this._filters.status;
      return (!term || searchable) && sameMonth && sameStatus;
    });
    const labels = { planejamento: 'Planejamento', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' };
    const rows = visible.map(producao => {
      const quoteId = producao.orcamento_id;
      const cost = this.itemTotal(this.getByQuote(this._data.gastos, quoteId)) +
        this.itemTotal(this.getByQuote(this._data.diarias, quoteId), 'valor_diaria') +
        this.itemTotal(this.getByQuote(this._data.fornecedoresEvento, quoteId));
      const income = Number(producao.orcamentos?.total) || 0;
      const actions = '<div class="production-card-actions"><button class="ops-btn secondary" data-open="' + Utils.safeId(producao.id) + '">Visualizar</button>' +
        (CONFIG.canManageOperations ? '<button class="ops-action edit" data-edit-production="' + Utils.safeId(producao.id) + '">Editar</button><button class="ops-action archive" data-toggle-production="' + Utils.safeId(producao.id) + '">' + (producao.status === 'cancelado' ? 'Reativar' : 'Cancelar') + '</button>' : '') + '</div>';
      return '<article class="production-card' + (producao.status === 'cancelado' ? ' archived' : '') + '"><div class="production-card-head"><div><span class="ops-tag status-' + Utils.safeId(producao.status) + '">' + this.escape(labels[producao.status] || producao.status) + '</span><h3>' + this.escape(producao.nome) + '</h3><p>' + this.escape(producao.orcamentos?.cliente_nome) + '</p></div></div><div class="production-meta"><span>Data: ' + this.escape(Utils.fmtDate(producao.data_evento) || 'A definir') + '</span><span>Local: ' + this.escape(producao.local_evento || producao.endereco || 'A definir') + '</span></div><div class="production-numbers"><div><span>Receita</span><strong>' + this.money(income) + '</strong></div><div><span>Custo lançado</span><strong>' + this.money(cost) + '</strong></div><div><span>Margem</span><strong class="' + (income - cost >= 0 ? 'positive' : 'negative') + '">' + this.money(income - cost) + '</strong></div></div>' + actions + '</article>';
    }).join('');
    const statusOptions = '<option value="">Todos</option>' + Object.entries(labels).map(entry => Operacoes.option(entry[0], entry[1], this._filters.status)).join('');
    const filters = '<div class="ops-filters">' +
      this.filterField('Buscar', 'productionSearch', 'search', this._filters.busca) +
      this.filterField('Mês do evento', 'productionMonth', 'month', this._filters.mes) +
      this.filterField('Status', 'productionStatus', 'select', '', statusOptions) +
      '<button type="button" class="ops-filter-clear" id="productionClear">Limpar filtros</button></div>';
    root.innerHTML = '<div class="ops-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Produções e eventos</h1><p>Central de montagem: equipe, fornecedores, gastos e resultado de cada evento.</p></div>' +
      (CONFIG.canManageOperations ? '<button class="ops-btn" id="btnNovaProducao">+ Nova produção</button>' : '') +
      '</div><div class="production-guide"><strong>Fluxo profissional:</strong> crie a produção a partir de um orçamento aprovado e atualize os dados sempre que a operação mudar.</div>' +
      filters + '<div class="ops-results-count">' + visible.length + ' de ' + this._data.producoes.length + ' produções</div><div class="production-grid">' +
      (rows || '<div class="ops-empty">Nenhuma produção encontrada com estes filtros.</div>') + '</div></div>';

    root.querySelector('#btnNovaProducao')?.addEventListener('click', () => this.modalNova());
    root.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => {
      this._atual = this._data.producoes.find(item => item.id === button.dataset.open);
      this.renderDetalhe(this._atual);
    }));
    root.querySelectorAll('[data-edit-production]').forEach(button => button.addEventListener('click', () => {
      const item = this._data.producoes.find(producao => producao.id === button.dataset.editProduction);
      if (item) this.modalEditar(item);
    }));
    root.querySelectorAll('[data-toggle-production]').forEach(button => button.addEventListener('click', async () => {
      const item = this._data.producoes.find(producao => producao.id === button.dataset.toggleProduction);
      if (!item) return;
      const nextStatus = item.status === 'cancelado' ? 'planejamento' : 'cancelado';
      if (nextStatus === 'cancelado' && !confirm('Cancelar esta produção? O histórico e os custos serão preservados.')) return;
      try {
        await Api.request(Api.orgFilter('/rest/v1/producoes?id=eq.' + encodeURIComponent(item.id)), {
          method: 'PATCH', body: JSON.stringify({ status: nextStatus })
        });
        item.status = nextStatus; this.renderLista();
        Utils.toast(nextStatus === 'cancelado' ? 'Produção cancelada e preservada.' : 'Produção reativada.');
      } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); }
    }));

    const rerender = () => this.renderLista();
    root.querySelector('#productionSearch')?.addEventListener('input', event => {
      this._filters.busca = event.target.value;
      clearTimeout(this._professionalFilterTimer);
      this._professionalFilterTimer = setTimeout(rerender, 280);
    });
    root.querySelector('#productionMonth')?.addEventListener('change', event => { this._filters.mes = event.target.value; rerender(); });
    root.querySelector('#productionStatus')?.addEventListener('change', event => { this._filters.status = event.target.value; rerender(); });
    root.querySelector('#productionClear')?.addEventListener('click', () => { this._filters = { busca: '', mes: '', status: '' }; rerender(); });
  };

  Producoes.renderDetalhe = function renderDetalhe(producao) {
    originalDetail(producao);
    if (!CONFIG.canManageOperations || !producao) return;
    const root = document.getElementById('producoesContent');
    const actions = root?.querySelector('.production-actions');
    if (actions) {
      actions.insertAdjacentHTML('afterbegin', '<button class="ops-btn secondary" id="btnEditarProducao">Editar produção</button>');
      root.querySelector('#btnEditarProducao')?.addEventListener('click', () => this.modalEditar(producao));
    }
    const note = root?.querySelector('.ops-note');
    if (note) note.insertAdjacentHTML('beforeend', '<br><span class="production-edit-hint">Para corrigir gastos, diárias ou fornecedores, use o botão Editar nas respectivas telas.</span>');
  };
})();
