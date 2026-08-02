const OrdensServico = {
  _data: { ordens: [], producoes: [], diarias: [], equipe: [], config: {} },
  _filters: { busca: '', status: '' },
  _atual: null,

  async carregar() {
    if (!CONFIG.canViewOperations) return this.semPermissao();
    try {
      const requests = [
        ['ordens', '/rest/v1/ordens_servico?select=*&order=created_at.desc'],
        ['producoes', '/rest/v1/producoes?select=*,orcamentos(id,numero,referencia,cliente_nome,total,status,itens,solicitante)&order=data_evento.desc.nullslast,created_at.desc'],
        ['diarias', '/rest/v1/equipe_diarias?select=*,equipe(id,nome,funcao,telefone)&order=data.desc'],
        ['equipe', '/rest/v1/equipe?select=id,nome,funcao,telefone,ativo&order=ativo.desc,nome.asc'],
        ['config', '/rest/v1/config?select=nome,cnpj,tel,email,endereco&limit=1']
      ];
      const results = await Promise.all(requests.map(async ([key, path]) => [key, await Api.request(Api.orgFilter(path)) || []]));
      results.forEach(([key, value]) => { this._data[key] = key === 'config' ? (value[0] || {}) : value; });
      this.renderLista();
    } catch (error) { Utils.toast(Api.friendlyError(error, 'Não foi possível carregar as ordens de serviço.'), 'erro'); }
  },

  semPermissao() {
    const root = document.getElementById('ordemServicoContent');
    if (root) root.innerHTML = '<div class="ops-page"><div class="ops-empty"><strong>Acesso operacional necessário</strong><br>Este perfil não possui acesso às ordens de serviço.</div></div>';
  },

  escape(value) { return Utils.escapeHTML(value == null || value === '' ? '—' : String(value)); },
  safe(value) { return Utils.escapeHTML(value == null ? '' : String(value)); },
  numero(value) { return String(Number(value) || 0).padStart(4, '0'); },
  statusLabel(value) { return ({ rascunho: 'Rascunho', enviada: 'Enviada', confirmada: 'Confirmada' })[value] || value; },
  productionFor(order) { return this._data.producoes.find(item => item.id === order.producao_id); },
  quoteLabel(production) { const quote = production?.orcamentos; return quote ? '#' + Utils.fmtNumero(quote.numero) + ' · ' + (quote.referencia || quote.cliente_nome || production.nome) : production?.nome || 'Produção'; },

  renderLista() {
    const root = document.getElementById('ordemServicoContent');
    if (!root) return;
    const search = this._filters.busca.toLowerCase();
    const visible = this._data.ordens.filter(order => {
      const text = [order.titulo, order.cliente_nome, order.responsavel_nome, order.local_evento, this.numero(order.numero)].join(' ').toLowerCase();
      return (!search || text.includes(search)) && (!this._filters.status || order.status === this._filters.status);
    });
    const cards = visible.map(order => {
      const actions = '<div class="service-order-actions"><button class="ops-btn secondary" data-view-os="' + Utils.safeId(order.id) + '">Visualizar</button>' +
        (CONFIG.canManageOperations ? '<button class="ops-action edit" data-edit-os="' + Utils.safeId(order.id) + '">Editar</button>' +
        (order.status !== 'confirmada' ? '<button class="ops-action archive" data-confirm-os="' + Utils.safeId(order.id) + '">Confirmar</button>' : '') : '') + '</div>';
      return '<article class="service-order-card"><div class="service-order-card-head"><div><span class="ops-tag status-' + Utils.safeId(order.status) + '">' + this.escape(this.statusLabel(order.status)) + '</span><h3>OS ' + this.numero(order.numero) + ' · ' + this.escape(order.titulo) + '</h3><p>' + this.escape(order.cliente_nome) + '</p></div><div class="service-order-date"><span>Evento</span><strong>' + this.escape(Utils.fmtDate(order.data_evento) || 'A definir') + '</strong></div></div><div class="service-order-meta"><span><b>Montagem:</b> ' + this.escape(order.hora_montagem || 'A definir') + '</span><span><b>Responsável:</b> ' + this.escape(order.responsavel_nome || 'A definir') + '</span><span><b>Local:</b> ' + this.escape(order.local_evento || order.endereco || 'A definir') + '</span></div>' + actions + '</article>';
    }).join('');
    const hasAvailable = this._data.producoes.some(prod => !this._data.ordens.some(order => order.producao_id === prod.id));
    root.innerHTML = '<div class="ops-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Ordens de serviço</h1><p>Informações operacionais prontas para orientar técnicos e equipes.</p></div>' +
      (CONFIG.canManageOperations ? '<button class="ops-btn" id="btnNovaOS"' + (hasAvailable ? '' : ' disabled title="Todas as produções já possuem OS"') + '>+ Nova ordem de serviço</button>' : '') + '</div>' +
      '<div class="production-guide"><strong>Fluxo:</strong> gere a OS a partir de uma produção, revise as informações e envie ao técnico pelo WhatsApp.</div>' +
      '<div class="ops-filters service-order-filters"><label class="ops-field"><span>Buscar</span><input id="osBusca" type="search" value="' + this.safe(this._filters.busca) + '" placeholder="Número, evento, cliente ou técnico"></label><label class="ops-field"><span>Status</span><select id="osStatus"><option value="">Todos</option><option value="rascunho"' + (this._filters.status === 'rascunho' ? ' selected' : '') + '>Rascunho</option><option value="enviada"' + (this._filters.status === 'enviada' ? ' selected' : '') + '>Enviada</option><option value="confirmada"' + (this._filters.status === 'confirmada' ? ' selected' : '') + '>Confirmada</option></select></label><button class="ops-filter-clear" id="osLimpar">Limpar filtros</button></div>' +
      '<div class="ops-results-count">' + visible.length + ' de ' + this._data.ordens.length + ' ordens de serviço</div><div class="service-order-grid">' + (cards || '<div class="ops-empty">' + (this._data.ordens.length ? 'Nenhuma ordem encontrada com estes filtros.' : 'Nenhuma ordem de serviço criada. Crie uma produção primeiro e gere a OS por aqui.') + '</div>') + '</div></div>';
    root.querySelector('#btnNovaOS')?.addEventListener('click', () => this.abrirEditor());
    root.querySelector('#osBusca')?.addEventListener('input', event => { this._filters.busca = event.target.value; clearTimeout(this._timer); this._timer = setTimeout(() => this.renderLista(), 280); });
    root.querySelector('#osStatus')?.addEventListener('change', event => { this._filters.status = event.target.value; this.renderLista(); });
    root.querySelector('#osLimpar')?.addEventListener('click', () => { this._filters = { busca: '', status: '' }; this.renderLista(); });
    root.querySelectorAll('[data-view-os]').forEach(button => button.addEventListener('click', () => this.abrirPreview(this._data.ordens.find(order => order.id === button.dataset.viewOs))));
    root.querySelectorAll('[data-edit-os]').forEach(button => button.addEventListener('click', () => this.abrirEditor(this._data.ordens.find(order => order.id === button.dataset.editOs))));
    root.querySelectorAll('[data-confirm-os]').forEach(button => button.addEventListener('click', () => this.confirmar(this._data.ordens.find(order => order.id === button.dataset.confirmOs))));
  },

  productionOptions(selectedId) {
    return '<option value="">Selecione uma produção</option>' + this._data.producoes.filter(prod => prod.id === selectedId || !this._data.ordens.some(order => order.producao_id === prod.id)).map(prod => '<option value="' + Utils.safeId(prod.id) + '"' + (prod.id === selectedId ? ' selected' : '') + '>' + this.escape(this.quoteLabel(prod)) + '</option>').join('');
  },

  snapshot(production) {
    const quote = production.orcamentos || {};
    const diaries = this._data.diarias.filter(item => item.orcamento_id === production.orcamento_id);
    const team = diaries.map(item => ({ id: item.equipe?.id || item.equipe_id, nome: item.equipe?.nome || 'Técnico', funcao: item.funcao_evento || item.equipe?.funcao || '', telefone: item.equipe?.telefone || '', inicio: item.horario_inicio || '', fim: item.horario_fim || '' }));
    const items = (Array.isArray(quote.itens) ? quote.itens : []).map(item => ({ descricao: item.desc || item.descricao || '', quantidade: Number(item.qty || item.quantidade) || 1 }));
    const responsible = team[0] || {};
    return { titulo: production.nome || quote.referencia || quote.cliente_nome || 'Evento', cliente_nome: quote.cliente_nome || '', contato_local: quote.solicitante || '', telefone_contato: '', responsavel_id: responsible.id || '', responsavel_nome: responsible.nome || '', responsavel_telefone: responsible.telefone || '', data_evento: production.data_evento || '', hora_montagem: production.hora_montagem || '', hora_evento: production.hora_evento || '', local_evento: production.local_evento || '', endereco: production.endereco || '', veiculo: production.veiculo || '', itens: items, equipe: team, orientacoes: production.observacoes || '', traje: '', observacoes: '' };
  },

  editorBody(order, production) {
    const data = order || (production ? this.snapshot(production) : {});
    const itemLines = (data.itens || []).map(item => (item.quantidade && item.quantidade !== 1 ? item.quantidade + 'x ' : '') + (item.descricao || item.desc || '')).join('\n');
    const teamLines = (data.equipe || []).map(item => item.nome + (item.funcao ? ' — ' + item.funcao : '') + (item.inicio ? ' — ' + item.inicio + (item.fim ? ' às ' + item.fim : '') : '')).join('\n');
    const responsibleOptions = '<option value="">Selecione o responsável</option>' + this._data.equipe.filter(item => item.ativo || item.id === data.responsavel_id).map(item => '<option value="' + Utils.safeId(item.id) + '"' + (item.id === data.responsavel_id ? ' selected' : '') + '>' + this.escape(item.nome + (item.funcao ? ' · ' + item.funcao : '')) + '</option>').join('');
    return '<div class="ops-form-grid service-order-form">' +
      '<label class="ops-field full"><span>Produção / evento</span><select name="producao_id" id="osProducao" required' + (order ? ' disabled' : '') + '>' + this.productionOptions(production?.id || order?.producao_id) + '</select></label>' +
      '<label class="ops-field full"><span>Nome da ordem de serviço</span><input name="titulo" value="' + this.safe(data.titulo) + '" required maxlength="180"></label>' +
      '<label class="ops-field"><span>Cliente</span><input name="cliente_nome" value="' + this.safe(data.cliente_nome) + '"></label><label class="ops-field"><span>Contato no local</span><input name="contato_local" value="' + this.safe(data.contato_local) + '"></label>' +
      '<label class="ops-field"><span>Telefone do contato</span><input name="telefone_contato" type="tel" inputmode="tel" value="' + this.safe(data.telefone_contato) + '"></label><label class="ops-field"><span>Técnico responsável</span><select name="responsavel_id" id="osResponsavel">' + responsibleOptions + '</select></label>' +
      '<label class="ops-field"><span>Telefone do responsável</span><input name="responsavel_telefone" id="osResponsavelTelefone" type="tel" inputmode="tel" value="' + this.safe(data.responsavel_telefone) + '"></label><label class="ops-field"><span>Data do evento</span><input name="data_evento" type="date" value="' + this.safe(data.data_evento) + '"></label>' +
      '<label class="ops-field"><span>Horário de montagem</span><input name="hora_montagem" type="time" value="' + this.safe(data.hora_montagem) + '"></label><label class="ops-field"><span>Início do evento</span><input name="hora_evento" type="time" value="' + this.safe(data.hora_evento) + '"></label>' +
      '<label class="ops-field"><span>Local / casa de eventos</span><input name="local_evento" value="' + this.safe(data.local_evento) + '"></label><label class="ops-field"><span>Veículo designado</span><input name="veiculo" value="' + this.safe(data.veiculo) + '"></label>' +
      '<label class="ops-field full"><span>Endereço completo</span><input name="endereco" value="' + this.safe(data.endereco) + '"></label>' +
      '<label class="ops-field full"><span>Equipamentos e serviços — um por linha</span><textarea name="itens" rows="5">' + this.safe(itemLines) + '</textarea></label>' +
      '<label class="ops-field full"><span>Equipe escalada — um profissional por linha</span><textarea name="equipe_texto" rows="4">' + this.safe(teamLines || 'Nenhuma equipe escalada nesta produção.') + '</textarea><small>Você pode ajustar esta lista sem alterar a escala original da produção.</small></label>' +
      '<label class="ops-field full"><span>Orientações operacionais</span><textarea name="orientacoes" rows="4" placeholder="Carga, acesso, montagem, passagem de som...">' + this.safe(data.orientacoes) + '</textarea></label>' +
      '<label class="ops-field"><span>Traje</span><input name="traje" value="' + this.safe(data.traje) + '" placeholder="Ex.: camiseta preta e calça preta"></label><label class="ops-field"><span>Status</span><select name="status"><option value="rascunho"' + (data.status === 'rascunho' || !data.status ? ' selected' : '') + '>Rascunho</option><option value="enviada"' + (data.status === 'enviada' ? ' selected' : '') + '>Enviada</option><option value="confirmada"' + (data.status === 'confirmada' ? ' selected' : '') + '>Confirmada</option></select></label>' +
      '<label class="ops-field full"><span>Observações adicionais</span><textarea name="observacoes" rows="3">' + this.safe(data.observacoes) + '</textarea></label></div>';
  },

  abrirEditor(order = null, productionPreset = null) {
    if (!CONFIG.canManageOperations) return;
    const production = productionPreset || (order ? this._data.producoes.find(item => item.id === order.producao_id) : null);
    document.getElementById('opsModal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'opsModal'; wrap.className = 'ops-modal service-order-editor';
    wrap.innerHTML = '<div class="ops-modal-box service-order-editor-box" role="dialog" aria-modal="true"><div class="ops-modal-head"><div><small>ORDEM DE SERVIÇO</small><h2>' + (order ? 'Editar OS ' + this.numero(order.numero) : 'Nova ordem de serviço') + '</h2></div><button class="ops-icon" type="button" data-close aria-label="Fechar">×</button></div><form id="osForm">' + this.editorBody(order, production) + '<div class="ops-modal-actions"><button type="button" class="ops-btn secondary" data-close>Cancelar</button><button class="ops-btn" type="submit">Salvar ordem de serviço</button></div></form></div>';
    document.body.appendChild(wrap);
    const close = () => wrap.remove(); wrap.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close)); wrap.addEventListener('click', event => { if (event.target === wrap) close(); });
    const productionSelect = wrap.querySelector('#osProducao');
    productionSelect?.addEventListener('change', () => { const chosen = this._data.producoes.find(item => item.id === productionSelect.value); if (chosen) { close(); this.abrirEditor(null, chosen); } });
    wrap.querySelector('#osResponsavel')?.addEventListener('change', event => { const person = this._data.equipe.find(item => item.id === event.target.value); wrap.querySelector('#osResponsavelTelefone').value = person?.telefone || ''; });
    wrap.querySelector('#osForm').addEventListener('submit', async event => { event.preventDefault(); const button = event.submitter; button.disabled = true; try { await this.salvar(order, production, new FormData(event.currentTarget)); close(); await this.carregar(); Utils.toast('Ordem de serviço salva.'); } catch (error) { button.disabled = false; Utils.toast(Api.friendlyError(error, 'Não foi possível salvar a ordem de serviço.'), 'erro'); } });
  },

  text(form, name, max = 2000) { return Utils.sanitizeText(form.get(name), max) || null; },
  parseItems(value) { return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 100).map(line => { const match = line.match(/^(\d+(?:[.,]\d+)?)x\s+(.+)$/i); return { quantidade: match ? Number(match[1].replace(',', '.')) : 1, descricao: match ? match[2].trim() : line }; }); },

  parseTeam(value) { return String(value || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).slice(0, 50).map(line => { const parts = line.split(/\s+—\s+/); const times = (parts[2] || '').match(/(\d{2}:\d{2})(?:\s+às\s+(\d{2}:\d{2}))?/); return { nome: parts[0], funcao: parts[1] || '', telefone: '', inicio: times?.[1] || '', fim: times?.[2] || '' }; }); },

  async salvar(order, productionPreset, form) {
    const productionId = order?.producao_id || this.text(form, 'producao_id', 50) || productionPreset?.id;
    const production = this._data.producoes.find(item => item.id === productionId);
    if (!production) throw new Error('Selecione uma produção válida.');
    const responsibleId = this.text(form, 'responsavel_id', 50);
    const responsible = this._data.equipe.find(item => item.id === responsibleId);
    const oldStatus = order?.status || 'rascunho'; const status = form.get('status') || oldStatus;
    const payload = {
      producao_id: production.id, orcamento_id: production.orcamento_id, responsavel_id: responsibleId,
      titulo: this.text(form, 'titulo', 180), cliente_nome: this.text(form, 'cliente_nome', 180), contato_local: this.text(form, 'contato_local', 150), telefone_contato: this.text(form, 'telefone_contato', 30),
      responsavel_nome: responsible?.nome || order?.responsavel_nome || null, responsavel_telefone: this.text(form, 'responsavel_telefone', 30),
      data_evento: this.text(form, 'data_evento', 10), hora_montagem: this.text(form, 'hora_montagem', 5), hora_evento: this.text(form, 'hora_evento', 5),
      local_evento: this.text(form, 'local_evento', 200), endereco: this.text(form, 'endereco', 400), veiculo: this.text(form, 'veiculo', 100),
      itens: this.parseItems(form.get('itens')), equipe: this.parseTeam(form.get('equipe_texto')),
      orientacoes: this.text(form, 'orientacoes', 4000), traje: this.text(form, 'traje', 300), observacoes: this.text(form, 'observacoes', 2000), status,
      enviada_em: status === 'enviada' ? (order?.enviada_em || new Date().toISOString()) : order?.enviada_em || null,
      confirmada_em: status === 'confirmada' ? (order?.confirmada_em || new Date().toISOString()) : order?.confirmada_em || null
    };
    if (!payload.titulo) throw new Error('Informe o nome da ordem de serviço.');
    if (order) return Api.request(Api.orgFilter('/rest/v1/ordens_servico?id=eq.' + encodeURIComponent(order.id)), { method: 'PATCH', body: JSON.stringify(payload) });
    return Api.request('/rest/v1/ordens_servico', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(Api.orgPayload(payload)) });
  },

  async confirmar(order) {
    if (!order || !CONFIG.canManageOperations || !confirm('Confirmar esta ordem de serviço? O histórico será preservado.')) return;
    try { await Api.request(Api.orgFilter('/rest/v1/ordens_servico?id=eq.' + encodeURIComponent(order.id)), { method: 'PATCH', body: JSON.stringify({ status: 'confirmada', confirmada_em: new Date().toISOString() }) }); await this.carregar(); Utils.toast('Ordem de serviço confirmada.'); } catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); }
  },

  previewHtml(order) {
    const items = (order.itens || []).map(item => '<li><span>' + this.escape(item.descricao) + '</span><b>' + this.escape(item.quantidade || 1) + '</b></li>').join('');
    const team = (order.equipe || []).map(item => '<li><span><strong>' + this.escape(item.nome) + '</strong>' + (item.funcao ? '<small>' + this.escape(item.funcao) + '</small>' : '') + '</span><b>' + this.escape(item.inicio || '') + (item.fim ? '–' + this.escape(item.fim) : '') + '</b></li>').join('');
    return '<article class="service-order-document"><header><div class="service-order-brand"><b>1K</b><span>beats))</span><small>ÁUDIO · VÍDEO · PRODUÇÃO DE EVENTOS</small></div><div><small>ORDEM DE SERVIÇO</small><h1>OS ' + this.numero(order.numero) + '</h1><span class="ops-tag status-' + Utils.safeId(order.status) + '">' + this.escape(this.statusLabel(order.status)) + '</span></div></header><section class="service-order-event"><div><small>EVENTO</small><h2>' + this.escape(order.titulo) + '</h2><p>' + this.escape(order.cliente_nome) + '</p></div><div><small>DATA</small><strong>' + this.escape(Utils.fmtDate(order.data_evento) || 'A definir') + '</strong></div></section><section class="service-order-info"><div><small>MONTAGEM</small><strong>' + this.escape(order.hora_montagem || 'A definir') + '</strong></div><div><small>INÍCIO</small><strong>' + this.escape(order.hora_evento || 'A definir') + '</strong></div><div><small>LOCAL</small><strong>' + this.escape(order.local_evento || 'A definir') + '</strong></div><div><small>VEÍCULO</small><strong>' + this.escape(order.veiculo || 'A definir') + '</strong></div></section><section class="service-order-address"><small>ENDEREÇO</small><strong>' + this.escape(order.endereco || 'A definir') + '</strong>' + (order.contato_local ? '<p>Contato no local: ' + this.escape(order.contato_local) + (order.telefone_contato ? ' · ' + this.escape(order.telefone_contato) : '') + '</p>' : '') + '</section><div class="service-order-columns"><section><h3>Equipamentos e serviços</h3><ul>' + (items || '<li><span>Nenhum item informado</span></li>') + '</ul></section><section><h3>Equipe escalada</h3><ul>' + (team || '<li><span>Nenhum profissional escalado</span></li>') + '</ul></section></div>' + (order.responsavel_nome ? '<section class="service-order-responsible"><small>RESPONSÁVEL TÉCNICO</small><strong>' + this.escape(order.responsavel_nome) + '</strong><span>' + this.escape(order.responsavel_telefone || '') + '</span></section>' : '') + (order.orientacoes ? '<section class="service-order-notes"><h3>Orientações operacionais</h3><p>' + this.escape(order.orientacoes).replace(/\n/g, '<br>') + '</p></section>' : '') + (order.traje ? '<section class="service-order-strip"><b>Traje:</b> ' + this.escape(order.traje) + '</section>' : '') + (order.observacoes ? '<section class="service-order-strip"><b>Observações:</b> ' + this.escape(order.observacoes) + '</section>' : '') + '<footer>' + this.escape(this._data.config.nome || '1000 Beats Áudio, Vídeo e Iluminação Ltda.') + (this._data.config.cnpj ? ' · CNPJ ' + this.escape(this._data.config.cnpj) : '') + (this._data.config.tel ? '<span>' + this.escape(this._data.config.tel) + '</span>' : '') + '</footer></article>';
  },

  abrirPreview(order) {
    if (!order) return; this._atual = order; document.getElementById('serviceOrderPreview')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'serviceOrderPreview'; wrap.className = 'service-order-preview-overlay';
    wrap.innerHTML = '<div class="service-order-preview-shell"><div class="service-order-preview-toolbar"><div><small>PRÉVIA DA ORDEM DE SERVIÇO</small><strong>Revise antes de enviar</strong></div><div>' + (CONFIG.canManageOperations ? '<button class="ops-action edit" data-edit-preview>Editar</button>' : '') + '<button class="ops-btn secondary" data-pdf>Salvar PDF</button><button class="ops-btn service-order-whatsapp" data-whatsapp>WhatsApp</button><button class="ops-icon" data-close aria-label="Fechar">×</button></div></div><div class="service-order-preview-scroll">' + this.previewHtml(order) + '</div></div>';
    document.body.appendChild(wrap); const close = () => wrap.remove(); wrap.querySelector('[data-close]').addEventListener('click', close); wrap.addEventListener('click', event => { if (event.target === wrap) close(); });
    wrap.querySelector('[data-edit-preview]')?.addEventListener('click', () => { close(); this.abrirEditor(order); });
    wrap.querySelector('[data-pdf]').addEventListener('click', () => this.salvarPDF(order));
    wrap.querySelector('[data-whatsapp]').addEventListener('click', () => this.abrirWhatsApp(order));
  },

  mensagem(order) {
    const line = '\n'; const items = (order.itens || []).map(item => '• ' + (item.quantidade || 1) + 'x ' + item.descricao).join(line); const team = (order.equipe || []).map(item => '• ' + item.nome + (item.funcao ? ' — ' + item.funcao : '')).join(line);
    return '*ORDEM DE SERVIÇO ' + this.numero(order.numero) + ' | 1K BEATS*' + line + line + '*EVENTO*' + line + order.titulo + line + (order.cliente_nome || '') + line + line + '*DATA E HORÁRIOS*' + line + 'Data: ' + (Utils.fmtDate(order.data_evento) || 'A definir') + line + 'Montagem: ' + (order.hora_montagem || 'A definir') + line + 'Início: ' + (order.hora_evento || 'A definir') + line + line + '*LOCAL*' + line + (order.local_evento || '') + line + (order.endereco || 'Endereço a definir') + (order.contato_local ? line + 'Contato: ' + order.contato_local + (order.telefone_contato ? ' · ' + order.telefone_contato : '') : '') + line + line + '*EQUIPAMENTOS E SERVIÇOS*' + line + (items || 'A definir') + line + line + '*EQUIPE*' + line + (team || 'A definir') + (order.veiculo ? line + line + '*VEÍCULO*' + line + order.veiculo : '') + (order.traje ? line + line + '*TRAJE*' + line + order.traje : '') + (order.orientacoes ? line + line + '*ORIENTAÇÕES*' + line + order.orientacoes : '') + (order.observacoes ? line + line + '*OBSERVAÇÕES*' + line + order.observacoes : '') + line + line + 'Confirme o recebimento desta ordem de serviço, por favor.';
  },

  abrirWhatsApp(order) {
    document.getElementById('serviceOrderWhatsApp')?.remove(); const wrap = document.createElement('div'); wrap.id = 'serviceOrderWhatsApp'; wrap.className = 'modal-overlay open'; const message = this.mensagem(order);
    wrap.innerHTML = '<div class="whatsapp-share-box service-order-share"><div class="whatsapp-share-head"><div><small>WHATSAPP</small><h2>Compartilhar ordem de serviço</h2></div><button class="whatsapp-share-close" data-close aria-label="Fechar">×</button></div><div class="modal-field"><label>Telefone do técnico</label><input id="osWhatsAppDestino" type="tel" inputmode="tel" value="' + this.safe(order.responsavel_telefone) + '" placeholder="(21) 99999-9999"><small class="whatsapp-share-hint">Se não estiver salvo na agenda, o WhatsApp abrirá diretamente neste número.</small></div><div class="modal-field whatsapp-message-field"><div class="whatsapp-message-label"><label>Prévia da mensagem</label><div class="whatsapp-message-tools"><button type="button" data-restore>Restaurar padrão</button><button type="button" data-copy>Copiar mensagem</button></div></div><textarea id="osWhatsAppMensagem">' + this.safe(message) + '</textarea><small class="whatsapp-share-hint">As alterações feitas aqui valem somente para este envio.</small></div><div class="ops-modal-actions whatsapp-share-actions"><button class="ops-btn secondary" type="button" data-close>Cancelar</button><button class="ops-btn whatsapp-open-btn" type="button" data-open>Abrir WhatsApp</button></div></div>';
    document.body.appendChild(wrap); const close = () => wrap.remove(); wrap.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close)); wrap.querySelector('[data-restore]').addEventListener('click', () => { wrap.querySelector('#osWhatsAppMensagem').value = message; }); wrap.querySelector('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText(wrap.querySelector('#osWhatsAppMensagem').value); Utils.toast('Mensagem copiada.'); } catch (_) { Utils.toast('Não foi possível copiar a mensagem.', 'erro'); } });
    wrap.querySelector('[data-open]').addEventListener('click', async () => { const content = wrap.querySelector('#osWhatsAppMensagem').value.trim(); const phone = Orcamentos.normalizarWhatsApp(wrap.querySelector('#osWhatsAppDestino').value); if (!content) return Utils.toast('A mensagem está vazia.', 'erro'); window.open((phone ? 'https://wa.me/' + phone : 'https://wa.me/') + '?text=' + encodeURIComponent(content), '_blank', 'noopener'); close(); if (CONFIG.canManageOperations && order.status === 'rascunho') { try { await Api.request(Api.orgFilter('/rest/v1/ordens_servico?id=eq.' + encodeURIComponent(order.id)), { method: 'PATCH', body: JSON.stringify({ status: 'enviada', enviada_em: new Date().toISOString() }) }); order.status = 'enviada'; await this.carregar(); } catch (_) {} } });
  },

  salvarPDF(order) {
    if (!window.jspdf?.jsPDF) return Utils.toast('O gerador de PDF ainda está carregando. Tente novamente.', 'erro');
    const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'mm', format: 'a4' }); const pink = [217, 26, 114], ink = [26, 26, 37], gray = [105, 105, 121]; let y = 18;
    const text = (value, x, py, size = 10, style = 'normal', color = ink) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color); doc.text(String(value || ''), x, py); };
    const lines = (value, width) => doc.splitTextToSize(String(value || '—'), width);
    doc.setFillColor(...ink); doc.rect(0, 0, 210, 44, 'F'); text('1K', 15, 22, 25, 'bold', [255,255,255]); text('beats))', 32, 22, 16, 'normal', pink); doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(...pink); doc.text('ORDEM DE SERVIÇO', 195, 13, { align: 'right' }); doc.setFontSize(20); doc.setTextColor(255,255,255); doc.text('OS ' + this.numero(order.numero), 195, 27, { align: 'right' });
    y = 56; text('EVENTO', 15, y, 7, 'bold', gray); text(order.titulo, 15, y + 8, 16, 'bold'); text(order.cliente_nome || '', 15, y + 14, 9, 'normal', gray); text('DATA', 195, y, 7, 'bold', gray); doc.text(Utils.fmtDate(order.data_evento) || 'A definir', 195, y + 9, { align: 'right' }); y += 25;
    doc.setDrawColor(225,225,234); doc.line(15,y,195,y); y += 10; [['MONTAGEM',order.hora_montagem],['INÍCIO',order.hora_evento],['LOCAL',order.local_evento],['VEÍCULO',order.veiculo]].forEach((item,i)=>{const x=15+i*45;text(item[0],x,y,6,'bold',gray);text(item[1]||'A definir',x,y+7,9,'bold');}); y += 18; text('ENDEREÇO',15,y,7,'bold',gray); text(order.endereco||'A definir',15,y+7,9,'bold'); y += 18;
    const section = (title, content) => { if(y>260){doc.addPage();y=18;} text(title.toUpperCase(),15,y,8,'bold',pink); y+=7; content.forEach(value=>{const wrapped=lines(value,175); if(y+wrapped.length*5>280){doc.addPage();y=18;} text('•',16,y,9,'bold',pink); doc.setFontSize(9);doc.setTextColor(...ink);doc.text(wrapped,21,y);y+=wrapped.length*5+2;}); y+=5; };
    section('Equipamentos e serviços',(order.itens||[]).map(item=>(item.quantidade||1)+'x '+item.descricao)); section('Equipe escalada',(order.equipe||[]).map(item=>item.nome+(item.funcao?' — '+item.funcao:'')+(item.inicio?' — '+item.inicio+(item.fim?' às '+item.fim:''):'')));
    if(order.responsavel_nome)section('Responsável técnico',[order.responsavel_nome+(order.responsavel_telefone?' · '+order.responsavel_telefone:'')]); if(order.orientacoes)section('Orientações operacionais',[order.orientacoes]); if(order.traje)section('Traje',[order.traje]); if(order.observacoes)section('Observações',[order.observacoes]);
    const pages=doc.getNumberOfPages();for(let page=1;page<=pages;page++){doc.setPage(page);doc.setDrawColor(230,230,236);doc.line(15,287,195,287);text(this._data.config.nome||'1000 Beats Áudio, Vídeo e Iluminação Ltda.',15,293,6,'normal',gray);doc.text('Página '+page+' de '+pages,195,293,{align:'right'});} doc.save('OS-'+this.numero(order.numero)+'-'+String(order.titulo||'evento').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')+'.pdf');
  },

  async novaParaProducao(production) { Nav.showPanel('ordemServico'); await this.carregar(); const fresh = this._data.producoes.find(item => item.id === production.id) || production; const existing = this._data.ordens.find(order => order.producao_id === production.id); existing ? this.abrirPreview(existing) : this.abrirEditor(null, fresh); }
};

(function integrateServiceOrdersWithProductions() {
  const original = Producoes.renderDetalhe.bind(Producoes);
  Producoes.renderDetalhe = function renderDetalheComOS(production) {
    original(production); const actions = document.querySelector('#producoesContent .production-actions');
    if (actions && CONFIG.canViewOperations) { actions.insertAdjacentHTML('beforeend', '<button class="ops-btn service-order-shortcut" id="btnProdOS">Ordem de serviço</button>'); document.getElementById('btnProdOS')?.addEventListener('click', () => OrdensServico.novaParaProducao(production)); }
  };
})();