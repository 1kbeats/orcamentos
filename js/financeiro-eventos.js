const FinanceiroEventos = {
  mes: '',
  status: 'todos',
  busca: '',
  _buscaTimer: null,
  selecionadoId: null,
  dados: [],

  mesAtual() {
    const agora = new Date();
    return agora.getFullYear() + '-' + String(agora.getMonth() + 1).padStart(2, '0');
  },

  periodo() {
    const [ano, mes] = (this.mes || this.mesAtual()).split('-').map(Number);
    const ultimo = new Date(ano, mes, 0).getDate();
    return { inicio: `${ano}-${String(mes).padStart(2, '0')}-01`, fim: `${ano}-${String(mes).padStart(2, '0')}-${ultimo}` };
  },

  escape(valor) { return Utils.escapeHTML(valor == null || valor === '' ? '—' : String(valor)); },
  money(valor) { return Utils.fmt(Number(valor) || 0); },
  total(lista, campo = 'valor') { return lista.reduce((soma, item) => soma + (Number(item[campo]) || 0), 0); },
  porOrcamento(lista, id) { return lista.filter(item => item.orcamento_id === id); },
  numeroEvento(item) { return 'E' + String(item.orcamentos?.numero || 0).padStart(4, '0'); },

  async carregar() {
    if (!CONFIG.canViewOperations) return;
    if (!this.mes) this.mes = this.mesAtual();
    const root = document.getElementById('financeiroEventosContent');
    if (root) root.innerHTML = '<div class="ops-page"><div class="ops-empty">Carregando financeiro dos eventos...</div></div>';
    const { inicio, fim } = this.periodo();

    try {
      const producoes = await Api.request(Api.orgFilter('/rest/v1/producoes?select=*,orcamentos(id,numero,referencia,cliente_nome,total,status)&data_evento=gte.' + inicio + '&data_evento=lte.' + fim + '&order=data_evento.desc')) || [];
      const ids = [...new Set(producoes.map(item => item.orcamento_id).filter(Boolean))];
      const filtro = ids.length ? 'in.(' + ids.map(encodeURIComponent).join(',') + ')' : '';
      const [gastos, diarias, fornecedores] = ids.length ? await Promise.all([
        Api.request(Api.orgFilter('/rest/v1/gastos?select=*&orcamento_id=' + filtro + '&order=data.desc')),
        Api.request(Api.orgFilter('/rest/v1/equipe_diarias?select=*,equipe(nome,funcao)&orcamento_id=' + filtro + '&order=data.desc')),
        Api.request(Api.orgFilter('/rest/v1/fornecedor_eventos?select=*,fornecedores(nome,tipo)&orcamento_id=' + filtro + '&order=data.desc'))
      ]) : [[], [], []];

      this.dados = producoes.map(producao => {
        const gastosEvento = this.porOrcamento(gastos || [], producao.orcamento_id);
        const diariasEvento = this.porOrcamento(diarias || [], producao.orcamento_id);
        const fornecedoresEvento = this.porOrcamento(fornecedores || [], producao.orcamento_id);
        const gastosTotal = this.total(gastosEvento);
        const equipeTotal = this.total(diariasEvento, 'valor_diaria');
        const fornecedoresTotal = this.total(fornecedoresEvento);
        const custos = gastosTotal + equipeTotal + fornecedoresTotal;
        const pagos = this.total(gastosEvento.filter(item => item.status_pagamento === 'pago')) +
          this.total(diariasEvento.filter(item => item.status_pagamento === 'pago'), 'valor_diaria') +
          this.total(fornecedoresEvento.filter(item => item.status_pagamento === 'pago'));
        const receita = Number(producao.orcamentos?.total) || 0;
        return { ...producao, gastosEvento, diariasEvento, fornecedoresEvento, gastosTotal, equipeTotal, fornecedoresTotal, custos, pagos, pendente: Math.max(0, custos - pagos), resultado: receita - custos, receita };
      });
      if (!this.dados.some(item => item.id === this.selecionadoId)) this.selecionadoId = this.dados[0]?.id || null;
      this.render();
    } catch (error) {
      if (root) root.innerHTML = '<div class="ops-page"><div class="ops-empty">Não foi possível carregar o financeiro dos eventos.</div></div>';
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  filtrados() {
    const termo = this.busca.trim().toLocaleLowerCase('pt-BR');
    return this.dados.filter(item => {
      const texto = [item.nome, item.produtor_responsavel, item.orcamentos?.cliente_nome, item.orcamentos?.referencia, item.orcamentos?.numero].join(' ').toLocaleLowerCase('pt-BR');
      const statusOk = this.status === 'todos' || (this.status === 'pendente' ? item.pendente > 0 : item.pendente === 0);
      return statusOk && (!termo || texto.includes(termo));
    });
  },

  render() {
    const root = document.getElementById('financeiroEventosContent');
    if (!root) return;
    const lista = this.filtrados();
    if (!lista.some(item => item.id === this.selecionadoId)) this.selecionadoId = lista[0]?.id || null;
    const selecionado = lista.find(item => item.id === this.selecionadoId) || null;
    const receita = lista.reduce((soma, item) => soma + item.receita, 0);
    const custos = lista.reduce((soma, item) => soma + item.custos, 0);
    const pendente = lista.reduce((soma, item) => soma + item.pendente, 0);
    const cards = '<div class="event-finance-summary"><div><span>Verba dos eventos</span><strong>' + this.money(receita) + '</strong><small>' + lista.length + ' evento(s)</small></div><div><span>Custos registrados</span><strong>' + this.money(custos) + '</strong><small>' + this.money(pendente) + ' ainda pendentes</small></div><div><span>Resultado estimado</span><strong class="' + (receita - custos >= 0 ? 'positive' : 'negative') + '">' + this.money(receita - custos) + '</strong><small>Após todos os custos</small></div></div>';
    const linhas = lista.map(item => '<button type="button" class="event-finance-row' + (item.id === this.selecionadoId ? ' selected' : '') + '" data-event-finance="' + Utils.safeId(item.id) + '"><span><strong>' + this.escape(Utils.fmtDate(item.data_evento)) + '</strong><small>' + this.escape(this.numeroEvento(item)) + '</small></span><span class="event-finance-name"><strong>' + this.escape(item.nome) + '</strong><small>Orçamento #' + this.escape(Utils.fmtNumero(item.orcamentos?.numero)) + ' · ' + this.escape(item.orcamentos?.cliente_nome) + '</small></span><span class="event-finance-money">' + this.money(item.receita) + '</span><span class="ops-tag status-' + (item.pendente > 0 ? 'pendente' : 'pago') + '">' + (item.pendente > 0 ? 'Pendente' : 'Fechado') + '</span></button>').join('');

    root.innerHTML = '<div class="ops-page event-finance-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • FINANCEIRO</div><h1>Financeiro de eventos</h1><p>Entradas, custos e pagamentos em um só lugar.</p></div><button type="button" class="ops-btn" id="btnExportarFinanceiro">⇩ Exportar para o Guto</button></div><div class="event-finance-filters"><label><span>Mês</span><input type="month" id="financeiroMes" value="' + this.escape(this.mes) + '"></label><label><span>Buscar evento</span><input type="search" id="financeiroBusca" value="' + this.escape(this.busca) + '" placeholder="Nome, cliente ou produtor"></label><label><span>Situação</span><select id="financeiroStatus"><option value="todos"' + (this.status === 'todos' ? ' selected' : '') + '>Todos</option><option value="pendente"' + (this.status === 'pendente' ? ' selected' : '') + '>Com pagamentos pendentes</option><option value="fechado"' + (this.status === 'fechado' ? ' selected' : '') + '>Fechados</option></select></label></div>' + cards + '<div class="event-finance-layout"><section class="ops-card event-finance-list"><div class="ops-card-title">Eventos do mês <span>' + lista.length + ' resultado(s)</span></div>' + (linhas || '<div class="ops-empty">Nenhum evento encontrado neste período.</div>') + '</section><aside class="ops-card event-finance-detail" id="financeiroEventoDetalhe">' + this.detalheHTML(selecionado) + '</aside></div></div>';

    root.querySelector('#financeiroMes')?.addEventListener('change', event => { this.mes = event.target.value || this.mesAtual(); this.carregar(); });
    root.querySelector('#financeiroBusca')?.addEventListener('input', event => {
      this.busca = event.target.value;
      clearTimeout(this._buscaTimer);
      this._buscaTimer = setTimeout(() => {
        this.render();
        const busca = document.getElementById('financeiroBusca');
        if (busca) { busca.focus(); busca.setSelectionRange(busca.value.length, busca.value.length); }
      }, 250);
    });
    root.querySelector('#financeiroStatus')?.addEventListener('change', event => { this.status = event.target.value; this.render(); });
    root.querySelector('#btnExportarFinanceiro')?.addEventListener('click', () => this.exportar());
    root.querySelectorAll('[data-event-finance]').forEach(button => button.addEventListener('click', () => { this.selecionadoId = button.dataset.eventFinance; this.render(); }));
    root.querySelector('#btnFinanceiroGasto')?.addEventListener('click', () => selecionado && Producoes.modalGasto(selecionado, () => this.carregar()));
    root.querySelector('#btnFinanceiroVerGastos')?.addEventListener('click', () => Nav.showPanel('gastos'));
  },

  detalheHTML(item) {
    if (!item) return '<div class="ops-empty">Selecione um evento para conferir o fechamento.</div>';
    const gastoLinhas = item.gastosEvento.map(reg => this.lancamento(reg.descricao, reg.categoria, reg.valor, reg.status_pagamento)).join('');
    const equipeLinhas = item.diariasEvento.map(reg => this.lancamento(reg.equipe?.nome, reg.funcao_evento || reg.equipe?.funcao || 'Diária', reg.valor_diaria, reg.status_pagamento)).join('');
    const fornecedorLinhas = item.fornecedoresEvento.map(reg => this.lancamento(reg.fornecedores?.nome, reg.descricao_servico || reg.fornecedores?.tipo, reg.valor, reg.status_pagamento)).join('');
    return '<div class="event-finance-detail-head"><div><div class="ops-kicker">' + this.escape(this.numeroEvento(item)) + ' • ORÇAMENTO #' + this.escape(Utils.fmtNumero(item.orcamentos?.numero)) + '</div><h2>' + this.escape(item.nome) + '</h2><p>' + this.escape(item.produtor_responsavel || 'Produtor a definir') + '</p></div></div><div class="event-finance-breakdown"><div><span>Verba contratada</span><strong>' + this.money(item.receita) + '</strong></div><div><span>Gastos e compras</span><strong>− ' + this.money(item.gastosTotal) + '</strong></div><div><span>Equipe e freelancers</span><strong>− ' + this.money(item.equipeTotal) + '</strong></div><div><span>Fornecedores externos</span><strong>− ' + this.money(item.fornecedoresTotal) + '</strong></div><div class="total"><span>Resultado estimado</span><strong class="' + (item.resultado >= 0 ? 'positive' : 'negative') + '">' + this.money(item.resultado) + '</strong></div></div><div class="event-finance-payment ' + (item.pendente > 0 ? 'pending' : 'paid') + '">' + (item.pendente > 0 ? 'Ainda falta pagar: <strong>' + this.money(item.pendente) + '</strong>' : '<strong>Todos os pagamentos foram concluídos.</strong>') + '</div><div class="production-actions">' + (CONFIG.canManageOperations ? '<button type="button" class="ops-btn" id="btnFinanceiroGasto">+ Registrar custo</button>' : '') + '<button type="button" class="ops-btn secondary" id="btnFinanceiroVerGastos">Ver gastos</button></div><details class="event-finance-launches"><summary>Lançamentos deste evento</summary>' + (gastoLinhas + equipeLinhas + fornecedorLinhas || '<div class="ops-empty">Nenhum custo registrado.</div>') + '</details>';
  },

  lancamento(nome, detalhe, valor, status) {
    return '<div class="event-finance-launch"><div><strong>' + this.escape(nome) + '</strong><small>' + this.escape(detalhe) + '</small></div><span><b>' + this.money(valor) + '</b><small class="' + (status === 'pago' ? 'paid-text' : 'pending-text') + '">' + (status === 'pago' ? 'Pago' : 'Pendente') + '</small></span></div>';
  },

  exportar() {
    const lista = this.filtrados();
    if (!lista.length) return Utils.toast('Não há eventos para exportar.');
    const cabecalho = ['Data do evento','Número do evento','Nome do evento','Número do orçamento','Cliente','Produtor responsável','Verba do evento','Gastos e compras','Diárias equipe/freelancers','Fornecedores externos','Total de custos','Total pago','Total pendente','Resultado estimado'];
    const limpar = valor => '"' + String(valor == null ? '' : valor).replace(/"/g, '""') + '"';
    const numero = valor => (Number(valor) || 0).toFixed(2).replace('.', ',');
    const linhas = lista.map(item => [Utils.fmtDate(item.data_evento), this.numeroEvento(item), item.nome, Utils.fmtNumero(item.orcamentos?.numero), item.orcamentos?.cliente_nome, item.produtor_responsavel, numero(item.receita), numero(item.gastosTotal), numero(item.equipeTotal), numero(item.fornecedoresTotal), numero(item.custos), numero(item.pagos), numero(item.pendente), numero(item.resultado)].map(limpar).join(';'));
    const blob = new Blob(['\ufeff' + [cabecalho.map(limpar).join(';'), ...linhas].join('\r\n')], { type:'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'financeiro-eventos-' + this.mes + '.csv';
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(link.href);
    Utils.toast('Relatório financeiro exportado.');
  }
};
