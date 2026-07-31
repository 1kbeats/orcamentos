const Financeiro = {
  _dados: [],

  async carregar() {
    const container = document.getElementById('financeiroLista');
    if (container) container.innerHTML = '<div class="empty-state">Carregando financeiro...</div>';
    try {
      this._dados = await Api.request(
        Api.orgFilter('/rest/v1/orcamentos?select=id,numero,cliente_nome,referencia,total,status,created_at&order=created_at.desc')
      ) || [];
      this.renderKPIs();
      this.renderLista();
    } catch (error) {
      if (container) container.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>';
    }
  },

  renderKPIs() {
    const total = this._dados.reduce((sum, quote) => sum + (Number(quote.total) || 0), 0);
    const approved = this._dados.filter(quote => quote.status === 'aprovado')
      .reduce((sum, quote) => sum + (Number(quote.total) || 0), 0);
    const pending = this._dados.filter(quote => quote.status === 'pendente')
      .reduce((sum, quote) => sum + (Number(quote.total) || 0), 0);
    const values = {
      kpiTotal: Utils.fmt(total),
      kpiAprovado: Utils.fmt(approved),
      kpiPendente: Utils.fmt(pending),
      kpiQtd: this._dados.length
    };
    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  },

  renderLista(statusFilter) {
    const container = document.getElementById('financeiroLista');
    if (!container) return;
    const quotes = statusFilter ? this._dados.filter(quote => quote.status === statusFilter) : this._dados;
    if (!quotes.length) {
      container.innerHTML = '<div class="empty-state">Nenhum orçamento encontrado.</div>';
      return;
    }
    const statusLabels = { pendente: 'Pendente', aprovado: 'Aprovado', recusado: 'Recusado', cancelado: 'Cancelado' };
    container.innerHTML = '';
    quotes.forEach(quote => {
      const card = document.createElement('div');
      card.className = 'card fin-card';
      const safeStatus = Object.hasOwn(statusLabels, quote.status) ? quote.status : 'pendente';
      card.innerHTML =
        '<div class="fin-info">' +
          '<div class="fin-cliente">' + Utils.escapeHTML(quote.cliente_nome || '—') + '</div>' +
          '<div class="fin-data">#' + Utils.escapeHTML(Utils.fmtNumero(quote.numero)) + ' · ' +
            Utils.escapeHTML(Utils.fmtDate(quote.created_at)) + '</div>' +
          (quote.referencia ? '<div class="fin-ref">Ref.: ' + Utils.escapeHTML(quote.referencia) + '</div>' : '') +
        '</div>' +
        '<div class="fin-right">' +
          '<div class="fin-total">' + Utils.escapeHTML(Utils.fmt(quote.total)) + '</div>' +
          '<select class="fin-status status-' + safeStatus + '">' +
            Object.entries(statusLabels).map(([value, label]) =>
              '<option value="' + value + '"' + (safeStatus === value ? ' selected' : '') + '>' + label + '</option>'
            ).join('') +
          '</select>' +
        '</div>';
      card.querySelector('.fin-status').addEventListener('change', event => {
        this.atualizarStatus(quote.id, event.target.value, event.target);
      });
      container.appendChild(card);
    });
  },

  async atualizarStatus(id, status, selectElement) {
    const allowed = ['pendente', 'aprovado', 'recusado', 'cancelado'];
    if (!allowed.includes(status)) return;
    const previous = this._dados.find(quote => quote.id === id)?.status || 'pendente';
    selectElement.className = 'fin-status status-' + status;
    try {
      await Api.request(Api.orgFilter('/rest/v1/orcamentos?id=eq.' + encodeURIComponent(id)), {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      const quote = this._dados.find(item => item.id === id);
      if (quote) quote.status = status;
      this.renderKPIs();
      Utils.toast('Status atualizado.');
    } catch (error) {
      selectElement.value = previous;
      selectElement.className = 'fin-status status-' + previous;
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  exportar() {
    Utils.downloadCSV('financeiro-orcamentos.csv', this._dados.map(quote => ({
      Número: quote.numero,
      Cliente: quote.cliente_nome,
      Referência: quote.referencia,
      Total: Number(quote.total || 0).toFixed(2),
      Status: quote.status,
      Data: Utils.fmtDate(quote.created_at)
    })));
  },

  bindEvents() {
    document.querySelectorAll('.fin-filtro').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.fin-filtro').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        this.renderLista(button.dataset.status || null);
      });
    });
    document.getElementById('btnExportarFinanceiro')?.addEventListener('click', () => this.exportar());
  }
};
