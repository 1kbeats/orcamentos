const Agenda = {
  inicio: null,
  dados: [],
  busca: '',
  produtor: '',
  status: 'ativos',
  limite: 10,

  dataISO(data) {
    const d = new Date(data); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  },
  inicioSemana(data = new Date()) {
    const d = new Date(data); d.setHours(12, 0, 0, 0);
    const dia = d.getDay() || 7; d.setDate(d.getDate() - dia + 1); return d;
  },
  fimSemana() { const d = new Date(this.inicio); d.setDate(d.getDate() + 6); return d; },
  escape(v) { return Utils.escapeHTML(v == null || v === '' ? 'A definir' : String(v)); },
  itensTexto(itens) {
    return (Array.isArray(itens) ? itens : []).map(i => {
      const nome = i.descricao || i.desc || i.nome || '';
      const qtd = Number(i.quantidade || i.qty) || 1;
      return nome ? (qtd !== 1 ? qtd + 'x ' : '') + nome : '';
    }).filter(Boolean);
  },

  async carregar() {
    if (!CONFIG.canViewOperations) return;
    if (!this.inicio) this.inicio = this.inicioSemana();
    const de = this.dataISO(this.inicio), ate = this.dataISO(this.fimSemana());
    const root = document.getElementById('agendaContent');
    if (root) root.innerHTML = '<div class="ops-page"><div class="ops-empty">Carregando agenda da semana...</div></div>';
    try {
      const producoes = await Api.request(Api.orgFilter('/rest/v1/producoes?select=*,orcamentos(id,numero,referencia,cliente_nome,itens)&data_evento=gte.' + de + '&data_evento=lte.' + ate + '&order=data_evento.asc,hora_montagem.asc.nullslast')) || [];
      const ids = producoes.map(p => p.id), quoteIds = [...new Set(producoes.map(p => p.orcamento_id).filter(Boolean))];
      const inFilter = values => 'in.(' + values.map(encodeURIComponent).join(',') + ')';
      const [ordens, diarias, movimentos] = await Promise.all([
        ids.length ? Api.request(Api.orgFilter('/rest/v1/ordens_servico?select=*&producao_id=' + inFilter(ids))) : [],
        quoteIds.length ? Api.request(Api.orgFilter('/rest/v1/equipe_diarias?select=*,equipe(nome,funcao)&orcamento_id=' + inFilter(quoteIds))) : [],
        ids.length ? Api.request(Api.orgFilter('/rest/v1/estoque_movimentacoes?select=*,estoque_itens(nome)&producao_id=' + inFilter(ids))) : []
      ]);
      this.dados = producoes.map(p => {
        const os = (ordens || []).find(o => o.producao_id === p.id);
        const equipe = (diarias || []).filter(d => d.orcamento_id === p.orcamento_id).map(d => d.equipe?.nome).filter(Boolean);
        const saldos = (movimentos || []).filter(m => m.producao_id === p.id).reduce((acc, m) => {
          const nome = m.estoque_itens?.nome;
          if (nome) acc[nome] = (acc[nome] || 0) + (m.tipo === 'saida_evento' ? m.quantidade : m.tipo === 'devolucao_evento' ? -m.quantidade : 0);
          return acc;
        }, {});
        const estoque = Object.entries(saldos).filter(([, quantidade]) => quantidade > 0).map(([nome, quantidade]) => (quantidade !== 1 ? quantidade + 'x ' : '') + nome);
        const materiais = this.itensTexto(os?.itens?.length ? os.itens : p.orcamentos?.itens);
        return { ...p, os, equipe: [...new Set(equipe)], materiais: [...new Set([...materiais, ...estoque])] };
      });
      this.render();
    } catch (error) {
      if (root) root.innerHTML = '<div class="ops-page"><div class="ops-empty">Não foi possível carregar a agenda.</div></div>';
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  filtrados() {
    const termo = this.busca.toLocaleLowerCase('pt-BR');
    return this.dados.filter(p => {
      const texto = [p.nome, p.local_evento, p.endereco, p.produtor_responsavel, p.orcamentos?.cliente_nome].join(' ').toLocaleLowerCase('pt-BR');
      const statusOk = this.status === 'todos' || (this.status === 'ativos' ? p.status !== 'cancelado' : p.status === this.status);
      return (!termo || texto.includes(termo)) && (!this.produtor || p.produtor_responsavel === this.produtor) && statusOk;
    });
  },
  statusLabel(v) { return ({ planejamento:'Planejamento', confirmado:'Confirmado', realizado:'Realizado', cancelado:'Cancelado' })[v] || v; },
  async carregarBaseOperacional() {
    Producoes._atual = null;
    await Producoes.carregar();
  },
  async novoEvento() {
    if (!CONFIG.canManageOperations) return Utils.toast('Seu perfil não permite criar eventos.', 'erro');
    await this.carregarBaseOperacional();
    Producoes.modalNova(async () => {
      this.inicio = this.inicioSemana();
      await this.carregar();
    });
  },
  async editarEvento(evento) {
    if (!CONFIG.canManageOperations || !evento) return;
    await this.carregarBaseOperacional();
    const atual = Producoes._data.producoes.find(item => item.id === evento.id) || evento;
    Producoes.modalEditar(atual, async () => this.carregar());
  },
  diaLabel(iso) {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' });
  },
  card(p) {
    const local = p.local_evento || p.endereco || 'Local a definir';
    return '<article class="agenda-event"><div class="agenda-time"><strong>' + this.escape(p.hora_montagem || p.hora_evento || '--:--') + '</strong><span>' + (p.hora_montagem ? 'montagem' : 'início') + '</span></div><div class="agenda-main"><div><span class="ops-tag status-' + Utils.safeId(p.status) + '">' + this.escape(this.statusLabel(p.status)) + '</span><h3>' + this.escape(p.nome) + '</h3></div><p>' + this.escape(p.orcamentos?.cliente_nome) + (p.orcamentos?.numero ? ' · Orçamento #' + this.escape(Utils.fmtNumero(p.orcamentos.numero)) : '') + '</p><span>' + this.escape(local) + '</span></div><div class="agenda-owner"><small>Produtor</small><strong>' + this.escape(p.produtor_responsavel) + '</strong></div><button class="ops-btn secondary" data-agenda-detail="' + Utils.safeId(p.id) + '">Detalhes</button></article>';
  },
  render() {
    const root = document.getElementById('agendaContent'); if (!root) return;
    const itens = this.filtrados(), visiveis = itens.slice(0, this.limite);
    const grupos = visiveis.reduce((acc, p) => { (acc[p.data_evento] ||= []).push(p); return acc; }, {});
    const produtores = [...new Set(this.dados.map(p => p.produtor_responsavel).filter(Boolean))].sort();
    const gruposHtml = Object.entries(grupos).map(([dia, eventos]) => '<section class="agenda-day"><header><h2>' + this.escape(this.diaLabel(dia)) + '</h2><span>' + eventos.length + ' evento(s)</span></header>' + eventos.map(p => this.card(p)).join('') + '</section>').join('');
    const periodo = this.inicio.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}) + ' — ' + this.fimSemana().toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
    root.innerHTML = '<div class="ops-page agenda-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • OPERAÇÃO</div><h1>Agenda de eventos</h1><p>Do orçamento aprovado à execução do evento, tudo em um só lugar.</p></div><div class="agenda-actions">' + (CONFIG.canManageOperations ? '<button class="ops-btn" id="agendaNovoEvento">+ Adicionar evento</button>' : '') + '<button class="ops-btn agenda-share" id="agendaCompartilhar">Compartilhar semana</button></div></div><div class="production-guide"><strong>Fluxo simples:</strong> aprove o orçamento e adicione o evento à agenda. Complete aqui os dados operacionais conforme forem definidos.</div><div class="agenda-week"><button id="agendaAnterior" aria-label="Semana anterior">‹</button><button id="agendaHoje">Hoje</button><strong>' + periodo + '</strong><button id="agendaProxima" aria-label="Próxima semana">›</button></div><div class="ops-filters agenda-filters"><label><span>Buscar evento ou local</span><input id="agendaBusca" type="search" value="' + Utils.escapeHTML(this.busca) + '"></label><label><span>Produtor responsável</span><select id="agendaProdutor"><option value="">Todos</option>' + produtores.map(n => '<option' + (n === this.produtor ? ' selected' : '') + '>' + this.escape(n) + '</option>').join('') + '</select></label><label><span>Status</span><select id="agendaStatus"><option value="ativos"' + (this.status==='ativos'?' selected':'') + '>Ativos</option><option value="planejamento"' + (this.status==='planejamento'?' selected':'') + '>Planejamento</option><option value="confirmado"' + (this.status==='confirmado'?' selected':'') + '>Confirmados</option><option value="realizado"' + (this.status==='realizado'?' selected':'') + '>Realizados</option><option value="cancelado"' + (this.status==='cancelado'?' selected':'') + '>Cancelados</option><option value="todos"' + (this.status==='todos'?' selected':'') + '>Todos</option></select></label></div><div class="ops-results-count">' + itens.length + ' evento(s) nesta semana</div>' + (gruposHtml || '<div class="ops-empty">Nenhum evento encontrado nesta semana.</div>') + (itens.length > visiveis.length ? '<button class="agenda-more" id="agendaMais">Mostrar mais ' + Math.min(10,itens.length-visiveis.length) + '</button>' : '') + '</div>';
    root.querySelector('#agendaAnterior').onclick = () => this.mudarSemana(-7);
    root.querySelector('#agendaProxima').onclick = () => this.mudarSemana(7);
    root.querySelector('#agendaHoje').onclick = () => { this.inicio=this.inicioSemana(); this.limite=10; this.carregar(); };
    root.querySelector('#agendaBusca').oninput = e => { this.busca=e.target.value; clearTimeout(this.timer); this.timer=setTimeout(()=>{this.limite=10;this.render();},250); };
    root.querySelector('#agendaProdutor').onchange = e => { this.produtor=e.target.value;this.limite=10;this.render(); };
    root.querySelector('#agendaStatus').onchange = e => { this.status=e.target.value;this.limite=10;this.render(); };
    root.querySelector('#agendaMais')?.addEventListener('click',()=>{this.limite+=10;this.render();});
    root.querySelector('#agendaCompartilhar').onclick = () => this.compartilhar(itens);
    root.querySelector('#agendaNovoEvento')?.addEventListener('click', () => this.novoEvento());
    root.querySelectorAll('[data-agenda-detail]').forEach(b => b.onclick=()=>this.detalhes(this.dados.find(p=>p.id===b.dataset.agendaDetail)));
  },
  mudarSemana(dias) { this.inicio=new Date(this.inicio);this.inicio.setDate(this.inicio.getDate()+dias);this.limite=10;this.carregar(); },
  detalhes(p) {
    if (!p) return; document.getElementById('opsModal')?.remove();
    const wrap=document.createElement('div');wrap.id='opsModal';wrap.className='ops-modal';
    const lista=(titulo,valores)=>'<section class="agenda-detail-section"><small>'+titulo+'</small><p>'+(valores.length?valores.map(this.escape.bind(this)).join('<br>'):'A definir')+'</p></section>';
    wrap.innerHTML='<div class="ops-modal-box agenda-detail" role="dialog" aria-modal="true"><div class="ops-modal-head"><div><small>EVENTO · ORÇAMENTO '+this.escape(p.orcamentos?.numero ? '#'+Utils.fmtNumero(p.orcamentos.numero) : 'A DEFINIR')+'</small><h2>'+this.escape(p.nome)+'</h2></div><button class="ops-icon" data-close>×</button></div><div class="agenda-detail-grid"><section><small>Data e montagem</small><p>'+this.escape(Utils.fmtDate(p.data_evento))+' · '+this.escape(p.hora_montagem)+'</p></section><section><small>Produtor responsável</small><p>'+this.escape(p.produtor_responsavel)+'</p></section><section class="full"><small>Local</small><p>'+this.escape(p.local_evento)+'<br>'+this.escape(p.endereco)+'</p></section>'+lista('Equipe técnica',p.equipe)+lista('Materiais e serviços',p.materiais)+'<section class="full"><small>Veículo</small><p>'+this.escape(p.veiculo)+'</p></section></div><div class="ops-modal-actions"><button class="ops-btn secondary" data-close>Fechar</button>'+(CONFIG.canManageOperations?'<button class="ops-btn secondary" id="agendaEditarEvento">Editar evento</button>':'')+(p.os?'<button class="ops-btn" id="agendaAbrirOS">Abrir ordem de serviço</button>':'')+'</div></div>';
    document.body.appendChild(wrap);wrap.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>wrap.remove());wrap.onclick=e=>{if(e.target===wrap)wrap.remove();};
    wrap.querySelector('#agendaAbrirOS')?.addEventListener('click',async()=>{wrap.remove();Nav.showPanel('ordemServico');await OrdensServico.carregar();OrdensServico.abrirPreview(OrdensServico._data.ordens.find(o=>o.id===p.os.id)||p.os);});
    wrap.querySelector('#agendaEditarEvento')?.addEventListener('click',()=>{wrap.remove();this.editarEvento(p);});
  },
  mensagem(itens) {
    const linhas=['*AGENDA SEMANAL | 1000 BEATS*','📅 '+this.dataISO(this.inicio).split('-').reverse().join('/')+' a '+this.dataISO(this.fimSemana()).split('-').reverse().join('/'),''];
    itens.forEach(p=>{linhas.push('*'+Utils.fmtDate(p.data_evento)+' · '+(p.hora_montagem||p.hora_evento||'Horário a definir')+'*');linhas.push(p.nome);linhas.push('📍 '+(p.local_evento||p.endereco||'Local a definir'));linhas.push('👤 Produtor: '+(p.produtor_responsavel||'A definir'));linhas.push('🎧 Técnicos: '+(p.equipe.join(', ')||'A definir'));linhas.push('📦 Material: '+(p.materiais.slice(0,8).join(', ')||'A definir'));linhas.push('');});
    return linhas.join('\n').trim();
  },
  compartilhar(itens) {
    if (!itens.length) return Utils.toast('Não há eventos para compartilhar nesta semana.','erro');
    document.getElementById('opsModal')?.remove(); const original=this.mensagem(itens),wrap=document.createElement('div');wrap.id='opsModal';wrap.className='ops-modal';
    wrap.innerHTML='<div class="ops-modal-box agenda-share-box"><div class="ops-modal-head"><div><small>WHATSAPP</small><h2>Compartilhar agenda semanal</h2></div><button class="ops-icon" data-close>×</button></div><div class="agenda-share-body"><label>Prévia da mensagem</label><div><button class="ops-btn secondary" id="agendaRestaurar">Restaurar padrão</button><button class="ops-btn secondary" id="agendaCopiar">Copiar mensagem</button></div><textarea id="agendaMensagem"></textarea><small>Você poderá escolher o grupo depois que o WhatsApp abrir.</small></div><div class="ops-modal-actions"><button class="ops-btn secondary" data-close>Cancelar</button><button class="ops-btn agenda-share" id="agendaAbrirWhats">Abrir WhatsApp</button></div></div>';
    document.body.appendChild(wrap);const area=wrap.querySelector('#agendaMensagem');area.value=original;wrap.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>wrap.remove());wrap.querySelector('#agendaRestaurar').onclick=()=>area.value=original;wrap.querySelector('#agendaCopiar').onclick=async()=>{await navigator.clipboard.writeText(area.value);Utils.toast('Mensagem copiada.');};wrap.querySelector('#agendaAbrirWhats').onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(area.value),'_blank','noopener');
  }
};
