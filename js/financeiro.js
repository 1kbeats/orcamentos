// ════════════════════════════════════════════════════════════
// financeiro.js — Módulo financeiro
// ════════════════════════════════════════════════════════════

const Financeiro = {

  _dados: [],

  carregar() {
    const container = document.getElementById('financeiroLista');
    if (container) container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Carregando...</div>';

    fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos?select=*&order=created_at.desc', { headers: CONFIG.headers() })
      .then(r => r.json())
      .then(dados => {
        this._dados = dados || [];
        this.renderKPIs();
        this.renderLista();
      })
      .catch(() => {
        if (container) container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Erro ao carregar dados.</div>';
      });
  },

  renderKPIs() {
    const total   = this._dados.reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const aprov   = this._dados.filter(o => o.status === 'aprovado').reduce((s, o) => s + (parseFloat(o.total) || 0), 0);
    const pendente = this._dados.filter(o => o.status === 'pendente').reduce((s, o) => s + (parseFloat(o.total) || 0), 0);

    const elTotal   = document.getElementById('kpiTotal');
    const elAprov   = document.getElementById('kpiAprovado');
    const elPend    = document.getElementById('kpiPendente');
    const elQtd     = document.getElementById('kpiQtd');

    if (elTotal)   elTotal.textContent   = Utils.fmt(total);
    if (elAprov)   elAprov.textContent   = Utils.fmt(aprov);
    if (elPend)    elPend.textContent    = Utils.fmt(pendente);
    if (elQtd)     elQtd.textContent     = this._dados.length;
  },

  renderLista(filtroStatus) {
    const container = document.getElementById('financeiroLista');
    if (!container) return;

    const lista = filtroStatus ? this._dados.filter(o => o.status === filtroStatus) : this._dados;

    if (lista.length === 0) {
      container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Nenhum orçamento encontrado.</div>';
      return;
    }

    container.innerHTML = '';
    lista.forEach(orc => {
      const div = document.createElement('div');
      div.className = 'card fin-card';
      const statusLabel = { pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado' };
      div.innerHTML =
        '<div class="fin-info">' +
          '<div class="fin-cliente">' + (orc.cliente || '—') + '</div>' +
          '<div class="fin-data">' + Utils.fmtDate((orc.created_at || '').split('T')[0]) + '</div>' +
          (orc.referencia ? '<div class="fin-ref">Ref.: ' + orc.referencia + '</div>' : '') +
        '</div>' +
        '<div class="fin-right">' +
          '<div class="fin-total">' + Utils.fmt(orc.total || 0) + '</div>' +
          '<select class="fin-status status-' + (orc.status || 'pendente') + '" data-id="' + orc.id + '">' +
            Object.entries(statusLabel).map(([v, l]) => '<option value="' + v + '"' + (orc.status === v ? ' selected' : '') + '>' + l + '</option>').join('') +
          '</select>' +
        '</div>';
      div.querySelector('.fin-status').addEventListener('change', (e) => {
        this.atualizarStatus(orc.id, e.target.value, e.target);
      });
      container.appendChild(div);
    });
  },

  atualizarStatus(id, status, selectEl) {
    selectEl.className = 'fin-status status-' + status;
    fetch(CONFIG.SUPABASE_URL + '/rest/v1/orcamentos?id=eq.' + id, {
      method: 'PATCH', headers: CONFIG.headers(), body: JSON.stringify({ status })
    })
    .then(() => {
      const orc = this._dados.find(o => o.id === id);
      if (orc) orc.status = status;
      this.renderKPIs();
      Utils.toast('Status atualizado!');
    })
    .catch(() => Utils.toast('Erro ao atualizar status.'));
  },

  bindEvents() {
    // Filtros por status
    document.querySelectorAll('.fin-filtro').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fin-filtro').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filtro = btn.dataset.status || null;
        this.renderLista(filtro);
      });
    });
  }
};
