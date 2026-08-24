const FinanceiroEventos = {
  mes: '', status: 'todos', busca: '', pagina: 1, porPagina: 10,
  selecionadoId: null, dados: [], _buscaTimer: null, formatoExportacao: 'xlsx',

  mesAtual() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); },
  periodo() { const [a,m] = (this.mes || this.mesAtual()).split('-').map(Number); return { inicio:`${a}-${String(m).padStart(2,'0')}-01`, fim:`${a}-${String(m).padStart(2,'0')}-${new Date(a,m,0).getDate()}` }; },
  nomeMes() { const [a,m] = this.mes.split('-').map(Number); const s = new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(new Date(a,m-1,1)); return s[0].toUpperCase()+s.slice(1); },
  escape(v) { return Utils.escapeHTML(v == null || v === '' ? '—' : String(v)); },
  money(v) { return Utils.fmt(Number(v)||0); },
  total(a,c='valor') { return a.reduce((s,i)=>s+(Number(i[c])||0),0); },
  numeroEvento(i) { return 'E'+String(i.orcamentos?.numero||0).padStart(4,'0'); },
  hoje() { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); },
  situacaoPagamento(i) {
    if (!i.data_evento || i.data_evento>=this.hoje()) return {codigo:'planejado',rotulo:'Planejado',aPagar:0};
    if (i.pendente>0) return {codigo:'a_pagar',rotulo:'A pagar',aPagar:i.pendente};
    return {codigo:'pago',rotulo:'Tudo pago',aPagar:0};
  },

  async carregar() {
    if (!CONFIG.canViewOperations) return;
    if (!this.mes) this.mes=this.mesAtual();
    const root=document.getElementById('financeiroEventosContent');
    if(root) root.innerHTML='<div class="ops-page"><div class="ops-empty">Carregando financeiro dos eventos...</div></div>';
    const {inicio,fim}=this.periodo();
    try {
      const producoes=await Api.request(Api.orgFilter('/rest/v1/producoes?select=*,orcamentos(id,numero,referencia,cliente_nome,total,status)&data_evento=gte.'+inicio+'&data_evento=lte.'+fim+'&order=data_evento.desc'))||[];
      const ids=[...new Set(producoes.map(i=>i.orcamento_id).filter(Boolean))];
      const filtro=ids.length?'in.('+ids.map(encodeURIComponent).join(',')+')':'';
      const [gastos,diarias,fornecedores]=ids.length?await Promise.all([
        Api.request(Api.orgFilter('/rest/v1/gastos?select=*&orcamento_id='+filtro+'&order=data.desc')),
        Api.request(Api.orgFilter('/rest/v1/equipe_diarias?select=*,equipe(nome,funcao)&orcamento_id='+filtro+'&order=data.desc')),
        Api.request(Api.orgFilter('/rest/v1/fornecedor_eventos?select=*,fornecedores(nome,tipo)&orcamento_id='+filtro+'&order=data.desc'))
      ]):[[],[],[]];
      this.dados=producoes.map(p=>{
        const ge=(gastos||[]).filter(x=>x.orcamento_id===p.orcamento_id), de=(diarias||[]).filter(x=>x.orcamento_id===p.orcamento_id), fe=(fornecedores||[]).filter(x=>x.orcamento_id===p.orcamento_id);
        const gastosTotal=this.total(ge), equipeTotal=this.total(de,'valor_diaria'), fornecedoresTotal=this.total(fe), custos=gastosTotal+equipeTotal+fornecedoresTotal;
        const pagos=this.total(ge.filter(x=>x.status_pagamento==='pago'))+this.total(de.filter(x=>x.status_pagamento==='pago'),'valor_diaria')+this.total(fe.filter(x=>x.status_pagamento==='pago'));
        const receita=Number(p.orcamentos?.total)||0;
        const item={...p,gastosEvento:ge,diariasEvento:de,fornecedoresEvento:fe,gastosTotal,equipeTotal,fornecedoresTotal,custos,pagos,pendente:Math.max(0,custos-pagos),resultado:receita-custos,receita};
        return {...item,situacaoFinanceira:this.situacaoPagamento(item)};
      });
      this.pagina=1; this.selecionadoId=null; this.render();
    } catch(e) { if(root) root.innerHTML='<div class="ops-page"><div class="ops-empty">Não foi possível carregar o financeiro dos eventos.</div></div>'; Utils.toast(Api.friendlyError(e),'erro'); }
  },

  filtrados(status=this.status) {
    const t=this.busca.trim().toLocaleLowerCase('pt-BR');
    return this.dados.filter(i=>{ const texto=[i.nome,i.produtor_responsavel,i.orcamentos?.cliente_nome,i.orcamentos?.referencia,i.orcamentos?.numero].join(' ').toLocaleLowerCase('pt-BR'); const ok=status==='todos'||i.situacaoFinanceira?.codigo===status; return ok&&(!t||texto.includes(t)); });
  },

  render() {
    const root=document.getElementById('financeiroEventosContent'); if(!root)return;
    const lista=this.filtrados(), paginas=Math.max(1,Math.ceil(lista.length/this.porPagina)); this.pagina=Math.min(Math.max(1,this.pagina),paginas);
    const ini=(this.pagina-1)*this.porPagina, itens=lista.slice(ini,ini+this.porPagina), selecionado=lista.find(i=>i.id===this.selecionadoId);
    const receita=this.total(lista,'receita'), custos=this.total(lista,'custos'), aPagar=lista.reduce((s,i)=>s+(i.situacaoFinanceira?.aPagar||0),0), resultado=receita-custos;
    const cards=[['Verba dos eventos',receita,lista.length+' evento(s) no período'],['Custos previstos',custos,'Compras, equipe e fornecedores'],['A pagar',aPagar,'Somente eventos já realizados'],['Resultado estimado',resultado,'Verba menos todos os custos']].map((x,n)=>'<div><span>'+x[0]+'</span><strong class="'+(n===3?(x[1]>=0?'positive':'negative'):'')+'">'+this.money(x[1])+'</strong><small>'+x[2]+'</small></div>').join('');
    const rows=itens.map(i=>'<tr><td>'+this.escape(Utils.fmtDate(i.data_evento))+'</td><td class="event-finance-event"><strong>'+this.escape(i.nome)+'</strong><small>'+this.escape(this.numeroEvento(i))+' · '+this.escape(i.orcamentos?.cliente_nome)+'</small></td><td class="number">'+this.money(i.receita)+'</td><td class="number">'+this.money(i.custos)+'</td><td class="number">'+this.money(i.pagos)+'</td><td class="number">'+this.money(i.pendente)+'</td><td class="number '+(i.resultado>=0?'positive':'negative')+'">'+this.money(i.resultado)+'</td><td><span class="ops-tag status-'+i.situacaoFinanceira.codigo+'">'+i.situacaoFinanceira.rotulo+'</span></td><td><button class="event-finance-detail-button" data-event-finance="'+Utils.safeId(i.id)+'">Detalhes</button></td></tr>').join('');
    root.innerHTML='<div class="ops-page event-finance-page"><div class="ops-head"><div><div class="ops-kicker">1000 BEATS • GESTÃO</div><h1>Financeiro e relatórios</h1><p>Entradas, custos, pagamentos e resultado dos eventos.</p></div><button class="ops-btn" id="btnExportarFinanceiro">⇩ Exportar relatório</button></div><div class="event-finance-filters"><label><span>Período</span><input type="month" id="financeiroMes" value="'+this.mes+'"></label><label><span>Buscar evento ou cliente</span><input type="search" id="financeiroBusca" value="'+Utils.escapeHTML(this.busca)+'" placeholder="Nome, cliente ou produtor"></label><label><span>Situação dos pagamentos</span><select id="financeiroStatus"><option value="todos"'+(this.status==='todos'?' selected':'')+'>Todos</option><option value="planejado"'+(this.status==='planejado'?' selected':'')+'>Planejados</option><option value="a_pagar"'+(this.status==='a_pagar'?' selected':'')+'>A pagar</option><option value="pago"'+(this.status==='pago'?' selected':'')+'>Tudo pago</option></select></label><button class="event-finance-clear" id="btnLimparFinanceiro">Limpar filtros</button></div><div class="event-finance-summary">'+cards+'</div><section class="ops-card event-finance-table-card"><div class="ops-card-title">Eventos do período <span>'+lista.length+' resultado(s)</span></div><div class="event-finance-table-wrap"><table class="event-finance-table"><thead><tr><th>Data</th><th>Evento / cliente</th><th class="number">Verba</th><th class="number">Custos</th><th class="number">Pago</th><th class="number">Não pago</th><th class="number">Resultado</th><th>Pagamentos</th><th></th></tr></thead><tbody>'+(rows||'<tr><td colspan="9"><div class="ops-empty">Nenhum evento encontrado neste período.</div></td></tr>')+'</tbody></table></div><div class="event-finance-pagination"><span>Mostrando '+(lista.length?ini+1:0)+'–'+Math.min(ini+this.porPagina,lista.length)+' de '+lista.length+' · máximo de 10 por página</span><div><button data-page="'+(this.pagina-1)+'" '+(this.pagina<=1?'disabled':'')+'>‹</button><strong>'+this.pagina+' de '+paginas+'</strong><button data-page="'+(this.pagina+1)+'" '+(this.pagina>=paginas?'disabled':'')+'>›</button></div></div></section>'+(selecionado?'<section class="ops-card event-finance-detail" id="financeiroEventoDetalhe">'+this.detalheHTML(selecionado)+'</section>':'')+this.modalHTML()+'</div>';
    root.querySelector('#financeiroMes')?.addEventListener('change',e=>{this.mes=e.target.value||this.mesAtual();this.carregar();});
    root.querySelector('#financeiroBusca')?.addEventListener('input',e=>{this.busca=e.target.value;clearTimeout(this._buscaTimer);this._buscaTimer=setTimeout(()=>{this.pagina=1;this.render();const b=document.getElementById('financeiroBusca');if(b){b.focus();b.setSelectionRange(b.value.length,b.value.length);}},250);});
    root.querySelector('#financeiroStatus')?.addEventListener('change',e=>{this.status=e.target.value;this.pagina=1;this.selecionadoId=null;this.render();});
    root.querySelector('#btnLimparFinanceiro')?.addEventListener('click',()=>{this.busca='';this.status='todos';this.pagina=1;this.selecionadoId=null;this.render();});
    root.querySelector('#btnExportarFinanceiro')?.addEventListener('click',()=>this.abrirExportacao());
    root.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{this.pagina=Number(b.dataset.page)||1;this.selecionadoId=null;this.render();}));
    root.querySelectorAll('[data-event-finance]').forEach(b=>b.addEventListener('click',()=>{this.selecionadoId=b.dataset.eventFinance===this.selecionadoId?null:b.dataset.eventFinance;this.render();}));
    root.querySelector('#btnFinanceiroVerGastos')?.addEventListener('click',()=>Nav.showPanel('gastos'));
    this.bindModal(root);
  },

  detalheHTML(i) {
    const lanc=[...i.gastosEvento.map(x=>this.lancamento(x.descricao,x.categoria,x.valor,x.status_pagamento)),...i.diariasEvento.map(x=>this.lancamento(x.equipe?.nome,x.funcao_evento||x.equipe?.funcao||'Diária',x.valor_diaria,x.status_pagamento)),...i.fornecedoresEvento.map(x=>this.lancamento(x.fornecedores?.nome,x.descricao_servico||x.fornecedores?.tipo,x.valor,x.status_pagamento))].join('');
    const s=i.situacaoFinanceira;
    const aviso=s.codigo==='planejado'?'Custos previstos: <strong>'+this.money(i.pendente)+'</strong>. Eles só entrarão em “A pagar” depois do evento.':(s.codigo==='a_pagar'?'A pagar após o evento: <strong>'+this.money(i.pendente)+'</strong>':'<strong>Todos os pagamentos foram concluídos.</strong>');
    return '<div class="event-finance-detail-head"><div><div class="ops-kicker">'+this.numeroEvento(i)+' • ORÇAMENTO #'+Utils.fmtNumero(i.orcamentos?.numero)+'</div><h2>'+this.escape(i.nome)+'</h2><p>'+this.escape(i.produtor_responsavel||'Produtor a definir')+'</p></div><button class="event-finance-detail-button" data-event-finance="'+i.id+'">Fechar detalhes</button></div><div class="event-finance-detail-grid"><div class="event-finance-breakdown"><div><span>Verba contratada</span><strong>'+this.money(i.receita)+'</strong></div><div><span>Despesas vinculadas</span><strong>− '+this.money(i.gastosTotal)+'</strong></div><div><span>Equipe e freelancers</span><strong>− '+this.money(i.equipeTotal)+'</strong></div><div><span>Fornecedores externos</span><strong>− '+this.money(i.fornecedoresTotal)+'</strong></div><div class="total"><span>Resultado estimado</span><strong class="'+(i.resultado>=0?'positive':'negative')+'">'+this.money(i.resultado)+'</strong></div></div><div><div class="event-finance-payment '+s.codigo+'">'+aviso+'</div>'+(CONFIG.canViewModule('despesas')?'<div class="production-actions"><button class="ops-btn secondary" id="btnFinanceiroVerGastos">Abrir despesas da empresa</button></div>':'')+'<details class="event-finance-launches"><summary>Despesas vinculadas a este evento</summary>'+(lanc||'<div class="ops-empty">Nenhuma despesa vinculada.</div>')+'</details></div></div>';
  },
  lancamento(n,d,v,s){return '<div class="event-finance-launch"><div><strong>'+this.escape(n)+'</strong><small>'+this.escape(d)+'</small></div><span><b>'+this.money(v)+'</b><small class="'+(s==='pago'?'paid-text':'pending-text')+'">'+(s==='pago'?'Pago':'Pendente')+'</small></span></div>';},

  modalHTML(){return '<div class="event-export-overlay" id="financeiroExportacao" aria-hidden="true"><div class="event-export-modal" role="dialog" aria-modal="true"><div class="event-export-head"><div><div class="ops-kicker">RELATÓRIO FINANCEIRO</div><h2>Exportar dados</h2></div><button id="btnFecharExportacao" aria-label="Fechar">×</button></div><div class="event-export-body"><div class="event-export-filters"><label><span>Período</span><select id="financeiroPeriodoExportacao"><option value="mes">'+this.nomeMes()+'</option></select></label><label><span>Situação dos pagamentos</span><select id="financeiroStatusExportacao"><option value="todos">Todos os eventos</option><option value="planejado">Planejados</option><option value="a_pagar">A pagar</option><option value="pago">Tudo pago</option></select></label></div><span class="event-export-label">Formato do arquivo</span><label class="event-export-choice selected"><input type="radio" name="financeiroFormato" value="xlsx" checked><span><strong>Excel profissional — recomendado</strong><small>Abas Histórico e Resumo, com valores, totais e indicadores.</small></span></label><label class="event-export-choice"><input type="radio" name="financeiroFormato" value="csv"><span><strong>CSV simples</strong><small>Arquivo leve para importar em outros sistemas.</small></span></label><p class="event-export-name">Nome: <strong id="financeiroNomeArquivo"></strong></p></div><div class="event-export-footer"><button class="ops-btn secondary" id="btnCancelarExportacao">Cancelar</button><button class="ops-btn" id="btnGerarExportacao">Gerar relatório</button></div></div></div>';},
  bindModal(root){const f=()=>this.fecharExportacao();root.querySelector('#btnFecharExportacao')?.addEventListener('click',f);root.querySelector('#btnCancelarExportacao')?.addEventListener('click',f);root.querySelector('#financeiroStatusExportacao')?.addEventListener('change',e=>this.statusExportacao=e.target.value);root.querySelectorAll('input[name="financeiroFormato"]').forEach(x=>x.addEventListener('change',e=>{this.formatoExportacao=e.target.value;root.querySelectorAll('.event-export-choice').forEach(c=>c.classList.toggle('selected',c.querySelector('input').checked));this.atualizarNome();}));root.querySelector('#btnGerarExportacao')?.addEventListener('click',()=>this.exportar());},
  abrirExportacao(){this.formatoExportacao='xlsx';this.statusExportacao=this.status;const m=document.getElementById('financeiroExportacao');m?.classList.add('open');m?.setAttribute('aria-hidden','false');const s=document.getElementById('financeiroStatusExportacao');if(s)s.value=this.status;this.atualizarNome();},
  fecharExportacao(){const m=document.getElementById('financeiroExportacao');m?.classList.remove('open');m?.setAttribute('aria-hidden','true');},
  nomeArquivo(ext=this.formatoExportacao){return '1K-Beats_Financeiro_'+this.nomeMes().replace(/ de /i,'-').replace(/\s+/g,'-')+'.'+ext;},
  atualizarNome(){const e=document.getElementById('financeiroNomeArquivo');if(e)e.textContent=this.nomeArquivo();},
  colunas(){return ['Data do evento','Número do evento','Nome do evento','Número do orçamento','Cliente','Produtor responsável','Verba do evento','Gastos e compras','Diárias equipe/freelancers','Fornecedores externos','Total de custos','Total pago','Total não pago','Resultado estimado','Situação dos pagamentos'];},
  linha(i){return [new Date(i.data_evento+'T12:00:00'),this.numeroEvento(i),i.nome||'',Utils.fmtNumero(i.orcamentos?.numero),i.orcamentos?.cliente_nome||'',i.produtor_responsavel||'',i.receita,i.gastosTotal,i.equipeTotal,i.fornecedoresTotal,i.custos,i.pagos,i.pendente,i.resultado,i.situacaoFinanceira.rotulo];},
  baixar(blob,nome){const a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=nome;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);},
  async exportar(){const l=this.filtrados(this.statusExportacao||'todos');if(!l.length)return Utils.toast('Não há eventos para exportar.');const b=document.getElementById('btnGerarExportacao');if(b){b.disabled=true;b.textContent='Gerando...';}try{if(this.formatoExportacao==='xlsx')await this.exportarExcel(l);else this.exportarCSV(l);this.fecharExportacao();Utils.toast('Relatório financeiro exportado.');}catch(e){console.error(e);Utils.toast('Não foi possível gerar o relatório.','erro');}finally{if(b){b.disabled=false;b.textContent='Gerar relatório';}}},
  exportarCSV(l){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"',n=v=>(Number(v)||0).toFixed(2).replace('.',',');const rows=l.map(i=>{const r=this.linha(i);r[0]=Utils.fmtDate(i.data_evento);for(let x=6;x<=13;x++)r[x]=n(r[x]);return r.map(q).join(';');});this.baixar(new Blob(['\ufeff'+[this.colunas().map(q).join(';'),...rows].join('\r\n')],{type:'text/csv;charset=utf-8'}),this.nomeArquivo('csv'));},

  async exportarExcel(lista){
    if(typeof ExcelJS==='undefined')throw new Error('ExcelJS não carregado');
    const wb=new ExcelJS.Workbook(), h=wb.addWorksheet('Histórico',{views:[{state:'frozen',ySplit:4}]}), rosa='FFDD126C', escuro='FF191824';wb.creator='1K Beats';
    h.mergeCells('A1:O1');h.getCell('A1').value='1K BEATS — CONTROLE FINANCEIRO DE EVENTOS';h.getCell('A1').font={bold:true,color:{argb:'FFFFFFFF'},size:18};h.getCell('A1').fill={type:'pattern',pattern:'solid',fgColor:{argb:escuro}};h.getRow(1).height=34;
    h.mergeCells('A2:O2');h.getCell('A2').value='Período: '+this.nomeMes()+' • Gerado em '+new Date().toLocaleDateString('pt-BR');h.getCell('A2').font={color:{argb:'FF777484'},italic:true};
    h.getRow(4).values=this.colunas();h.getRow(4).height=30;h.getRow(4).eachCell(c=>{c.font={bold:true,color:{argb:'FFFFFFFF'}};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:rosa}};c.alignment={vertical:'middle',horizontal:'center',wrapText:true};});
    lista.forEach(i=>h.addRow(this.linha(i)));h.autoFilter={from:'A4',to:'O'+(lista.length+4)};h.columns=[12,15,36,18,32,24,18,18,24,22,18,18,18,20,14].map(width=>({width}));h.getColumn(1).numFmt='dd/mm/yyyy';for(let c=7;c<=14;c++)h.getColumn(c).numFmt='R$ #,##0.00;[Red]-R$ #,##0.00';
    for(let r=5;r<=lista.length+4;r++)h.getRow(r).eachCell((c,n)=>{c.alignment={vertical:'middle',horizontal:n>=7&&n<=14?'right':([1,2,4,15].includes(n)?'center':'left')};if(r%2===0)c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF9F8FB'}};c.border={bottom:{style:'hair',color:{argb:'FFE4E2EA'}}};});
    const s=wb.addWorksheet('Resumo',{views:[{showGridLines:false}]});s.columns=[{width:4},{width:28},{width:22},{width:4},{width:28},{width:22}];s.mergeCells('B2:F2');s.getCell('B2').value='1K BEATS — RESUMO FINANCEIRO';s.getCell('B2').font={bold:true,color:{argb:'FFFFFFFF'},size:20};s.getCell('B2').fill={type:'pattern',pattern:'solid',fgColor:{argb:escuro}};s.getRow(2).height=38;s.mergeCells('B3:F3');s.getCell('B3').value=this.nomeMes();
    const vals=[['B5','Verba dos eventos',this.total(lista,'receita')],['E5','Custos previstos',this.total(lista,'custos')],['B8','Total pago',this.total(lista,'pagos')],['E8','A pagar',lista.reduce((s,i)=>s+(i.situacaoFinanceira?.aPagar||0),0)],['B11','Resultado estimado',this.total(lista,'resultado')],['E11','Eventos no período',lista.length]];
    vals.forEach(([p,l,v],i)=>{const col=p[0],row=Number(p.slice(1));s.mergeCells(col+row+':'+String.fromCharCode(col.charCodeAt(0)+1)+(row+1));const c=s.getCell(p);c.value={richText:[{text:l+'\n',font:{color:{argb:'FF777484'},size:11}},{text:i===5?String(v):Utils.fmt(v),font:{bold:true,color:{argb:escuro},size:18}}]};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF1F0F5'}};c.alignment={vertical:'middle',horizontal:'left',wrapText:true};c.border={left:{style:'thin',color:{argb:rosa}}};});
    s.mergeCells('B15:F15');s.getCell('B15').value='Valores extraídos do sistema no momento da exportação. O Supabase permanece como fonte oficial dos dados.';s.getCell('B15').font={color:{argb:'FF777484'},italic:true,size:10};
    const buffer=await wb.xlsx.writeBuffer();this.baixar(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),this.nomeArquivo('xlsx'));
  }
};
