const Operacoes = {
  _data: { gastos: [], equipe: [], diarias: [], fornecedores: [], eventos: [], orcamentos: [] },

  async carregar() {
    if (!CONFIG.isAdmin) return this.semPermissao();
    const requests = [
      ['gastos', '/rest/v1/gastos?select=*&order=data.desc,created_at.desc'],
      ['equipe', '/rest/v1/equipe?select=*&order=ativo.desc,nome.asc'],
      ['diarias', '/rest/v1/equipe_diarias?select=*,equipe(nome),orcamentos(numero,referencia,cliente_nome)&order=data.desc,created_at.desc'],
      ['fornecedores', '/rest/v1/fornecedores?select=*&order=ativo.desc,nome.asc'],
      ['eventos', '/rest/v1/fornecedor_eventos?select=*,fornecedores(nome,tipo),orcamentos(numero,referencia,cliente_nome)&order=data.desc,created_at.desc'],
      ['orcamentos', '/rest/v1/orcamentos?select=id,numero,referencia,cliente_nome,total,status&order=created_at.desc&limit=100']
    ];
    try {
      const results = await Promise.all(requests.map(async ([key, path]) => [key, await Api.request(Api.orgFilter(path)) || []]));
      results.forEach(([key, value]) => { this._data[key] = value; });
      this.renderAtual();
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'N\u00e3o foi poss\u00edvel carregar a opera\u00e7\u00e3o.'), 'erro');
    }
  },

  renderAtual() {
    if (Nav.painelAtual === 'gastos') this.renderGastos();
    if (Nav.painelAtual === 'equipe') this.renderEquipe();
    if (Nav.painelAtual === 'fornecedores') this.renderFornecedores();
  },

  semPermissao() {
    const target = document.getElementById((Nav.painelAtual || 'gastos') + 'Content');
    if (target) target.innerHTML = '<div class="ops-page"><div class="ops-empty"><strong>Acesso administrativo necess\u00e1rio</strong><br>Dados operacionais e documentos da equipe s\u00e3o restritos a propriet\u00e1rios e administradores.</div></div>';
  },

  titulo(nome, descricao, acao, actionId) {
    return '<div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERA\u00c7\u00c3O</div><h1>' + nome + '</h1><p>' + descricao + '</p></div><button class="ops-btn" id="' + actionId + '">+ ' + acao + '</button></div>';
  },

  quoteLabel(quote) {
    if (!quote) return 'Sem evento vinculado';
    return '#' + Utils.fmtNumero(quote.numero) + (quote.referencia ? ' · ' + quote.referencia : '') + (quote.cliente_nome ? ' · ' + quote.cliente_nome : '');
  },

  escape(value) { return Utils.escapeHTML(value || '—'); },
  money(value) { return Utils.escapeHTML(Utils.fmt(value)); },
  monthStart() { return new Date().toISOString().slice(0, 7); },
  sameMonth(item, month) { return String(item.data || '').slice(0, 7) === month; },
  total(items, month, field = 'valor') { return items.filter(item => !month || this.sameMonth(item, month)).reduce((sum, item) => sum + (Number(item[field]) || 0), 0); },

  renderGastos() {
    const root = document.getElementById('gastosContent');
    if (!root) return;
    const month = this.monthStart();
    const gastos = this.total(this._data.gastos, month);
    const diarias = this.total(this._data.diarias, month, 'valor_diaria');
    const fornecedores = this.total(this._data.eventos, month);
    const receita = this._data.orcamentos.filter(q => q.status === 'aprovado').reduce((sum, q) => sum + (Number(q.total) || 0), 0);
    const rows = this._data.gastos.slice(0, 25).map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.descricao) + '</strong><small>' + this.escape(item.fornecedor || item.nota_fiscal || '') + '</small></td><td><span class="ops-tag">' + this.escape(item.categoria.replace('_', ' ')) + '</span></td><td>' + this.escape(this.quoteLabel(this._data.orcamentos.find(q => q.id === item.orcamento_id))) + '</td><td class="ops-money">' + this.money(item.valor) + '</td><td><button class="ops-icon" data-delete="gastos" data-id="' + Utils.safeId(item.id) + '" title="Excluir" aria-label="Excluir registro">×</button></td></tr>').join('');
    root.innerHTML = '<div class="ops-page">' + this.titulo('Gastos di\u00e1rios', 'Notas fiscais, abastecimentos e despesas da opera\u00e7\u00e3o.', 'Registrar gasto', 'opsNovoGasto') +
      '<div class="ops-summary"><div><span>Gastos do m\u00eas</span><strong>' + this.money(gastos) + '</strong></div><div><span>Di\u00e1rias do m\u00eas</span><strong>' + this.money(diarias) + '</strong></div><div><span>Fornecedores do m\u00eas</span><strong>' + this.money(fornecedores) + '</strong></div><div><span>Margem estimada</span><strong class="' + (receita - gastos - diarias - fornecedores >= 0 ? 'positive' : 'negative') + '">' + this.money(receita - gastos - diarias - fornecedores) + '</strong></div></div>' +
      '<div class="ops-note">A margem usa os or\u00e7amentos aprovados menos custos registrados. Vincule o gasto ao evento para analisar cada produ\u00e7\u00e3o depois.</div>' +
      '<div class="ops-card"><div class="ops-card-title">Lan\u00e7amentos recentes <span>' + this._data.gastos.length + ' registros</span></div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Descri\u00e7\u00e3o</th><th>Categoria</th><th>Evento</th><th>Valor</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="ops-empty">Nenhum gasto registrado ainda.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovoGasto').addEventListener('click', () => this.modalGasto());
    this.bindDeletes(root);
  },

  renderEquipe() {
    const root = document.getElementById('equipeContent');
    if (!root) return;
    const cards = this._data.equipe.map(person => {
      const history = this._data.diarias.filter(d => d.equipe_id === person.id);
      const total = history.reduce((sum, d) => sum + (Number(d.valor_diaria) || 0), 0);
      return '<article class="ops-person"><div class="ops-person-top"><div class="ops-avatar">' + this.escape(person.nome.charAt(0).toUpperCase()) + '</div><div><strong>' + this.escape(person.nome) + '</strong><span>' + this.escape(person.funcao || 'Freelancer') + '</span></div><button class="ops-icon" data-delete="equipe" data-id="' + Utils.safeId(person.id) + '" title="Excluir" aria-label="Excluir registro">×</button></div><div class="ops-person-meta">' + this.escape(person.telefone || 'Sem telefone') + '<br>Di\u00e1ria padr\u00e3o: <b>' + this.money(person.valor_diaria) + '</b></div><div class="ops-person-foot"><span>' + history.length + (history.length === 1 ? ' evento' : ' eventos') + '</span><strong>' + this.money(total) + '</strong></div></article>';
    }).join('');
    const rows = this._data.diarias.slice(0, 20).map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.equipe?.nome) + '</strong><small>' + this.escape(item.funcao_evento || '') + '</small></td><td>' + this.escape(this.quoteLabel(item.orcamentos)) + '</td><td>' + this.escape(item.horario_inicio || '—') + '</td><td class="ops-money">' + this.money(item.valor_diaria) + '</td><td><button class="ops-icon" data-delete="equipe_diarias" data-id="' + Utils.safeId(item.id) + '" title="Excluir" aria-label="Excluir registro">×</button></td></tr>').join('');
    root.innerHTML = '<div class="ops-page">' + this.titulo('Equipe e freelancers', 'T\u00e9cnicos de \u00e1udio, luz, v\u00eddeo e apoio, com di\u00e1rias por evento.', 'Cadastrar profissional', 'opsNovaEquipe') +
      '<div class="ops-actions"><button class="ops-btn secondary" id="opsNovaDiaria">+ Registrar di\u00e1ria</button><span>RG, CPF e filia\u00e7\u00e3o ficam protegidos nesta \u00e1rea administrativa.</span></div><div class="ops-person-grid">' + (cards || '<div class="ops-empty">Cadastre seus t\u00e9cnicos e freelancers para come\u00e7ar.</div>') + '</div>' +
      '<div class="ops-card"><div class="ops-card-title">Hist\u00f3rico de trabalho</div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Profissional</th><th>Evento</th><th>In\u00edcio</th><th>Di\u00e1ria</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="ops-empty">Nenhuma di\u00e1ria registrada.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovaEquipe').addEventListener('click', () => this.modalEquipe());
    document.getElementById('opsNovaDiaria').addEventListener('click', () => this.modalDiaria());
    this.bindDeletes(root);
  },

  renderFornecedores() {
    const root = document.getElementById('fornecedoresContent');
    if (!root) return;
    const cards = this._data.fornecedores.map(item => '<article class="ops-person"><div class="ops-person-top"><div class="ops-avatar ops-avatar-alt">' + this.escape(item.nome.charAt(0).toUpperCase()) + '</div><div><strong>' + this.escape(item.nome) + '</strong><span>' + this.escape(item.tipo) + '</span></div><button class="ops-icon" data-delete="fornecedores" data-id="' + Utils.safeId(item.id) + '" title="Excluir" aria-label="Excluir registro">×</button></div><div class="ops-person-meta">' + this.escape(item.contato || 'Sem contato') + '<br>' + this.escape(item.telefone || 'Sem telefone') + '</div></article>').join('');
    const rows = this._data.eventos.slice(0, 25).map(item => '<tr><td>' + this.escape(Utils.fmtDate(item.data)) + '</td><td><strong>' + this.escape(item.fornecedores?.nome) + '</strong><small>' + this.escape(item.descricao_servico || item.fornecedores?.tipo || '') + '</small></td><td>' + this.escape(this.quoteLabel(item.orcamentos)) + '</td><td>' + this.escape(item.horario_chegada || '—') + '</td><td><span class="ops-tag">' + this.escape(item.status_pagamento) + '</span></td><td class="ops-money">' + this.money(item.valor) + '</td><td><button class="ops-icon" data-delete="fornecedor_eventos" data-id="' + Utils.safeId(item.id) + '" title="Excluir" aria-label="Excluir registro">×</button></td></tr>').join('');
    root.innerHTML = '<div class="ops-page">' + this.titulo('Fornecedores externos', 'Carregadores, transporte, loca\u00e7\u00e3o e prestadores por evento.', 'Cadastrar fornecedor', 'opsNovoFornecedor') +
      '<div class="ops-actions"><button class="ops-btn secondary" id="opsNovoFornecedorEvento">+ Vincular a evento</button><span>Registre valor, hor\u00e1rio de chegada e situa\u00e7\u00e3o do pagamento.</span></div><div class="ops-person-grid">' + (cards || '<div class="ops-empty">Cadastre carregadores e prestadores para usar nos eventos.</div>') + '</div>' +
      '<div class="ops-card"><div class="ops-card-title">Fornecedores por evento</div><div class="ops-table-wrap"><table class="ops-table"><thead><tr><th>Data</th><th>Fornecedor</th><th>Evento</th><th>Chegada</th><th>Pagamento</th><th>Valor</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="ops-empty">Nenhum fornecedor vinculado ainda.</td></tr>') + '</tbody></table></div></div></div>';
    document.getElementById('opsNovoFornecedor').addEventListener('click', () => this.modalFornecedor());
    document.getElementById('opsNovoFornecedorEvento').addEventListener('click', () => this.modalFornecedorEvento());
    this.bindDeletes(root);
  },

  options(items, label, value = 'id', empty = 'Selecione') { return '<option value="">' + empty + '</option>' + items.map(item => '<option value="' + Utils.safeId(item[value]) + '">' + this.escape(label(item)) + '</option>').join(''); },
  quoteOptions() { return this.options(this._data.orcamentos, q => this.quoteLabel(q), 'id', 'Sem evento vinculado'); },
  modal(title, body, onSave) {
    document.getElementById('opsModal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'opsModal'; wrap.className = 'ops-modal';
    wrap.innerHTML = '<div class="ops-modal-box" role="dialog" aria-modal="true"><div class="ops-modal-head"><h2>' + title + '</h2><button class="ops-icon" type="button" data-close aria-label="Fechar" title="Fechar">×</button></div><form id="opsForm">' + body + '<div class="ops-modal-actions"><button type="button" class="ops-btn secondary" data-close>Cancelar</button><button class="ops-btn" type="submit">Salvar</button></div></form></div>';
    document.body.appendChild(wrap);
    wrap.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => wrap.remove()));
    wrap.addEventListener('click', event => { if (event.target === wrap) wrap.remove(); });
    wrap.querySelector('#opsForm').addEventListener('submit', async event => { event.preventDefault(); const button = event.submitter; button.disabled = true; try { await onSave(new FormData(event.currentTarget)); wrap.remove(); await this.carregar(); Utils.toast('Registro salvo.'); } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); button.disabled = false; } });
  },

  field(label, name, type = 'text', required = false, value = '') {
    const inputMode = type === 'number' ? ' inputmode="decimal"' : (type === 'tel' ? ' inputmode="tel"' : (name === 'cpf' || name === 'rg' ? ' inputmode="numeric"' : ''));
    const autocomplete = type === 'email' ? ' autocomplete="email"' : (type === 'tel' ? ' autocomplete="tel"' : '');
    return '<label class="ops-field"><span>' + label + '</span><input name="' + name + '" type="' + type + '"' + (type === 'number' ? ' min="0" step="0.01"' : '') + inputMode + autocomplete + ' value="' + Utils.escapeHTML(value ?? '') + '"' + (required ? ' required' : '') + '></label>';
  },
  text(label, name) { return '<label class="ops-field full"><span>' + label + '</span><textarea name="' + name + '" rows="2"></textarea></label>'; },
  select(label, name, content, required = false) { return '<label class="ops-field"><span>' + label + '</span><select name="' + name + '"' + (required ? ' required' : '') + '>' + content + '</select></label>'; },
  val(form, name, max = 300) { return Utils.sanitizeText(form.get(name), max) || null; },
  num(form, name) { return Math.max(0, Number(String(form.get(name) || '').replace(',', '.')) || 0); },
  date(form, name) { return this.val(form, name, 10) || new Date().toISOString().slice(0, 10); },
  time(form, name) { return this.val(form, name, 5); },

  modalGasto() { this.modal('Registrar gasto', '<div class="ops-form-grid">' + this.field('Data', 'data', 'date', true, new Date().toISOString().slice(0, 10)) + this.select('Categoria', 'categoria', '<option value="combustivel">Combust\u00edvel</option><option value="alimentacao">Alimenta\u00e7\u00e3o</option><option value="manutencao">Manuten\u00e7\u00e3o</option><option value="equipamento">Equipamento</option><option value="logistica">Log\u00edstica</option><option value="nota_fiscal">Nota fiscal</option><option value="outro">Outro</option>', true) + this.field('Descri\u00e7\u00e3o', 'descricao', 'text', true) + this.field('Valor (R$)', 'valor', 'number', true) + this.field('Fornecedor / posto', 'fornecedor') + this.field('N\u00famero da NF', 'nota_fiscal') + this.select('Evento (opcional)', 'orcamento_id', this.quoteOptions()) + this.select('Pagamento', 'status_pagamento', '<option value="pago">Pago</option><option value="pendente">Pendente</option>') + this.text('Observa\u00e7\u00f5es', 'observacoes') + '</div>', async f => Api.request('/rest/v1/gastos', { method: 'POST', body: JSON.stringify(Api.orgPayload({ data: this.date(f, 'data'), categoria: f.get('categoria'), descricao: this.val(f, 'descricao'), fornecedor: this.val(f, 'fornecedor'), nota_fiscal: this.val(f, 'nota_fiscal'), valor: this.num(f, 'valor'), orcamento_id: this.val(f, 'orcamento_id', 50), status_pagamento: f.get('status_pagamento'), observacoes: this.val(f, 'observacoes', 2000) })) })); },
  modalEquipe() { this.modal('Cadastrar profissional', '<div class="ops-form-grid">' + this.field('Nome completo', 'nome', 'text', true) + this.field('Fun\u00e7\u00e3o principal', 'funcao') + this.field('Telefone / WhatsApp', 'telefone', 'tel') + this.field('E-mail', 'email', 'email') + this.field('Di\u00e1ria padr\u00e3o (R$)', 'valor_diaria', 'number', true, '0') + this.field('CPF (restrito)', 'cpf') + this.field('RG (restrito)', 'rg') + this.field('Filia\u00e7\u00e3o (restrito)', 'filiacao') + this.text('Observa\u00e7\u00f5es', 'observacoes') + '</div>', async f => Api.request('/rest/v1/equipe', { method: 'POST', body: JSON.stringify(Api.orgPayload({ nome: this.val(f, 'nome'), funcao: this.val(f, 'funcao'), telefone: this.val(f, 'telefone'), email: this.val(f, 'email'), valor_diaria: this.num(f, 'valor_diaria'), cpf: this.val(f, 'cpf', 30), rg: this.val(f, 'rg', 30), filiacao: this.val(f, 'filiacao', 200), observacoes: this.val(f, 'observacoes', 2000) })) })); },
  modalDiaria() { this.modal('Registrar di\u00e1ria', '<div class="ops-form-grid">' + this.select('Profissional', 'equipe_id', this.options(this._data.equipe.filter(p => p.ativo), p => p.nome), true) + this.select('Evento', 'orcamento_id', this.quoteOptions()) + this.field('Data', 'data', 'date', true, new Date().toISOString().slice(0, 10)) + this.field('Valor da di\u00e1ria (R$)', 'valor_diaria', 'number', true) + this.field('Fun\u00e7\u00e3o no evento', 'funcao_evento') + this.field('Hor\u00e1rio de in\u00edcio', 'horario_inicio', 'time') + this.field('Hor\u00e1rio de fim', 'horario_fim', 'time') + this.text('Observa\u00e7\u00f5es', 'observacoes') + '</div>', async f => Api.request('/rest/v1/equipe_diarias', { method: 'POST', body: JSON.stringify(Api.orgPayload({ equipe_id: this.val(f, 'equipe_id', 50), orcamento_id: this.val(f, 'orcamento_id', 50), data: this.date(f, 'data'), valor_diaria: this.num(f, 'valor_diaria'), funcao_evento: this.val(f, 'funcao_evento'), horario_inicio: this.time(f, 'horario_inicio'), horario_fim: this.time(f, 'horario_fim'), observacoes: this.val(f, 'observacoes', 2000) })) })); },
  modalFornecedor() { this.modal('Cadastrar fornecedor', '<div class="ops-form-grid">' + this.field('Nome / empresa', 'nome', 'text', true) + this.select('Tipo', 'tipo', '<option value="carregador">Carregador</option><option value="transporte">Transporte</option><option value="locacao">Loca\u00e7\u00e3o</option><option value="prestador">Prestador</option><option value="outro">Outro</option>', true) + this.field('Pessoa de contato', 'contato') + this.field('Telefone / WhatsApp', 'telefone', 'tel') + this.field('E-mail', 'email', 'email') + this.text('Observa\u00e7\u00f5es', 'observacoes') + '</div>', async f => Api.request('/rest/v1/fornecedores', { method: 'POST', body: JSON.stringify(Api.orgPayload({ nome: this.val(f, 'nome'), tipo: f.get('tipo'), contato: this.val(f, 'contato'), telefone: this.val(f, 'telefone'), email: this.val(f, 'email'), observacoes: this.val(f, 'observacoes', 2000) })) })); },
  modalFornecedorEvento() { this.modal('Vincular fornecedor ao evento', '<div class="ops-form-grid">' + this.select('Fornecedor', 'fornecedor_id', this.options(this._data.fornecedores.filter(p => p.ativo), p => p.nome + ' · ' + p.tipo), true) + this.select('Evento', 'orcamento_id', this.quoteOptions()) + this.field('Data', 'data', 'date', true, new Date().toISOString().slice(0, 10)) + this.field('Valor contratado (R$)', 'valor', 'number', true) + this.field('Servi\u00e7o contratado', 'descricao_servico') + this.field('Hor\u00e1rio de chegada', 'horario_chegada', 'time') + this.select('Pagamento', 'status_pagamento', '<option value="pendente">Pendente</option><option value="pago">Pago</option>') + this.text('Observa\u00e7\u00f5es', 'observacoes') + '</div>', async f => Api.request('/rest/v1/fornecedor_eventos', { method: 'POST', body: JSON.stringify(Api.orgPayload({ fornecedor_id: this.val(f, 'fornecedor_id', 50), orcamento_id: this.val(f, 'orcamento_id', 50), data: this.date(f, 'data'), valor: this.num(f, 'valor'), descricao_servico: this.val(f, 'descricao_servico'), horario_chegada: this.time(f, 'horario_chegada'), status_pagamento: f.get('status_pagamento'), observacoes: this.val(f, 'observacoes', 2000) })) })); },

  bindDeletes(root) { root.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => { const table = button.dataset.delete; const id = Utils.safeId(button.dataset.id); if (!id || !confirm('Excluir este registro? Esta a\u00e7\u00e3o n\u00e3o pode ser desfeita.')) return; try { await Api.request(Api.orgFilter('/rest/v1/' + table + '?id=eq.' + encodeURIComponent(id)), { method: 'DELETE' }); await this.carregar(); Utils.toast('Registro exclu\u00eddo.'); } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); } })); }
};
