// ════════════════════════════════════════════════════════════
// catalogo.js — Módulo de catálogo de produtos e serviços
// ════════════════════════════════════════════════════════════

const Catalogo = {

  _cache: [],
  _editId: null,

  CATEGORIAS: ['Sonorização', 'Iluminação', 'Vídeo', 'Microfone', 'Estrutura', 'Outros'],

  // Busca todos os itens do Supabase
  getAll(cb) {
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/catalogo?select=*&order=categoria.asc,nome.asc', { headers: CONFIG.headers() })
      .then(r => r.json())
      .then(lista => { this._cache = lista || []; cb(this._cache); })
      .catch(() => cb([]));
  },

  // Busca filtrada por termo (para autocomplete no orçamento)
  buscar(termo, cb) {
    if (this._cache.length > 0) {
      const t = termo.toLowerCase();
      cb(this._cache.filter(i => (i.nome || '').toLowerCase().includes(t)));
      return;
    }
    this.getAll(() => {
      const t = termo.toLowerCase();
      cb(this._cache.filter(i => (i.nome || '').toLowerCase().includes(t)));
    });
  },

  // Renderiza lista no painel
  renderLista(filtroCategoria) {
    const container = document.getElementById('listaCatalogo');
    if (!container) return;
    container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Carregando...</div>';

    this.getAll(lista => {
      const filtrada = filtroCategoria ? lista.filter(i => i.categoria === filtroCategoria) : lista;
      if (filtrada.length === 0) {
        container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Nenhum item cadastrado ainda.</div>';
        return;
      }
      const CORES = {
        'Sonorização': {bg:'#E8F0FE',tc:'#1A56DB'},
        'Iluminação':  {bg:'#FFFBEB',tc:'#92400E'},
        'Vídeo':       {bg:'#F0FDF4',tc:'#166534'},
        'Microfone':   {bg:'#FDF2FA',tc:'#9C27B0'},
        'Estrutura':   {bg:'#F1F5F9',tc:'#334155'},
        'Outros':      {bg:'#F5F5F5',tc:'#666'},
      };
      container.innerHTML = '';
      filtrada.forEach(item => {
        const div = document.createElement('div');
        const cor = CORES[item.categoria] || CORES['Outros'];
        div.style.cssText = 'display:grid;grid-template-columns:1fr 120px 110px 72px;padding:11px 18px;border-bottom:1px solid #F5F5F5;align-items:center';
        div.innerHTML =
          '<span style="font-size:13px;color:#1A1A22">' + (item.nome || '') + '</span>' +
          '<div><span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:4px;background:' + cor.bg + ';color:' + cor.tc + '">' + (item.categoria || '') + '</span></div>' +
          '<span style="font-size:13px;font-weight:500;color:#D91A72;font-family:monospace">' + Utils.fmt(item.valor || 0) + '</span>' +
          '<div style="display:flex;gap:10px;justify-content:flex-end">' +
            '<button class="btn-edit-cat" data-id="' + item.id + '" style="background:none;border:none;cursor:pointer;color:#CCC;font-size:18px;padding:0;line-height:1" title="Editar">✎</button>' +
            '<button class="btn-del-cat" data-id="' + item.id + '" style="background:none;border:none;cursor:pointer;color:#CCC;font-size:18px;padding:0;line-height:1" title="Excluir">✕</button>' +
          '</div>';
        div.querySelector('.btn-edit-cat').addEventListener('click', () => this.abrirEditar(item));
        div.querySelector('.btn-del-cat').addEventListener('click', () => this.excluir(item.id));
        container.appendChild(div);
      });
    });
  },

  // Modal novo item
  abrirNovo() {
    this._editId = null;
    document.getElementById('modalCatTitulo').textContent = 'Novo item';
    document.getElementById('catNome').value = '';
    document.getElementById('catValor').value = '';
    document.getElementById('catCategoria').value = this.CATEGORIAS[0];
    document.getElementById('modalCatalogo').classList.add('open');
    document.getElementById('catNome').focus();
  },

  abrirEditar(item) {
    this._editId = item.id;
    document.getElementById('modalCatTitulo').textContent = 'Editar item';
    document.getElementById('catNome').value = item.nome || '';
    document.getElementById('catValor').value = item.valor || '';
    document.getElementById('catCategoria').value = item.categoria || this.CATEGORIAS[0];
    document.getElementById('modalCatalogo').classList.add('open');
    document.getElementById('catNome').focus();
  },

  fecharModal() {
    document.getElementById('modalCatalogo').classList.remove('open');
  },

  salvar() {
    const nome  = document.getElementById('catNome').value.trim();
    const valor = parseFloat(document.getElementById('catValor').value) || 0;
    const cat   = document.getElementById('catCategoria').value;
    if (!nome) { Utils.toast('Informe o nome do item.'); return; }

    const dados = { nome, valor, categoria: cat };
    const url    = this._editId ? CONFIG.SUPABASE_URL + '/rest/v1/catalogo?id=eq.' + this._editId : CONFIG.SUPABASE_URL + '/rest/v1/catalogo';
    const method = this._editId ? 'PATCH' : 'POST';

    fetch(url, { method, headers: CONFIG.headers(), body: JSON.stringify(dados) })
      .then(() => {
        this._cache = [];
        this.fecharModal();
        this.renderLista();
        Utils.toast(this._editId ? 'Item atualizado!' : 'Item cadastrado!');
      })
      .catch(() => Utils.toast('Erro ao salvar item.'));
  },

  excluir(id) {
    if (!confirm('Excluir este item do catálogo?')) return;
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/catalogo?id=eq.' + id, { method: 'DELETE', headers: CONFIG.headers() })
      .then(() => { this._cache = []; this.renderLista(); Utils.toast('Item excluído.'); })
      .catch(() => Utils.toast('Erro ao excluir item.'));
  },

  bindEvents() {
    const btnNovo = document.getElementById('btnNovoCatalogo');
    if (btnNovo) btnNovo.addEventListener('click', () => this.abrirNovo());

    const btnSalvar = document.getElementById('btnSalvarCatalogo');
    if (btnSalvar) btnSalvar.addEventListener('click', () => this.salvar());

    const btnCancelar = document.getElementById('btnCancelarCatalogo');
    if (btnCancelar) btnCancelar.addEventListener('click', () => this.fecharModal());

    const modal = document.getElementById('modalCatalogo');
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) this.fecharModal(); });

    // Filtros por categoria
    document.querySelectorAll('.cat-filtro').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.cat-filtro').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderLista(btn.dataset.cat || null);
      });
    });
  }
};
