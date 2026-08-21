// ════════════════════════════════════════════════════════════
// orcamentos.js — Módulo de orçamentos
// ════════════════════════════════════════════════════════════

const Orcamentos = {

  _cnt: 0,
  _cfg: {},
  _dropCache: [],
  _clienteSelecionado: null,
  _whatsappPadrao: '',
  _registroAtual: null,
  _salvando: false,
  _alteracoesPendentes: false,

  // ── Inicialização ─────────────────────────────────────────
  init() {
    this.loadCfg();
    this.bindEvents();
    this.addItem();
    // Preencher validade com hoje por padrão (usando hora local, não UTC)
    const _h = new Date();
    const hoje = _h.getFullYear() + '-' + String(_h.getMonth()+1).padStart(2,'0') + '-' + String(_h.getDate()).padStart(2,'0');
    document.getElementById('validade').value = hoje;
    this.updateMeta();
    this.atualizarEstadoSalvamento();
  },

  bindEvents() {
    document.getElementById('btnAdd').addEventListener('click', () => this.addItem());
    document.getElementById('desconto').addEventListener('input', () => this.calcTotals());
    document.getElementById('validade').addEventListener('change', () => this.updateMeta());
    document.getElementById('refEvento').addEventListener('input', () => this.updateMeta());
    document.getElementById('cnpjCliente').addEventListener('input', function() {
      this.value = Utils.mascararDoc(this.value);
    });
    document.getElementById('btnConfig').addEventListener('click', () => {
      document.getElementById('configPanel').classList.toggle('open');
    });
    document.getElementById('btnSaveConfig').addEventListener('click', () => this.salvarConfig());
    document.getElementById('btnSalvarOrcamento')?.addEventListener('click', () => this.salvarOrcamento());
    document.getElementById('btnWpp').addEventListener('click', () => this.gerarWhatsApp());
    document.getElementById('btnPdf').addEventListener('click', () => this.gerarPDF());

    const form = document.getElementById('panelOrcamentos');
    form?.addEventListener('input', event => {
      if (event.target.closest('#configPanel')) return;
      this.marcarAlterado();
    });
    form?.addEventListener('change', event => {
      if (event.target.closest('#configPanel')) return;
      this.marcarAlterado();
    });

    // Dropdown de clientes
    const clienteInput = document.getElementById('nomeCliente');
    clienteInput.addEventListener('input', () => { this._clienteSelecionado = null; this._dropCache = []; this.renderDropdown(clienteInput.value); });
    clienteInput.addEventListener('focus', () => { this._dropCache = []; this.renderDropdown(clienteInput.value); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cliente-wrap')) {
        document.getElementById('clienteDropdown').classList.remove('open');
      }
    });

    // Modal de novo cliente rápido
    const btnAddCli = document.getElementById('btnAddCliente');
    if (btnAddCli) btnAddCli.addEventListener('click', () => this.abrirModalClienteRapido());
    document.getElementById('modalClienteCancel').addEventListener('click', () => {
      document.getElementById('modalCliente').classList.remove('open');
    });
    document.getElementById('modalCliente').addEventListener('click', (e) => {
      if (e.target === document.getElementById('modalCliente')) {
        document.getElementById('modalCliente').classList.remove('open');
      }
    });
    document.getElementById('modalClienteSave').addEventListener('click', () => this.salvarClienteRapido());
    document.getElementById('btnFecharWhatsApp')?.addEventListener('click', () => this.fecharModalWhatsApp());
    document.getElementById('btnCancelarWhatsApp')?.addEventListener('click', () => this.fecharModalWhatsApp());
    document.getElementById('btnRestaurarWhatsApp')?.addEventListener('click', () => this.restaurarMensagemWhatsApp());
    document.getElementById('btnCopiarWhatsApp')?.addEventListener('click', () => this.copiarMensagemWhatsApp());
    document.getElementById('btnAbrirWhatsApp')?.addEventListener('click', () => this.abrirWhatsApp());
    document.getElementById('modalWhatsApp')?.addEventListener('click', event => {
      if (event.target.id === 'modalWhatsApp') this.fecharModalWhatsApp();
    });
  },

  // ── Tipo de desconto ─────────────────────────────────────
  setDiscTipo(tipo) {
    document.getElementById('descontoTipo').value = tipo;
    document.getElementById('btnDiscPct').classList.toggle('active', tipo === 'pct');
    document.getElementById('btnDiscVal').classList.toggle('active', tipo === 'val');
    this.calcTotals();
  },

  // ── Itens do orçamento ────────────────────────────────────
  addItem() {
    this._cnt++;
    const id = this._cnt;
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.id = id;
    div.innerHTML =
      '<input type="text" aria-label="Descrição do item" placeholder="Descrição do produto ou serviço">' +
      '<input type="number" class="c" aria-label="Quantidade" value="1" min="1" step="1" inputmode="numeric">' +
      '<input type="number" class="r" aria-label="Valor unitário" placeholder="0,00" min="0" step="0.01" inputmode="decimal">' +
      '<span class="itv empty" id="itv-' + id + '">—</span>' +
      '<button class="btn-remove no-print" type="button" title="Remover item" aria-label="Remover item">×</button>';
    document.getElementById('itemsContainer').appendChild(div);
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', () => this.calcTotals()));
    div.querySelector('.btn-remove').addEventListener('click', () => { div.remove(); this.calcTotals(); });
    // Autocomplete do catálogo na descrição
    const descInput = div.querySelector('input');
    const dropdown = document.createElement('div');
    dropdown.className = 'cat-autocomplete';
    div.style.position = 'relative';
    div.insertBefore(dropdown, descInput.nextSibling);

    descInput.addEventListener('input', () => {
      const termo = descInput.value.trim();
      if (!termo) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); return; }
      Catalogo.buscar(termo, resultados => {
        if (descInput.value.trim() !== termo) return;
        if (resultados.length === 0) { dropdown.innerHTML = ''; dropdown.classList.remove('open'); return; }
        dropdown.innerHTML = '';
        resultados.slice(0, 6).forEach(item => {
          const opt = document.createElement('div');
          opt.className = 'cat-opt';
          opt.innerHTML = '<span class="cat-opt-nome">' + Utils.escapeHTML(item.nome) + '</span><span class="cat-opt-val">' + Utils.escapeHTML(Utils.fmt(item.valor)) + '</span>';
          opt.addEventListener('mousedown', (e) => {
            e.preventDefault();
            descInput.value = item.nome;
            const inputs = div.querySelectorAll('input');
            inputs[2].value = item.valor;
            dropdown.innerHTML = ''; dropdown.classList.remove('open');
            this.calcTotals();
            inputs[1].focus();
          });
          dropdown.appendChild(opt);
        });
        dropdown.classList.add('open');
      });
    });

    descInput.addEventListener('blur', () => {
      setTimeout(() => { dropdown.innerHTML = ''; dropdown.classList.remove('open'); }, 150);
    });

    descInput.focus();
    this.calcTotals();
  },

  calcTotals() {
    const rows = document.querySelectorAll('#itemsContainer .item-row');
    let sub = 0;
    rows.forEach(row => {
      const ins = row.querySelectorAll('input');
      const qty = parseFloat(ins[1].value) || 0;
      const unit = parseFloat(ins[2].value) || 0;
      const tot = qty * unit;
      sub += tot;
      const el = document.getElementById('itv-' + row.dataset.id);
      if (el) { el.textContent = tot > 0 ? Utils.fmt(tot) : '—'; el.className = 'itv' + (tot > 0 ? '' : ' empty'); }
    });
    const discVal = parseFloat(document.getElementById('desconto').value) || 0;
    const tipo = document.getElementById('descontoTipo').value;
    const discReais = tipo === 'pct' ? (sub * discVal / 100) : discVal;
    const total = Math.max(0, sub - discReais);
    const preview = document.getElementById('descontoPreview');
    if (discVal > 0 && preview) {
      if (tipo === 'pct') preview.textContent = discVal.toFixed(1) + '% = ' + Utils.fmt(discReais) + ' de desconto';
      else { const pct = sub > 0 ? (discReais / sub * 100).toFixed(1) : '0'; preview.textContent = Utils.fmt(discReais) + ' (' + pct + '% do subtotal)'; }
    } else if (preview) preview.textContent = '';
    document.getElementById('subtotal').textContent = Utils.fmt(sub);
    document.getElementById('total').textContent = Utils.fmt(total);
    const dr = document.getElementById('descontoRow');
    if (discReais > 0) { dr.style.display = 'flex'; document.getElementById('descontoVal').textContent = '- ' + Utils.fmt(discReais); }
    else dr.style.display = 'none';
  },

  updateMeta() {
    document.getElementById('metaEmissao').textContent = new Date().toLocaleDateString('pt-BR');
    document.getElementById('metaValidade').textContent = Utils.fmtDate(document.getElementById('validade').value);
    const ref = document.getElementById('refEvento').value.trim();
    const rr = document.getElementById('metaRefRow');
    if (ref) { document.getElementById('metaRef').textContent = ref; rr.style.display = ''; }
    else rr.style.display = 'none';
  },

  updateMastheadCompany() {
    const cfg = this._cfg || {};
    const nameEl = document.getElementById('mastheadEmpresa');
    const docEl = document.getElementById('mastheadCnpj');
    if (nameEl) nameEl.textContent = cfg.nome || '1000 Beats Áudio, Vídeo e Iluminação Ltda.';
    if (docEl) docEl.textContent = cfg.cnpj ? 'CNPJ ' + cfg.cnpj : 'CNPJ não informado';
  },

  // ── Configurações da empresa ──────────────────────────────
  loadCfg() {
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/config?select=*&limit=1', { headers: CONFIG.headers() })
      .then(r => r.json())
      .then(rows => {
        if (rows && rows.length > 0) {
          const c = rows[0];
          this._cfg = { nome: c.nome || '', cnpj: c.cnpj || '', tel: c.tel || '', email: c.email || '', end: c.endereco || '' };
          document.getElementById('cfgNome').value     = this._cfg.nome;
          document.getElementById('cfgCnpj').value     = this._cfg.cnpj;
          document.getElementById('cfgTelefone').value = this._cfg.tel;
          document.getElementById('cfgEmail').value    = this._cfg.email;
          document.getElementById('cfgEndereco').value = this._cfg.end;
          this.updateMastheadCompany();
        }
      })
      .catch(() => {
        try {
          const c = JSON.parse(localStorage.getItem(CONFIG.STORAGE_PREFIX + 'cfg') || '{}');
          this._cfg = c;
        } catch(e) {}
      });
  },

  salvarConfig() {
    const dados = {
      id: 1,
      nome:     document.getElementById('cfgNome').value.trim(),
      cnpj:     document.getElementById('cfgCnpj').value.trim() || null,
      tel:      document.getElementById('cfgTelefone').value.trim() || null,
      email:    document.getElementById('cfgEmail').value.trim() || null,
      endereco: document.getElementById('cfgEndereco').value.trim() || null
    };
    this._cfg = { nome: dados.nome, cnpj: dados.cnpj || '', tel: dados.tel || '', email: dados.email || '', end: dados.endereco || '' };
    this.updateMastheadCompany();
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/config?id=eq.1', {
      method: 'PATCH', headers: CONFIG.headers(), body: JSON.stringify(dados)
    }).then(() => {
      try { localStorage.setItem(CONFIG.STORAGE_PREFIX + 'cfg', JSON.stringify(this._cfg)); } catch(e) {}
      document.getElementById('configPanel').classList.remove('open');
      Utils.toast('Configurações salvas!');
    }).catch(() => Utils.toast('Erro ao salvar configurações.'));
  },

  // ── Dropdown de clientes ──────────────────────────────────
  renderDropdown(filtro) {
    const termo = (filtro || '').toLowerCase();
    const dropdown = document.getElementById('clienteDropdown');
    const mostrar = (lista) => {
      dropdown.innerHTML = '';
      const filtrados = termo ? lista.filter(c => (c.nome || '').toLowerCase().includes(termo)) : lista;
      if (filtrados.length === 0) {
        dropdown.innerHTML = '<div class="cliente-item-vazio">Nenhum cliente cadastrado</div>';
      } else {
        filtrados.forEach(c => {
          const div = document.createElement('div');
          div.className = 'cliente-item';
          div.innerHTML = '<div class="cliente-item-nome">' + (c.nome || '') + '</div>' + (c.cnpj ? '<div class="cliente-item-cnpj">' + c.cnpj + '</div>' : '');
          div.addEventListener('click', () => {
            this._clienteSelecionado = c;
            document.getElementById('nomeCliente').value = c.nome || '';
            document.getElementById('cnpjCliente').value = c.cnpj || '';
            dropdown.classList.remove('open');
          });
          dropdown.appendChild(div);
        });
      }
      dropdown.classList.add('open');
    };
    if (this._dropCache.length > 0) { mostrar(this._dropCache); return; }
    Clientes.getAll(lista => { this._dropCache = lista; mostrar(lista); });
  },

  abrirModalClienteRapido() {
    document.getElementById('modalClienteNome').value = document.getElementById('nomeCliente').value;
    document.getElementById('modalClienteCnpj').value = '';
    document.getElementById('modalCliente').classList.add('open');
    document.getElementById('modalClienteNome').focus();
  },

  salvarClienteRapido() {
    const nome = document.getElementById('modalClienteNome').value.trim();
    const cnpj = document.getElementById('modalClienteCnpj').value.trim();
    if (!nome) { document.getElementById('modalClienteNome').focus(); return; }
    Clientes.salvar({ nome, cnpj: cnpj || null }, null, () => {
      this._clienteSelecionado = { nome, cnpj, tel: '' };
      document.getElementById('nomeCliente').value = nome;
      document.getElementById('cnpjCliente').value = cnpj;
      document.getElementById('modalCliente').classList.remove('open');
      this._dropCache = [];
      Utils.toast('Cliente cadastrado!');
    });
  },

  // ── Coleta dados do formulário ────────────────────────────
  _coletarDados() {
    const rows = document.querySelectorAll('#itemsContainer .item-row');
    let sub = 0;
    const itens = [];
    rows.forEach(row => {
      const ins = row.querySelectorAll('input');
      const desc = ins[0].value.trim();
      const qty  = parseFloat(ins[1].value) || 0;
      const unit = parseFloat(ins[2].value) || 0;
      const tot  = qty * unit;
      sub += tot;
      if (desc) itens.push({ desc, qty, unit, tot });
    });
    const discVal   = parseFloat(document.getElementById('desconto').value) || 0;
    const tipo      = document.getElementById('descontoTipo').value;
    const discReais = tipo === 'pct' ? (sub * discVal / 100) : discVal;
    const total     = Math.max(0, sub - discReais);
    return {
      cliente:    document.getElementById('nomeCliente').value.trim() || 'Cliente',
      cnpjCli:    document.getElementById('cnpjCliente').value.trim(),
      ref:        document.getElementById('refEvento').value.trim(),
      val:        document.getElementById('validade').value,
      obs:        document.getElementById('obs').value.trim(),
      solicitante: (document.getElementById('solicitante') || {}).value || '',
      itens, sub, discVal, tipo, discReais, total
    };
  },

  _dadosParaBanco(d) {
    const cfg = this._cfg;
    return {
      cliente_nome: d.cliente || null,
      cnpj_cli: d.cnpjCli || null,
      referencia: d.ref || null,
      valido_ate: d.val || null,
      desconto_tipo: d.tipo,
      desconto_valor: d.discVal || 0,
      itens: d.itens,
      observacoes: d.obs || null,
      empresa: cfg.nome || null,
      cnpj_emp: cfg.cnpj || null,
      tel_emp: cfg.tel || null,
      email_emp: cfg.email || null,
      solicitante: d.solicitante || null,
      total: d.total,
      status: this._registroAtual?.status || 'pendente'
    };
  },

  _validarAntesDeSalvar(d) {
    if (!d.cliente || d.cliente === 'Cliente') {
      Utils.toast('Informe o cliente antes de salvar.');
      document.getElementById('nomeCliente')?.focus();
      return false;
    }
    if (!d.itens.length) {
      Utils.toast('Adicione pelo menos um item ao orçamento.');
      document.querySelector('#itemsContainer .item-row input')?.focus();
      return false;
    }
    return true;
  },

  marcarAlterado() {
    this._alteracoesPendentes = true;
    this.atualizarEstadoSalvamento();
  },

  atualizarEstadoSalvamento() {
    const btn = document.getElementById('btnSalvarOrcamento');
    const status = document.getElementById('orcamentoSaveStatus');
    if (btn) btn.textContent = this._registroAtual ? 'Salvar alterações' : 'Salvar orçamento';
    if (!status) return;
    if (this._salvando) {
      status.textContent = 'Salvando...';
      status.className = 'orc-save-status saving';
    } else if (this._registroAtual && !this._alteracoesPendentes) {
      status.textContent = 'Orçamento salvo';
      status.className = 'orc-save-status saved';
    } else if (this._alteracoesPendentes) {
      status.textContent = 'Alterações não salvas';
      status.className = 'orc-save-status pending';
    } else {
      status.textContent = 'Ainda não salvo';
      status.className = 'orc-save-status';
    }
  },

  async _salvarRegistro(options = {}) {
    if (this._salvando) return this._registroAtual;
    const d = this._coletarDados();
    if (!this._validarAntesDeSalvar(d)) return null;

    this._salvando = true;
    this.atualizarEstadoSalvamento();
    try {
      const headers = { ...CONFIG.headers(), 'Prefer': 'return=representation' };
      const editando = Boolean(this._registroAtual?.id);
      const url = CONFIG.SUPABASE_URL + '/rest/v1/orcamentos' +
        (editando ? '?id=eq.' + encodeURIComponent(this._registroAtual.id) : '');
      const payload = Api.orgPayload(this._dadosParaBanco(d));
      const response = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = errorText;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData?.message || errorData?.error || errorText;
        } catch (_) {}
        throw new Error(errorMessage || 'Não foi possível salvar.');
      }
      const rows = await response.json();
      const salvo = rows?.[0] || this._registroAtual;
      if (!salvo?.id) throw new Error('O banco não retornou o orçamento salvo.');
      this._registroAtual = salvo;
      this._alteracoesPendentes = false;

      if (salvo.numero) {
        document.getElementById('metaNumero').textContent = String(salvo.numero).padStart(4, '0');
        document.getElementById('metaNumeroRow').style.display = '';
      }
      if (!options.silent) Utils.toast(editando ? 'Alterações salvas.' : 'Orçamento salvo e incluído na lista.');
      return salvo;
    } catch (error) {
      Utils.toast('Erro ao salvar orçamento: ' + error.message);
      return null;
    } finally {
      this._salvando = false;
      this.atualizarEstadoSalvamento();
    }
  },

  async salvarOrcamento() {
    const btn = document.getElementById('btnSalvarOrcamento');
    if (btn) btn.disabled = true;
    await this._salvarRegistro();
    if (btn) btn.disabled = false;
  },

  novoOrcamento() {
    this._registroAtual = null;
    this._clienteSelecionado = null;
    this._alteracoesPendentes = false;
    this._cnt = 0;
    ['nomeCliente', 'cnpjCliente', 'solicitante', 'refEvento', 'obs'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
    document.getElementById('desconto').value = '';
    document.getElementById('descontoTipo').value = 'pct';
    const hoje = new Date();
    document.getElementById('validade').value = hoje.getFullYear() + '-' +
      String(hoje.getMonth() + 1).padStart(2, '0') + '-' + String(hoje.getDate()).padStart(2, '0');
    document.getElementById('itemsContainer').innerHTML = '';
    document.getElementById('metaNumero').textContent = '—';
    document.getElementById('metaNumeroRow').style.display = 'none';
    this.addItem();
    this.setDiscTipo('pct');
    this.calcTotals();
    this.updateMeta();
    this.atualizarEstadoSalvamento();
  },

  // ── WhatsApp ──────────────────────────────────────────────
  abrirModalWhatsApp(mensagem) {
    const modal = document.getElementById('modalWhatsApp');
    const destino = document.getElementById('whatsappDestino');
    const preview = document.getElementById('whatsappMensagem');
    if (!modal || !destino || !preview) return;
    this._whatsappPadrao = mensagem;
    destino.value = this._clienteSelecionado?.tel || '';
    preview.value = mensagem;
    modal.classList.add('open');
    setTimeout(() => (destino.value ? preview : destino).focus(), 0);
  },

  fecharModalWhatsApp() {
    document.getElementById('modalWhatsApp')?.classList.remove('open');
  },

  restaurarMensagemWhatsApp() {
    const preview = document.getElementById('whatsappMensagem');
    if (preview) preview.value = this._whatsappPadrao;
  },

  async copiarMensagemWhatsApp() {
    const preview = document.getElementById('whatsappMensagem');
    const mensagem = preview?.value || '';
    if (!mensagem.trim()) { Utils.toast('Não há mensagem para copiar.'); return; }
    let copiada = false;
    try {
      await navigator.clipboard.writeText(mensagem);
      copiada = true;
    } catch (_) {
      preview.focus();
      preview.select();
      copiada = document.execCommand('copy');
    }
    Utils.toast(copiada ? 'Mensagem copiada.' : 'Não foi possível copiar a mensagem.');
  },

  normalizarWhatsApp(telefone) {
    const digitos = String(telefone || '').replace(/[^0-9]/g, '');
    if (!digitos) return '';
    if (digitos.startsWith('55') && digitos.length >= 12) return digitos;
    if (digitos.length === 10 || digitos.length === 11) return '55' + digitos;
    return digitos;
  },

  abrirWhatsApp() {
    const mensagem = document.getElementById('whatsappMensagem')?.value.trim() || '';
    if (!mensagem) { Utils.toast('A mensagem está vazia.'); return; }
    const telefone = this.normalizarWhatsApp(document.getElementById('whatsappDestino')?.value);
    const url = telefone
      ? 'https://wa.me/' + telefone + '?text=' + encodeURIComponent(mensagem)
      : 'https://wa.me/?text=' + encodeURIComponent(mensagem);
    window.open(url, '_blank', 'noopener');
    this.fecharModalWhatsApp();
  },
  async gerarWhatsApp() {
    const d = this._coletarDados();
    const cfg = this._cfg;
    const nome = cfg.nome || '1K Beats';
    const nl = '\n';

    const btnEl = document.getElementById('btnWpp');
    const btnHtml = btnEl?.innerHTML || 'WhatsApp';
    if (btnEl) { btnEl.textContent = 'Salvando...'; btnEl.disabled = true; }

    try {
      // Salva ou atualiza o mesmo registro antes de compartilhar.
      const salvo = await this._salvarRegistro({ silent: true });
      if (!salvo) return;
      const id = salvo.id;
      const numero = salvo.numero;

      // 2. Montar mensagem completa com link
      let msg = Utils.saudacao() + ',' + nl + nl;
      msg += 'Segue o orçamento da *' + nome + '* referente a:' + nl;
      if (d.ref) msg += 'Ref.: *' + d.ref + '*' + nl;
      if (d.cliente) msg += 'Empresa: *' + d.cliente + '*' + nl;
      if (d.solicitante) msg += 'Solicitante: *' + d.solicitante + '*' + nl;
      msg += 'Válido até: ' + Utils.fmtDate(d.val) + nl;
      msg += nl + '*Itens:*' + nl;
      d.itens.forEach(it => { msg += '- ' + it.desc + ' · Qtd: ' + it.qty + ' · Total: ' + Utils.fmt(it.tot) + nl; });
      if (d.discReais > 0) {
        const ds = d.tipo === 'pct' ? d.discVal.toFixed(1) + '% (' + Utils.fmt(d.discReais) + ')' : Utils.fmt(d.discReais);
        msg += nl + 'Desconto: ' + ds + nl;
      }
      msg += nl + '*Total: ' + Utils.fmt(d.total) + '*';
      if (d.obs) msg += nl + nl + d.obs;
      msg += nl + nl + 'Em caso de dúvidas, estamos à disposição!';
      if (id) {
        msg += nl + nl + 'Visualizar orçamento:' + nl;
        // Usar número curto se disponível, senão usar UUID
        const linkId = numero ? numero : id;
        const paramName = numero ? 'n' : 'id';
        if (salvo.public_token) msg += CONFIG.publicQuoteUrl(salvo.public_token);
      }

      // 3. Permitir revisar o destinatário e a mensagem antes do envio
      this.abrirModalWhatsApp(msg);

    } catch(e) {
      Utils.toast('Erro ao salvar orçamento: ' + e.message);
    } finally {
      if (btnEl) { btnEl.innerHTML = btnHtml; btnEl.disabled = false; }
    }
  },

  // ── PDF ───────────────────────────────────────────────────
  async gerarPDF() {
    if (!window.jspdf) { alert('Aguarde o app carregar completamente e tente novamente.'); return; }
    document.getElementById('configPanel').classList.remove('open');

    // Salva ou atualiza o mesmo registro antes de gerar o PDF.
    const salvo = await this._salvarRegistro({ silent: true });
    if (!salvo) return;

    const d   = this._coletarDados();
    const cfg = this._cfg;
    const nome    = cfg.nome || '1K Beats';
    const hoje    = new Date().toLocaleDateString('pt-BR');
    const valStr  = d.val ? Utils.fmtDate(d.val) : '—';

    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297, ml = 15, mr = 15, cw = 180;

    // Cabeçalho unificado: marca e emitente à esquerda, documento à direita
    doc.setFillColor(20, 20, 28); doc.rect(0, 0, pw, 55, 'F');
    doc.setFillColor(217, 26, 114); doc.rect(0, 54, pw, 1, 'F');
    doc.setFontSize(28); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
    const _w1k = doc.getTextWidth('1K');
    doc.text('1K', ml, 29);
    doc.setFontSize(18); doc.setFont('helvetica', 'normal'); doc.setTextColor(185,185,190);
    const _wBeats = doc.getTextWidth('beats');
    doc.text('beats', ml + _w1k + 2.5, 29);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(217,26,114);
    doc.text('))', ml + _w1k + _wBeats + 4, 28.5);

    const companyX = 53;
    doc.setFontSize(6.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(135,135,142);
    doc.text('EMITIDO POR', companyX, 15);
    doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(255,255,255);
    const companyLines = doc.splitTextToSize(nome, 69).slice(0, 2);
    doc.text(companyLines, companyX, 21, { lineHeightFactor: 1.15 });
    if (cfg.cnpj) {
      doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(125,125,132);
      doc.text('CNPJ ' + cfg.cnpj, companyX, 22 + companyLines.length * 4.1);
    }

    // Documento e datas
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 26, 114);
    doc.text('DOCUMENTO COMERCIAL', pw - mr, 10, { align: 'right' });
    doc.setFontSize(25); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('Orçamento', pw - mr, 25, { align: 'right' });
    // Pegar número do masthead se já foi salvo
    const _nEl = document.getElementById('metaNumero');
    const _numStr = _nEl && _nEl.textContent && _nEl.textContent !== '—' ? _nEl.textContent : null;

    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(140, 140, 140);
    doc.text('Nº', pw - mr - 30, 33); doc.text('EMISSÃO', pw - mr - 30, 41); doc.text('VALIDADE', pw - mr - 30, 49);
    doc.setTextColor(210, 210, 210);
    doc.text(_numStr || 'A gerar', pw - mr, 33, { align: 'right' });
    doc.text(hoje, pw - mr, 41, { align: 'right' }); doc.text(valStr, pw - mr, 49, { align: 'right' });
    if (_numStr) {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 26, 114);
      doc.text(_numStr, pw - mr, 33, { align: 'right' });
    }
    // Faixa da REF
    if (d.ref) {
      doc.setFillColor(17, 17, 24); doc.rect(0, 55, pw, 13, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setTextColor(110, 110, 118); doc.text('REF.', ml, 63);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(220, 220, 224);
      const refLines = doc.splitTextToSize(d.ref, 148).slice(0, 2);
      doc.text(refLines, pw - mr, refLines.length > 1 ? 60.5 : 63, { align: 'right', lineHeightFactor: 1.15 });
    }

    let y = d.ref ? 78 : 68;
    // Dados do cliente
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 150);
    doc.text('CLIENTE', ml, y); doc.text('CNPJ / CPF', ml + cw * 0.42, y); doc.text('EMITIDO POR', pw - mr, y, { align: 'right' });
    y += 5;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(42, 42, 53);
    const clientLines = doc.splitTextToSize(d.cliente || '—', 67).slice(0, 2);
    doc.text(clientLines, ml, y, { lineHeightFactor: 1.15 });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(d.cnpjCli || '—', ml + cw * 0.42, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    const issuerLines = doc.splitTextToSize(nome, 62).slice(0, 2);
    doc.text(issuerLines, pw - mr, y, { align: 'right', lineHeightFactor: 1.15 });
    if (cfg.cnpj) { doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130); doc.text(cfg.cnpj, pw - mr, y + (issuerLines.length * 4.2), { align: 'right' }); }
    if (d.solicitante) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130); doc.text('Solicitante: ' + d.solicitante, ml, y + (clientLines.length * 4.5)); }

    y += 14; doc.setDrawColor(210, 210, 210); doc.setLineWidth(0.3); doc.line(ml, y, pw - mr, y); y += 8;

    // Cabeçalho da tabela
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 150);
    doc.text('DESCRIÇÃO', ml, y); doc.text('QTD.', ml + cw * 0.62, y, { align: 'center' });
    doc.text('VAL. UNITÁRIO', ml + cw * 0.80, y, { align: 'right' }); doc.text('TOTAL', pw - mr, y, { align: 'right' });
    y += 3; doc.setDrawColor(42, 42, 53); doc.setLineWidth(0.5); doc.line(ml, y, pw - mr, y); y += 6;

    // Itens
    doc.setLineWidth(0.2); doc.setDrawColor(220, 220, 220);
    d.itens.forEach((item, i) => {
      if (i % 2 === 1) { doc.setFillColor(249, 249, 250); doc.rect(ml, y - 4, cw, 8, 'F'); }
      doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(42, 42, 53);
      doc.text(item.desc.substring(0, 55), ml, y);
      doc.text(String(item.qty), ml + cw * 0.62, y, { align: 'center' });
      doc.text(Utils.fmt(item.unit), ml + cw * 0.80, y, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.text(Utils.fmt(item.tot), pw - mr, y, { align: 'right' });
      doc.line(ml, y + 3, pw - mr, y + 3); y += 9;
    });

    // Totais
    y += 6;
    const totX = pw - mr - 70;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(120, 120, 120);
    doc.text('Subtotal', totX, y); doc.setTextColor(42, 42, 53); doc.text(Utils.fmt(d.sub), pw - mr, y, { align: 'right' }); y += 6;
    if (d.discReais > 0) {
      const dl = d.tipo === 'pct' ? d.discVal.toFixed(1) + '%' : Utils.fmt(d.discReais);
      doc.setTextColor(180, 60, 60); doc.text('Desconto (' + dl + ')', totX, y); doc.text('- ' + Utils.fmt(d.discReais), pw - mr, y, { align: 'right' }); y += 6;
    }
    doc.setDrawColor(42, 42, 53); doc.setLineWidth(0.5); doc.line(totX, y, pw - mr, y); y += 7;
    doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 42, 53); doc.text('Total', totX, y);
    doc.setTextColor(217, 26, 114); doc.text(Utils.fmt(d.total), pw - mr, y, { align: 'right' }); y += 12;

    // Observações
    if (d.obs) {
      doc.setDrawColor(217, 26, 114); doc.setLineWidth(1); doc.line(ml, y, ml, y + 16); doc.setLineWidth(0.2);
      doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 150); doc.text('OBSERVAÇÕES', ml + 4, y + 4);
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 60, 60);
      doc.text(doc.splitTextToSize(d.obs, cw - 8), ml + 4, y + 10);
    }

    // Rodapé
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.3); doc.line(ml, ph - 18, pw - mr, ph - 18);
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(150, 150, 150);
    const f1 = nome + (cfg.cnpj ? '   |   CNPJ: ' + cfg.cnpj : '') + (cfg.end ? '   |   ' + cfg.end : '');
    const f2 = (cfg.tel || '') + (cfg.email ? (cfg.tel ? '   |   ' : '') + cfg.email : '');
    doc.text(f1, ml, ph - 12);
    if (f2) doc.text(f2, pw - mr, ph - 12, { align: 'right' });

    doc.save((nome || 'Orcamento').replace(/[^a-zA-Z0-9_-]+/g, '-') + '-Orcamento.pdf');
  }
};

