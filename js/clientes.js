// ════════════════════════════════════════════════════════════
// clientes.js — Módulo de clientes
// ════════════════════════════════════════════════════════════

const Clientes = {

  _editId: null,

  // Busca todos os clientes do Supabase
  getAll(cb) {
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/clientes?select=*&order=nome.asc', { headers: CONFIG.headers() })
      .then(r => r.json())
      .then(lista => cb(lista || []))
      .catch(() => cb([]));
  },

  // Renderiza a lista no painel de clientes
  renderLista() {
    const container = document.getElementById('listaClientes');
    if (!container) return;
    container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Carregando...</div>';
    this.getAll(lista => {
      if (lista.length === 0) {
        container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Nenhum cliente cadastrado ainda.</div>';
        return;
      }
      container.innerHTML = '';
      lista.forEach((c, idx) => {
        const div = document.createElement('div');
        div.className = 'card cli-card';
        div.innerHTML =
          '<div class="cli-info">' +
            '<div class="cli-nome">' + (c.nome || '') + '</div>' +
            (c.cnpj ? '<div class="cli-doc">' + c.cnpj + '</div>' : '') +
            (c.tel  ? '<div class="cli-doc">' + c.tel + '</div>' : '') +
            (c.email ? '<div class="cli-doc">' + c.email + '</div>' : '') +
          '</div>' +
          '<div class="cli-actions">' +
            '<button class="btn-edit-cli" data-id="' + c.id + '">Editar</button>' +
            '<button class="btn-del-cli" data-id="' + c.id + '">Excluir</button>' +
          '</div>';
        div.querySelector('.btn-edit-cli').addEventListener('click', () => this.abrirEditar(c));
        div.querySelector('.btn-del-cli').addEventListener('click', () => this.excluir(c.id));
        container.appendChild(div);
      });
    });
  },

  // Abre modal para novo cliente ou edição
  abrirNovo() {
    this._editId = null;
    document.getElementById('modalCliente2Titulo').textContent = 'Novo Cliente';
    ['cliNome','cliCnpj','cliTel','cliEmail','cliEnd'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('modalCliente2').classList.add('open');
    document.getElementById('cliNome').focus();
  },

  abrirEditar(c) {
    this._editId = c.id;
    document.getElementById('modalCliente2Titulo').textContent = 'Editar Cliente';
    document.getElementById('cliNome').value  = c.nome  || '';
    document.getElementById('cliCnpj').value  = c.cnpj  || '';
    document.getElementById('cliTel').value   = c.tel   || '';
    document.getElementById('cliEmail').value = c.email || '';
    document.getElementById('cliEnd').value   = c.endereco || '';
    document.getElementById('modalCliente2').classList.add('open');
    document.getElementById('cliNome').focus();
  },

  fecharModal() {
    document.getElementById('modalCliente2').classList.remove('open');
  },

  salvar(dadosExterno, id, cb) {
    // Permite chamada interna (do módulo orcamentos) ou do próprio módulo
    const dados = dadosExterno || {
      nome:     document.getElementById('cliNome').value.trim(),
      cnpj:     document.getElementById('cliCnpj').value.trim() || null,
      tel:      document.getElementById('cliTel').value.trim() || null,
      email:    document.getElementById('cliEmail').value.trim() || null,
      endereco: document.getElementById('cliEnd').value.trim() || null
    };
    const editId = id || this._editId;
    if (!dados.nome) { Utils.toast('Informe o nome do cliente.'); return; }

    const url    = editId ? CONFIG.SUPABASE_URL + '/rest/v1/clientes?id=eq.' + editId : CONFIG.SUPABASE_URL + '/rest/v1/clientes';
    const method = editId ? 'PATCH' : 'POST';
    fetch(url, { method, headers: CONFIG.headers(), body: JSON.stringify(dados) })
      .then(() => {
        this.fecharModal();
        this.renderLista();
        Utils.toast(editId ? 'Cliente atualizado!' : 'Cliente cadastrado!');
        if (cb) cb();
      })
      .catch(() => Utils.toast('Erro ao salvar cliente.'));
  },

  excluir(id) {
    if (!confirm('Excluir este cliente?')) return;
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/clientes?id=eq.' + id, { method: 'DELETE', headers: CONFIG.headers() })
      .then(() => { this.renderLista(); Utils.toast('Cliente excluído.'); })
      .catch(() => Utils.toast('Erro ao excluir cliente.'));
  },

  // Liga eventos dos botões do painel
  bindEvents() {
    const btnNovo = document.getElementById('btnNovoCliente');
    if (btnNovo) btnNovo.addEventListener('click', () => this.abrirNovo());

    const btnSalvar = document.getElementById('btnSalvarCliente');
    if (btnSalvar) btnSalvar.addEventListener('click', () => this.salvar());

    const btnCancel = document.getElementById('btnCancelarCliente');
    if (btnCancel) btnCancel.addEventListener('click', () => this.fecharModal());

    const modal = document.getElementById('modalCliente2');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) this.fecharModal(); });
  }
};
