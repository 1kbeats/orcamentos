const Catalogo = {
  _cache: [],
  _editId: null,
  CATEGORIAS: ['Sonorização', 'Iluminação', 'Vídeo', 'Microfone', 'Estrutura', 'Outros'],

  async getAll(callback) {
    try {
      const data = await Api.request(Api.orgFilter('/rest/v1/catalogo?select=*&order=categoria.asc,nome.asc'));
      this._cache = data || [];
      callback(this._cache);
    } catch (error) {
      callback([], error);
    }
  },

  buscar(term, callback) {
    const normalized = String(term || '').toLowerCase();
    const source = this._cache || [];
    callback(source.filter(item =>
      String(item.nome || '').toLowerCase().includes(normalized) ||
      String(item.categoria || '').toLowerCase().includes(normalized)
    ));
  },

  renderLista(category) {
    const container = document.getElementById('listaCatalogo');
    if (!container) return;
    container.innerHTML = '<div class="empty-state">Carregando catálogo...</div>';
    this.getAll((items, error) => {
      if (error) {
        container.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>';
        return;
      }
      const filtered = category ? items.filter(item => item.categoria === category) : items;
      if (!filtered.length) {
        container.innerHTML = '<div class="empty-state">Nenhum item cadastrado.</div>';
        return;
      }
      container.innerHTML = '';
      filtered.forEach(item => {
        const row = document.createElement('div');
        row.className = 'catalog-row';
        row.innerHTML =
          '<span class="catalog-name">' + Utils.escapeHTML(item.nome) + '</span>' +
          '<span class="catalog-category">' + Utils.escapeHTML(item.categoria || 'Outros') + '</span>' +
          '<span class="catalog-price">' + Utils.escapeHTML(Utils.fmt(item.valor)) + '</span>' +
          '<div class="catalog-actions">' +
            '<button class="btn-edit-cat" type="button" title="Editar">✎</button>' +
            '<button class="btn-del-cat" type="button" title="Excluir">✕</button>' +
          '</div>';
        row.querySelector('.btn-edit-cat').addEventListener('click', () => this.abrirEditar(item));
        row.querySelector('.btn-del-cat').addEventListener('click', () => this.excluir(item.id));
        container.appendChild(row);
      });
    });
  },

  abrirNovo() {
    this._editId = null;
    document.getElementById('catNome').value = '';
    document.getElementById('catValor').value = '';
    document.getElementById('catCategoria').value = 'Sonorização';
    document.getElementById('catTitulo').textContent = 'Novo item';
    document.getElementById('modalCatalogo')?.classList.add('open');
    document.getElementById('catNome')?.focus();
  },

  abrirEditar(item) {
    this._editId = item.id;
    document.getElementById('catNome').value = item.nome || '';
    document.getElementById('catValor').value = item.valor || '';
    document.getElementById('catCategoria').value = item.categoria || 'Outros';
    document.getElementById('catTitulo').textContent = 'Editar item';
    document.getElementById('modalCatalogo')?.classList.add('open');
  },

  fecharModal() {
    document.getElementById('modalCatalogo')?.classList.remove('open');
    this._editId = null;
  },

  async salvar() {
    const data = {
      nome: Utils.sanitizeText(document.getElementById('catNome')?.value, 180),
      valor: Math.max(0, Number(document.getElementById('catValor')?.value) || 0),
      categoria: document.getElementById('catCategoria')?.value || 'Outros'
    };
    if (!data.nome || !this.CATEGORIAS.includes(data.categoria)) {
      Utils.toast('Revise os dados do item.', 'erro');
      return;
    }
    try {
      const path = this._editId
        ? Api.orgFilter('/rest/v1/catalogo?id=eq.' + encodeURIComponent(this._editId))
        : '/rest/v1/catalogo';
      await Api.request(path, {
        method: this._editId ? 'PATCH' : 'POST',
        body: JSON.stringify(Api.orgPayload(data))
      });
      this.fecharModal();
      this.renderLista();
      Utils.toast('Item salvo.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao salvar item.'), 'erro');
    }
  },

  async excluir(id) {
    if (!confirm('Excluir este item do catálogo?')) return;
    try {
      await Api.request(Api.orgFilter('/rest/v1/catalogo?id=eq.' + encodeURIComponent(id)), { method: 'DELETE' });
      this.renderLista();
      Utils.toast('Item excluído.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  bindEvents() {
    document.getElementById('btnNovoCatalogo')?.addEventListener('click', () => this.abrirNovo());
    document.getElementById('btnSalvarCatalogo')?.addEventListener('click', () => this.salvar());
    document.getElementById('btnCancelarCatalogo')?.addEventListener('click', () => this.fecharModal());
    document.querySelectorAll('.cat-filtro').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.cat-filtro').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        this.renderLista(button.dataset.cat || '');
      });
    });
  }
};