// ════════════════════════════════════════════════════════════
// Lista de orçamentos — painel inicial
// ════════════════════════════════════════════════════════════

const ListaOrcamentos = {

  carregar() {
    const container = document.getElementById('listaOrcamentos');
    if (!container) return;
    container.innerHTML = '<div style="color:#AAA;padding:2rem;text-align:center;font-size:13px">Carregando...</div>';

    fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos?select=*&order=created_at.desc&limit=10', {
      headers: CONFIG.headers()
    })
    .then(r => r.json())
    .then(lista => {
      if (!lista || lista.length === 0) {
        container.innerHTML = '<div style="color:#AAA;padding:2rem;text-align:center;font-size:13px">Nenhum orçamento enviado ainda.</div>';
        return;
      }
      container.innerHTML = '';
      lista.forEach((orc, i) => {
        const num = orc.numero ? String(orc.numero).padStart(4, '0') : '—';
        const data = orc.created_at ? Utils.fmtDate(orc.created_at.split('T')[0]) : '—';
        const valor = Utils.fmt(orc.total || 0);
        const ref = orc.referencia || '—';
        const cliente = orc.cliente_nome || '—';
        const statusLabels = { pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado' };
        const statusStyles = {
          pendente:  'background:#FFFBEB;color:#92400E',
          aprovado:  'background:#E8F5E9;color:#2E7D32',
          recusado:  'background:#FFEBEE;color:#C62828',
          cancelado: 'background:#F5F5F5;color:#666'
        };
        const st = orc.status || 'pendente';
        const bg = i % 2 === 0 ? '#fff' : '#FAFAFA';
        const semNumero = !orc.numero;

        const div = document.createElement('div');
        div.style.cssText = `display:grid;grid-template-columns:60px 2fr 100px 140px 120px 40px;gap:0;padding:16px 24px;background:${bg};border-bottom:0.5px solid #EBEBF0;align-items:center`;
        div.innerHTML =
          `<span style="font-size:14px;font-weight:700;color:#D91A72">${num}</span>` +
          `<div style="min-width:0;padding-right:20px">` +
            `<div style="font-size:13px;font-weight:500;color:#1A1A22;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cliente}</div>` +
            (ref !== '—' ? `<div style="font-size:11px;color:#D91A72;font-weight:500;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ref}</div>` : '') +
          `</div>` +
          `<span style="font-size:12px;color:#AAA">${data}</span>` +
          `<span style="font-size:14px;font-weight:500;color:#1A1A22;text-align:right">${valor}</span>` +
          `<div style="text-align:center">` +
            `<select class="orc-status-sel" data-id="${orc.id}" style="border:none;border-radius:20px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;appearance:none;-webkit-appearance:none;${statusStyles[st]}">` +
              Object.entries(statusLabels).map(([v,l]) => `<option value="${v}"${st===v?' selected':''}>${l}</option>`).join('') +
            `</select>` +
          `</div>` +
          `<div style="text-align:center">` +
            (semNumero ? `<button class="orc-del-btn" data-id="${orc.id}" style="background:none;border:none;cursor:pointer;color:#CCC;font-size:16px;padding:0" title="Excluir">✕</button>` : '') +
            (orc.numero ? `<a href="ver.html?t=${orc.public_token}" target="_blank" rel="noopener" style="color:#D91A72;text-decoration:none;font-size:18px;display:flex;align-items:center;justify-content:center" title="Visualizar orçamento">↗</a>` : '') +
          `</div>`;

        // Hover
        div.addEventListener('mouseenter', () => div.style.background = '#FDF0F6');
        div.addEventListener('mouseleave', () => div.style.background = bg);

        // Mudar status
        div.querySelector('.orc-status-sel').addEventListener('change', (e) => {
          e.stopPropagation();
          const sel = e.target;
          const novoStatus = sel.value;
          const st2 = statusStyles[novoStatus] || '';
          sel.style.cssText = `border:none;border-radius:20px;padding:3px 6px;font-size:10px;font-weight:600;cursor:pointer;${st2}`;
          fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos?id=eq.' + e.target.dataset.id, {
            method: 'PATCH', headers: CONFIG.headers(), body: JSON.stringify({ status: novoStatus })
          }).then(() => Utils.toast('Status atualizado!'))
            .catch(() => Utils.toast('Erro ao atualizar status.'));
        });

        // Excluir (só sem número)
        const delBtn = div.querySelector('.orc-del-btn');
        if (delBtn) {
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!confirm('Excluir este orçamento?')) return;
            fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos?id=eq.' + delBtn.dataset.id, {
              method: 'DELETE', headers: CONFIG.headers()
            }).then(() => { Utils.toast('Orçamento excluído.'); this.carregar(); })
              .catch(() => Utils.toast('Erro ao excluir.'));
          });
        }

        container.appendChild(div);
      });
    })
    .catch(() => {
      container.innerHTML = '<div style="color:#AAA;padding:2rem;text-align:center;font-size:13px">Erro ao carregar orçamentos.</div>';
    });
  },

  bindEvents() {
    const btnNovo = document.getElementById('btnNovoOrcamento');
    if (btnNovo) btnNovo.addEventListener('click', () => {
      Orcamentos.novoOrcamento();
      Nav.showPanel('orcamentos');
    });
  }
};

