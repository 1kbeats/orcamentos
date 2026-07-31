const Clientes = {
  _editId: null,

  async getAll(callback) {
    try {
      const data = await Api.request(Api.orgFilter('/rest/v1/clientes?select=*&order=nome.asc'));
      callback(data || []);
    } catch (error) {
      callback([], error);
    }
  },

  renderLista() {
    const container = document.getElementById('listaClientes');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Carregando clientes...</div>';
    this.getAll((clients, error) => {
      if (error) {
        container.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>';
        return;
      }
      if (!clients.length) {
        container.innerHTML = '<div class="empty-state">Nenhum cliente cadastrado.</div>';
        return;
      }
      container.innerHTML = '';
      clients.forEach(client => {
        const card = document.createElement('div');
        card.className = 'card cli-card';
        card.innerHTML =
          '<div class="cli-info">' +
            '<div class="cli-nome">' + Utils.escapeHTML(client.nome || '') + '</div>' +
            (client.cnpj ? '<div class="cli-doc">' + Utils.escapeHTML(client.cnpj) + '</div>' : '') +
            (client.tel ? '<div class="cli-doc">' + Utils.escapeHTML(client.tel) + '</div>' : '') +
            (client.email ? '<div class="cli-doc">' + Utils.escapeHTML(client.email) + '</div>' : '') +
          '</div>' +
          '<div class="cli-actions">' +
            '<button class="btn-edit-cli" type="button">Editar</button>' +
            '<button class="btn-del-cli" type="button">Excluir</button>' +
          '</div>';
        card.querySelector('.btn-edit-cli').addEventListener('click', () => this.abrirEditar(client));
        card.querySelector('.btn-del-cli').addEventListener('click', () => this.excluir(client.id));
        container.appendChild(card);
      });
    });
  },

  abrirNovo() {
    this._editId = null;
    const title = document.getElementById('modalCliente2Titulo');
    if (title) title.textContent = 'Novo cliente';
    ['cliNome', 'cliCnpj', 'cliTel', 'cliEmail', 'cliEnd'].forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });
    document.getElementById('modalCliente2')?.classList.add('open');
    document.getElementById('cliNome')?.focus();
  },

  abrirEditar(client) {
    this._editId = client.id;
    const title = document.getElementById('modalCliente2Titulo');
    if (title) title.textContent = 'Editar cliente';
    const values = {
      cliNome: client.nome,
      cliCnpj: client.cnpj,
      cliTel: client.tel,
      cliEmail: client.email,
      cliEnd: client.endereco
    };
    Object.entries(values).forEach(([id, value]) => {
      const input = document.getElementById(id);
      if (input) input.value = value || '';
    });
    document.getElementById('modalCliente2')?.classList.add('open');
  },

  fecharModal() {
    document.getElementById('modalCliente2')?.classList.remove('open');
    this._editId = null;
  },

  async salvar(externalData, id, callback) {
    const data = externalData || {
      nome: Utils.sanitizeText(document.getElementById('cliNome')?.value, 150),
      cnpj: Utils.sanitizeText(document.getElementById('cliCnpj')?.value, 20),
      tel: Utils.sanitizeText(document.getElementById('cliTel')?.value, 30),
      email: Utils.sanitizeText(document.getElementById('cliEmail')?.value, 150),
      endereco: Utils.sanitizeText(document.getElementById('cliEnd')?.value, 250)
    };
    const editId = id || this._editId;
    if (!data.nome) {
      Utils.toast('Informe o nome do cliente.', 'erro');
      return;
    }
    try {
      const path = editId
        ? Api.orgFilter('/rest/v1/clientes?id=eq.' + encodeURIComponent(editId))
        : '/rest/v1/clientes';
      await Api.request(path, {
        method: editId ? 'PATCH' : 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify(Api.orgPayload(data))
      });
      if (!externalData) {
        this.fecharModal();
        this.renderLista();
      }
      Utils.toast(editId ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      if (callback) callback();
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao salvar cliente.'), 'erro');
    }
  },

  async excluir(id) {
    if (!confirm('Excluir este cliente? Essa ação não poderá ser desfeita.')) return;
    try {
      await Api.request(Api.orgFilter('/rest/v1/clientes?id=eq.' + encodeURIComponent(id)), { method: 'DELETE' });
      this.renderLista();
      Utils.toast('Cliente excluído.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao excluir cliente.'), 'erro');
    }
  },

  exportar() {
    this.getAll(clients => Utils.downloadCSV('clientes.csv', clients.map(client => ({
      Nome: client.nome,
      Documento: client.cnpj,
      Telefone: client.tel,
      Email: client.email,
      Endereço: client.endereco
    }))));
  },

  bindEvents() {
    document.getElementById('btnNovoCliente')?.addEventListener('click', () => this.abrirNovo());
    document.getElementById('btnSalvarCliente')?.addEventListener('click', () => this.salvar());
    document.getElementById('btnCancelarCliente')?.addEventListener('click', () => this.fecharModal());
    document.getElementById('btnExportarClientes')?.addEventListener('click', () => this.exportar());
  }
};
