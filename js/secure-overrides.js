(function secureQuoteModule() {
  const originalPdf = Orcamentos.gerarPDF.bind(Orcamentos);

  Orcamentos.loadCfg = async function loadCfg() {
    try {
      const rows = await Api.request(Api.orgFilter('/rest/v1/config?select=*&limit=1'));
      const config = rows?.[0] || {};
      this._cfg = {
        id: config.id || null,
        nome: config.nome || CONFIG.context?.organization?.name || '1000 Beats',
        cnpj: config.cnpj || '',
        tel: config.tel || '',
        email: config.email || '',
        end: config.endereco || ''
      };
      const values = {
        cfgNome: this._cfg.nome,
        cfgCnpj: this._cfg.cnpj,
        cfgTelefone: this._cfg.tel,
        cfgEmail: this._cfg.email,
        cfgEndereco: this._cfg.end
      };
      Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.value = value;
      });
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Não foi possível carregar os dados da empresa.'), 'erro');
    }
  };

  Orcamentos.salvarConfig = async function salvarConfig() {
    if (!CONFIG.isAdmin) {
      Utils.toast('Somente administradores podem alterar a empresa.', 'erro');
      return;
    }
    const data = {
      nome: Utils.sanitizeText(document.getElementById('cfgNome')?.value, 150),
      cnpj: Utils.sanitizeText(document.getElementById('cfgCnpj')?.value, 20) || null,
      tel: Utils.sanitizeText(document.getElementById('cfgTelefone')?.value, 30) || null,
      email: Utils.sanitizeText(document.getElementById('cfgEmail')?.value, 150) || null,
      endereco: Utils.sanitizeText(document.getElementById('cfgEndereco')?.value, 250) || null
    };
    if (!data.nome) {
      Utils.toast('Informe o nome da empresa.', 'erro');
      return;
    }
    try {
      const path = this._cfg.id
        ? Api.orgFilter('/rest/v1/config?id=eq.' + encodeURIComponent(this._cfg.id))
        : '/rest/v1/config';
      const rows = await Api.request(path, {
        method: this._cfg.id ? 'PATCH' : 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(Api.orgPayload(data))
      });
      this._cfg = {
        id: rows?.[0]?.id || this._cfg.id,
        nome: data.nome,
        cnpj: data.cnpj || '',
        tel: data.tel || '',
        email: data.email || '',
        end: data.endereco || ''
      };
      document.getElementById('configPanel')?.classList.remove('open');
      Utils.toast('Dados da empresa salvos.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao salvar configurações.'), 'erro');
    }
  };

  Orcamentos.renderDropdown = function renderDropdown(filter) {
    const term = String(filter || '').toLowerCase();
    const dropdown = document.getElementById('clienteDropdown');
    if (!dropdown) return;
    const show = clients => {
      dropdown.innerHTML = '';
      const filtered = term
        ? clients.filter(client => String(client.nome || '').toLowerCase().includes(term))
        : clients;
      if (!filtered.length) {
        dropdown.innerHTML = '<div class="cliente-item-vazio">Nenhum cliente cadastrado</div>';
      } else {
        filtered.forEach(client => {
          const item = document.createElement('div');
          item.className = 'cliente-item';
          item.innerHTML =
            '<div class="cliente-item-nome">' + Utils.escapeHTML(client.nome) + '</div>' +
            (client.cnpj ? '<div class="cliente-item-cnpj">' + Utils.escapeHTML(client.cnpj) + '</div>' : '');
          item.addEventListener('click', () => {
            document.getElementById('nomeCliente').value = client.nome || '';
            document.getElementById('cnpjCliente').value = client.cnpj || '';
            dropdown.classList.remove('open');
          });
          dropdown.appendChild(item);
        });
      }
      dropdown.classList.add('open');
    };
    if (this._dropCache.length) show(this._dropCache);
    else Clientes.getAll(clients => {
      this._dropCache = clients;
      show(clients);
    });
  };

  Orcamentos.dadosSeguros = function dadosSeguros() {
    const data = this._coletarDados();
    if (!data.itens.length) throw new Error('Adicione pelo menos um item ao orçamento.');
    if (!data.cliente || data.cliente === 'Cliente') throw new Error('Informe o cliente.');
    return {
      cliente_nome: Utils.sanitizeText(data.cliente, 150),
      cnpj_cli: Utils.sanitizeText(data.cnpjCli, 20) || null,
      referencia: Utils.sanitizeText(data.ref, 150) || null,
      valido_ate: data.val || null,
      desconto_tipo: data.tipo === 'val' ? 'val' : 'pct',
      desconto_valor: Math.max(0, Number(data.discVal) || 0),
      itens: data.itens.slice(0, 100).map(item => ({
        desc: Utils.sanitizeText(item.desc, 300),
        qty: Math.max(0, Number(item.qty) || 0),
        unit: Math.max(0, Number(item.unit) || 0),
        tot: Math.max(0, Number(item.tot) || 0)
      })),
      observacoes: Utils.sanitizeText(data.obs, 3000) || null,
      empresa: Utils.sanitizeText(this._cfg.nome, 150) || null,
      cnpj_emp: Utils.sanitizeText(this._cfg.cnpj, 20) || null,
      tel_emp: Utils.sanitizeText(this._cfg.tel, 30) || null,
      email_emp: Utils.sanitizeText(this._cfg.email, 150) || null,
      solicitante: Utils.sanitizeText(data.solicitante, 150) || null,
      total: Math.max(0, Number(data.total) || 0),
      status: this._currentQuote?.status || 'pendente'
    };
  };

  Orcamentos.salvarAtual = async function salvarAtual() {
    const payload = this.dadosSeguros();
    if (this._currentQuote?.id) {
      const rows = await Api.request(Api.orgFilter('/rest/v1/orcamentos?id=eq.' + encodeURIComponent(this._currentQuote.id)), {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(payload)
      });
      this._currentQuote = rows?.[0] || { ...this._currentQuote, ...payload };
    } else {
      const rows = await Api.request('/rest/v1/orcamentos', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(Api.orgPayload({ ...payload, created_by: Auth.user?.id || null }))
      });
      this._currentQuote = rows?.[0];
    }
    if (!this._currentQuote?.id || !this._currentQuote?.public_token) {
      throw new Error('O servidor não retornou o identificador do orçamento.');
    }
    const numberElement = document.getElementById('metaNumero');
    const numberRow = document.getElementById('metaNumeroRow');
    if (numberElement) numberElement.textContent = Utils.fmtNumero(this._currentQuote.numero);
    if (numberRow) numberRow.style.display = '';
    return this._currentQuote;
  };

  Orcamentos.gerarWhatsApp = async function gerarWhatsApp() {
    const button = document.getElementById('btnWpp');
    const buttonHtml = button?.innerHTML || 'WhatsApp';
    const data = this._coletarDados();
    const newline = '\n';
    const buildMessage = quote => {
      let message = Utils.saudacao() + ',' + newline + newline;
      message += 'Segue o orçamento da *' + (this._cfg.nome || 'nossa empresa') + '*.' + newline;
      if (data.ref) message += 'Referência: *' + data.ref + '*' + newline;
      message += 'Cliente: *' + data.cliente + '*' + newline;
      if (data.solicitante) message += 'Solicitante: *' + data.solicitante + '*' + newline;
      if (data.val) message += 'Válido até: ' + Utils.fmtDate(data.val) + newline;
      message += newline + '*Total: ' + Utils.fmt(data.total) + '*';
      if (quote?.public_token) {
        message += newline + newline + 'Visualizar orçamento:' + newline + CONFIG.publicQuoteUrl(quote.public_token);
      }
      return message;
    };

    const initialMessage = buildMessage(null);
    this.abrirModalWhatsApp(initialMessage);
    const shareButton = document.getElementById('btnAbrirWhatsApp');
    if (shareButton) {
      shareButton.textContent = 'Preparando link...';
      shareButton.disabled = true;
    }
    if (button) {
      button.textContent = 'Preparando...';
      button.disabled = true;
    }
    try {
      const quote = await this.salvarAtual();
      const finalMessage = buildMessage(quote);
      const preview = document.getElementById('whatsappMensagem');
      if (preview?.value === initialMessage) preview.value = finalMessage;
      this._whatsappPadrao = finalMessage;
      Utils.toast('Orçamento salvo. Revise a mensagem antes de enviar.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'A prévia foi aberta, mas não foi possível gerar o link.'), 'erro');
    } finally {
      if (button) {
        button.innerHTML = buttonHtml;
        button.disabled = false;
      }
      if (shareButton) {
        shareButton.textContent = 'Abrir WhatsApp';
        shareButton.disabled = false;
      }
    }
  };
  Orcamentos.gerarPDF = async function gerarPDFSeguro() {
    try {
      await this.salvarAtual();
      await originalPdf();
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao gerar o PDF.'), 'erro');
    }
  };

  ListaOrcamentos.carregar = async function carregarLista() {
    const container = document.getElementById('listaOrcamentos');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Carregando orçamentos...</div>';
    try {
      const quotes = await Api.request(Api.orgFilter('/rest/v1/orcamentos?select=id,numero,cliente_nome,referencia,total,status,created_at,public_token&order=created_at.desc&limit=100')) || [];
      this._dados = quotes;
      this._selecionados = new Set();
      if (!quotes.length) { container.innerHTML = '<div class="empty-state">Nenhum orçamento enviado.</div>'; this.atualizarAcoesLote(); return; }
      const labels = { pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado' };
      container.innerHTML = '';
      quotes.forEach(quote => {
        const status = Object.hasOwn(labels, quote.status) ? quote.status : 'pendente';
        const statusControl = CONFIG.canEditCommercial
          ? '<div class="quote-status-control"><button type="button" class="quote-status status-' + Utils.safeId(status) + '" aria-expanded="false">' + Utils.escapeHTML(labels[status]) + '<span>⌄</span></button><div class="quote-status-menu" hidden>' + Object.entries(labels).map(([value, label]) => '<button type="button" data-status="' + value + '">' + Utils.escapeHTML(label) + '</button>').join('') + '</div></div>'
          : '<div class="quote-status-readonly"><span class="quote-status status-' + Utils.safeId(status) + '">' + Utils.escapeHTML(labels[status]) + '</span></div>';
        const row = document.createElement('div'); row.className = 'quote-list-row';
        row.innerHTML =
          (CONFIG.isAdmin ? '<label class="quote-check"><input type="checkbox" value="' + Utils.safeId(quote.id) + '" aria-label="Selecionar orçamento"><span></span></label>' : '') +
          '<span class="quote-number">' + Utils.escapeHTML(Utils.fmtNumero(quote.numero)) + '</span>' +
          '<div class="quote-client"><strong>' + Utils.escapeHTML(quote.cliente_nome || '—') + '</strong>' + (quote.referencia ? '<small>' + Utils.escapeHTML(quote.referencia) + '</small>' : '') + '</div>' +
          '<span class="quote-date">' + Utils.escapeHTML(Utils.fmtDate(quote.created_at)) + '</span>' +
          '<span class="quote-total">' + Utils.escapeHTML(Utils.fmt(quote.total)) + '</span>' +
          statusControl +
          '<div class="quote-actions"><a class="quote-view" target="_blank" rel="noopener" href="' + Utils.escapeHTML('ver.html?t=' + encodeURIComponent(quote.public_token)) + '" title="Visualizar orçamento">↗</a>' + (CONFIG.isAdmin ? '<button class="quote-more" type="button" title="Selecionar para exclusão" aria-label="Selecionar para exclusão">•••</button>' : '') + '</div>';
        const checkbox = row.querySelector('.quote-check input');
        checkbox?.addEventListener('change', event => { if (event.target.checked) this._selecionados.add(quote.id); else this._selecionados.delete(quote.id); this.atualizarAcoesLote(); });
        const statusButton = row.querySelector('.quote-status-control .quote-status'); const statusMenu = row.querySelector('.quote-status-menu');
        statusButton?.addEventListener('click', () => { document.querySelectorAll('.quote-status-menu').forEach(menu => { if (menu !== statusMenu) menu.hidden = true; }); statusMenu.hidden = !statusMenu.hidden; statusButton.setAttribute('aria-expanded', String(!statusMenu.hidden)); });
        statusMenu?.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', async event => {
          const next = event.currentTarget.dataset.status;
          try { await Api.request(Api.orgFilter('/rest/v1/orcamentos?id=eq.' + encodeURIComponent(quote.id)), { method: 'PATCH', body: JSON.stringify({ status: next }) }); quote.status = next; statusButton.className = 'quote-status status-' + Utils.safeId(next); statusButton.innerHTML = Utils.escapeHTML(labels[next]) + '<span>⌄</span>'; statusMenu.hidden = true; Utils.toast('Status atualizado.'); }
          catch (error) { Utils.toast(Api.friendlyError(error), 'erro'); }
        }));
        row.querySelector('.quote-more')?.addEventListener('click', () => { checkbox.checked = !checkbox.checked; checkbox.dispatchEvent(new Event('change')); });
        container.appendChild(row);
      });
      this.atualizarAcoesLote();
    } catch (error) { container.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>'; }
  };

  ListaOrcamentos.atualizarAcoesLote = function atualizarAcoesLote() {
    const count = this._selecionados?.size || 0; const label = document.getElementById('quoteSelectionLabel'); const button = document.getElementById('btnExcluirSelecionados');
    if (label) label.textContent = count ? count + (count === 1 ? ' orçamento selecionado' : ' orçamentos selecionados') : 'Selecione orçamentos para excluir em grupo';
    if (button) { button.disabled = !count; button.textContent = count ? 'Excluir ' + count + (count === 1 ? ' selecionado' : ' selecionados') : 'Excluir selecionados'; }
  };

  ListaOrcamentos.excluirSelecionados = async function excluirSelecionados() {
    const ids = [...(this._selecionados || [])]; if (!ids.length) return;
    if (!confirm('Excluir definitivamente ' + ids.length + (ids.length === 1 ? ' orçamento?' : ' orçamentos?') + ' Esta ação não pode ser desfeita.')) return;
    try { await Promise.all(ids.map(id => Api.request(Api.orgFilter('/rest/v1/orcamentos?id=eq.' + encodeURIComponent(id)), { method: 'DELETE' }))); Utils.toast(ids.length + (ids.length === 1 ? ' orçamento excluído.' : ' orçamentos excluídos.')); this.carregar(); }
    catch (error) { Utils.toast(Api.friendlyError(error, 'Não foi possível excluir todos os itens selecionados.'), 'erro'); }
  };
  ListaOrcamentos.exportar = function exportarOrcamentos() {
    Utils.downloadCSV('orcamentos.csv', (this._dados || []).map(quote => ({
      Número: quote.numero,
      Cliente: quote.cliente_nome,
      Referência: quote.referencia,
      Total: Number(quote.total || 0).toFixed(2),
      Status: quote.status,
      Data: Utils.fmtDate(quote.created_at)
    })));
  };

  Dashboard.carregar = async function carregarDashboard() {
    const now = new Date();
    const name = document.getElementById('userNome')?.textContent || '';
    const greeting = document.getElementById('dashSaudacao');
    const date = document.getElementById('dashData');
    if (greeting) greeting.textContent = Utils.saudacao() + (name ? ', ' + name : '') + '!';
    if (date) date.textContent = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01T00:00:00`;
    try {
      const quotes = await Api.request(Api.orgFilter(
        '/rest/v1/orcamentos?select=numero,cliente_nome,referencia,total,status,created_at' +
        '&created_at=gte.' + encodeURIComponent(start) + '&order=created_at.desc'
      )) || [];
      const approved = quotes.filter(quote => quote.status === 'aprovado');
      const pending = quotes.filter(quote => quote.status === 'pendente');
      const completed = quotes.filter(quote => ['aprovado', 'recusado'].includes(quote.status));
      const set = (id, value) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
      };
      set('kpiTotal', quotes.length);
      set('kpiValor', Utils.fmt(quotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0)));
      set('kpiAprovados', approved.length);
      set('kpiAprovadosVal', Utils.fmt(approved.reduce((sum, quote) => sum + Number(quote.total || 0), 0)));
      set('kpiPendentes', pending.length);
      set('kpiPendentesVal', Utils.fmt(pending.reduce((sum, quote) => sum + Number(quote.total || 0), 0)));
      const rate = completed.length ? Math.round(approved.length / completed.length * 100) : 0;
      set('dashTaxaPct', rate + '% aprovados');
      set('dashTaxaNum', approved.length + ' de ' + completed.length);
      const bar = document.getElementById('dashTaxaBarra');
      if (bar) bar.style.width = rate + '%';
      set('dashMesLabel', now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }));
      const recent = document.getElementById('dashUltimos');
      if (!recent) return;
      if (!quotes.length) {
        recent.innerHTML = '<div class="empty-state">Nenhum orçamento neste mês.</div>';
        return;
      }
      recent.innerHTML = '';
      quotes.slice(0, 4).forEach(quote => {
        const row = document.createElement('div');
        row.className = 'dash-quote-row';
        row.innerHTML =
          '<span>' + Utils.escapeHTML(Utils.fmtNumero(quote.numero)) + '</span>' +
          '<div><strong>' + Utils.escapeHTML(quote.cliente_nome || '—') + '</strong>' +
          (quote.referencia ? '<small>' + Utils.escapeHTML(quote.referencia) + '</small>' : '') + '</div>' +
          '<em class="status-' + Utils.safeId(quote.status || 'pendente') + '">' +
            Utils.escapeHTML(({ pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado' })[quote.status] || 'Pendente') +
          '</em>';
        recent.appendChild(row);
      });
    } catch (error) {
      const recent = document.getElementById('dashUltimos');
      if (recent) recent.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>';
    }
  };
})();