// ════════════════════════════════════════════════════════════
// Dashboard
// ════════════════════════════════════════════════════════════

const Dashboard = {

  carregar() {
    // Saudação e data
    const h = new Date().getHours();
    const saud = h >= 6 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
    const nomeEl = document.getElementById('userNome');
    const nome = nomeEl ? nomeEl.textContent : '';
    const saudEl = document.getElementById('dashSaudacao');
    if (saudEl) saudEl.textContent = saud + (nome ? ', ' + nome : '') + '!';

    const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    const dias = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const agora = new Date();
    const dataEl = document.getElementById('dashData');
    if (dataEl) dataEl.textContent = dias[agora.getDay()] + ', ' + agora.getDate() + ' de ' + meses[agora.getMonth()] + ' de ' + agora.getFullYear();

    const mesLabel = document.getElementById('dashMesLabel');
    if (mesLabel) mesLabel.textContent = meses[agora.getMonth()].charAt(0).toUpperCase() + meses[agora.getMonth()].slice(1) + ' ' + agora.getFullYear();

    // Buscar orçamentos do mês atual
    const inicio = agora.getFullYear() + '-' + String(agora.getMonth()+1).padStart(2,'0') + '-01';
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos?select=*&created_at=gte.' + inicio + 'T00:00:00&order=created_at.desc', {
      headers: CONFIG.headers()
    })
    .then(r => r.json())
    .then(lista => {
      lista = lista || [];

      // KPIs
      const total = lista.length;
      const valorTotal = lista.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      const aprovados = lista.filter(o => o.status === 'aprovado');
      const pendentes = lista.filter(o => o.status === 'pendente');
      const valorAprov = aprovados.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
      const valorPend = pendentes.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('kpiTotal', total);
      set('kpiValor', Utils.fmt(valorTotal));
      set('kpiAprovados', aprovados.length);
      set('kpiAprovadosVal', Utils.fmt(valorAprov));
      set('kpiPendentes', pendentes.length);
      set('kpiPendentesVal', Utils.fmt(valorPend));

      // Taxa de aprovação
      const finalizados = lista.filter(o => o.status === 'aprovado' || o.status === 'recusado').length;
      const taxa = finalizados > 0 ? Math.round(aprovados.length / finalizados * 100) : 0;
      const barra = document.getElementById('dashTaxaBarra');
      if (barra) setTimeout(() => barra.style.width = taxa + '%', 100);
      set('dashTaxaPct', taxa + '% aprovados');
      set('dashTaxaNum', aprovados.length + ' de ' + finalizados);

      // Últimos 3
      const container = document.getElementById('dashUltimos');
      if (!container) return;
      if (lista.length === 0) {
        container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#AAA;font-size:13px">Nenhum orçamento este mês.</div>';
        return;
      }
      const stStyles = { pendente:'background:#FFFBEB;color:#92400E', aprovado:'background:#E8F5E9;color:#2E7D32', recusado:'background:#FFEBEE;color:#C62828', cancelado:'background:#F5F5F5;color:#666' };
      const stLabels = { pendente:'Pendente', aprovado:'Aprovado', recusado:'Recusado', cancelado:'Cancelado' };
      container.innerHTML = lista.slice(0, 4).map((o, i) => {
        const num = o.numero ? String(o.numero).padStart(4,'0') : '—';
        const st = o.status || 'pendente';
        const bg = i % 2 === 0 ? '#fff' : '#FAFAFA';
        return `<div style="display:grid;grid-template-columns:44px 1fr 90px;padding:12px 18px;border-bottom:0.5px solid #F0F0F5;align-items:center;background:${bg}">
          <span style="font-size:13px;font-weight:700;color:#D91A72">${num}</span>
          <div>
            <div style="font-size:12px;font-weight:500;color:#1A1A22;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.cliente_nome || '—'}</div>
            ${o.referencia ? `<div style="font-size:11px;color:#D91A72;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.referencia}</div>` : ''}
          </div>
          <span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:20px;${stStyles[st]||stStyles.pendente};text-align:center">${stLabels[st]||'Pendente'}</span>
        </div>`;
      }).join('');
    })
    .catch(() => {
      const container = document.getElementById('dashUltimos');
      if (container) container.innerHTML = '<div style="padding:1.5rem;text-align:center;color:#AAA;font-size:13px">Erro ao carregar.</div>';
    });
  }
};
