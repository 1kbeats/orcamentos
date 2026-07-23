// ════════════════════════════════════════════════════════════
// orcamentos.js — Módulo de orçamentos
// ════════════════════════════════════════════════════════════

const Orcamentos = {

  _cnt: 0,
  _cfg: {},
  _dropCache: [],

  // ── Inicialização ─────────────────────────────────────────
  init() {
    this.loadCfg();
    this.bindEvents();
    this.addItem();
    this.updateMeta();
  },

  bindEvents() {
    document.getElementById('btnAdd').addEventListener('click', () => this.addItem());
    document.getElementById('desconto').addEventListener('input', () => this.calcTotals());
    document.getElementById('descontoTipo').addEventListener('change', () => this.calcTotals());
    document.getElementById('validade').addEventListener('change', () => this.updateMeta());
    document.getElementById('refEvento').addEventListener('input', () => this.updateMeta());
    document.getElementById('cnpjCliente').addEventListener('input', function() {
      this.value = Utils.mascararDoc(this.value);
    });
    document.getElementById('btnConfig').addEventListener('click', () => {
      document.getElementById('configPanel').classList.toggle('open');
    });
    document.getElementById('btnSaveConfig').addEventListener('click', () => this.salvarConfig());
    document.getElementById('btnWpp').addEventListener('click', () => this.gerarWhatsApp());
    document.getElementById('btnPdf').addEventListener('click', () => this.gerarPDF());

    // Dropdown de clientes
    const clienteInput = document.getElementById('nomeCliente');
    clienteInput.addEventListener('input', () => { this._dropCache = []; this.renderDropdown(clienteInput.value); });
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
  },

  // ── Itens do orçamento ────────────────────────────────────
  addItem() {
    this._cnt++;
    const id = this._cnt;
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.id = id;
    div.innerHTML =
      '<input type="text" placeholder="Descrição do produto ou serviço">' +
      '<input type="number" class="c" value="1" min="1">' +
      '<input type="number" class="r" placeholder="0,00" min="0" step="0.01">' +
      '<span class="itv empty" id="itv-' + id + '">—</span>' +
      '<button class="btn-remove no-print" title="Remover">×</button>';
    document.getElementById('itemsContainer').appendChild(div);
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', () => this.calcTotals()));
    div.querySelector('.btn-remove').addEventListener('click', () => { div.remove(); this.calcTotals(); });
    div.querySelector('input').focus();
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

  // ── WhatsApp ──────────────────────────────────────────────
  async gerarWhatsApp() {
    const d = this._coletarDados();
    const cfg = this._cfg;
    const nome = cfg.nome || '1K Beats';
    const nl = '\n';
    let msg = Utils.saudacao() + ',' + nl + nl;
    msg += 'Segue o orçamento da *' + nome + '*';
    if (d.ref) msg += ' referente a:' + nl + 'Ref.: *' + d.ref + '*' + nl;
    else msg += '.' + nl;
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

    const btnEl = document.getElementById('btnWpp');
    if (btnEl) { btnEl.textContent = 'Salvando...'; btnEl.disabled = true; }

    try {
      const dadosOrc = {
        cliente: d.cliente, cnpj_cli: d.cnpjCli || null,
        referencia: d.ref || null, valido_ate: d.val || null,
        desconto: d.discVal, tipo_desc: d.tipo,
        itens: d.itens, obs: d.obs || null,
        empresa: cfg.nome || '', cnpj_emp: cfg.cnpj || '',
        tel_emp: cfg.tel || '', email_emp: cfg.email || '',
        solicitante: d.solicitante || null
      };
      const res = await fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos', {
        method: 'POST', headers: CONFIG.headers(), body: JSON.stringify(dadosOrc)
      });
      const rows = await res.json();
      const id = rows[0] && rows[0].id;
      if (id) {
        const linkOrc = 'https://1kbeats.github.io/orcamentos/ver.html?id=' + id;
        msg += nl + nl + '🔗 *Visualizar orçamento:*' + nl + linkOrc;
      }
      const telN = (cfg.tel || '').replace(/[^0-9]/g, '');
      const wUrl = telN ? 'https://wa.me/55' + telN + '?text=' + encodeURIComponent(msg) : 'https://wa.me/?text=' + encodeURIComponent(msg);
      window.open(wUrl, '_blank');
    } catch(e) {
      Utils.toast('Erro ao salvar orçamento: ' + e.message);
    } finally {
      if (btnEl) { btnEl.textContent = 'WhatsApp'; btnEl.disabled = false; }
    }
  },

  // ── PDF ───────────────────────────────────────────────────
  gerarPDF() {
    if (!window.jspdf) { alert('Aguarde o app carregar completamente e tente novamente.'); return; }
    document.getElementById('configPanel').classList.remove('open');
    const d   = this._coletarDados();
    const cfg = this._cfg;
    const nome    = cfg.nome || '1K Beats';
    const hoje    = new Date().toLocaleDateString('pt-BR');
    const valStr  = d.val ? Utils.fmtDate(d.val) : '—';

    const doc = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = 210, ph = 297, ml = 15, mr = 15, cw = 180;

    // Cabeçalho
    doc.setFillColor(42, 42, 53); doc.rect(0, 0, pw, 52, 'F');

    // Logo 1K Beats — bloco rosa + texto vetorial
    doc.setFillColor(217, 26, 114); doc.roundedRect(ml, 8, 20, 20, 3, 3, 'F');
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('1K', ml + 10, 22, { align: 'center' });
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('beats', ml + 24, 22);

    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(217, 26, 114);
    doc.text('DOCUMENTO COMERCIAL', pw - mr, 15, { align: 'right' });
    doc.setFontSize(24); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255);
    doc.text('Orçamento', pw - mr, 28, { align: 'right' });
    doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(160, 160, 160);
    doc.text('EMISSÃO', pw - mr - 30, 37); doc.text('VALIDADE', pw - mr - 30, 43);
    doc.setTextColor(210, 210, 210); doc.text(hoje, pw - mr, 37, { align: 'right' }); doc.text(valStr, pw - mr, 43, { align: 'right' });
    if (d.ref) {
      doc.setTextColor(150, 150, 150); doc.text('REF.', ml, 49);
      doc.setTextColor(210, 210, 210); doc.text(d.ref.substring(0, 60), pw - mr, 49, { align: 'right' });
    }

    let y = 64;
    // Dados do cliente
    doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(150, 150, 150);
    doc.text('CLIENTE', ml, y); doc.text('CNPJ / CPF', ml + cw * 0.42, y); doc.text('EMITIDO POR', pw - mr, y, { align: 'right' });
    y += 5;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(42, 42, 53);
    doc.text(d.cliente.substring(0, 35), ml, y);
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(d.cnpjCli || '—', ml + cw * 0.42, y);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text(nome.substring(0, 30), pw - mr, y, { align: 'right' });
    if (cfg.cnpj) { doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130); doc.text(cfg.cnpj, pw - mr, y + 5, { align: 'right' }); }
    if (d.solicitante) { doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(130, 130, 130); doc.text('Solicitante: ' + d.solicitante, ml, y + 5); }

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

    doc.save('1K Beats - Orcamento.pdf');
  }
};
