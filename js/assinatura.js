const Assinatura = {
  dados: [],
  cobrancaAtual: null,

  async carregar(silencioso = false) {
    try {
      const path = Api.orgFilter('/rest/v1/cobrancas_sistema?select=*&order=vencimento.desc');
      this.dados = await Api.request(path) || [];
      this.renderAlerta();
      if (!silencioso && CONFIG.role === 'owner') this.render();
    } catch (error) {
      if (!silencioso) Utils.toast(Api.friendlyError(error, 'Não foi possível carregar as cobranças.'), 'erro');
    }
  },

  situacao(item) {
    if (item.status === 'pago') return { texto: 'Pago', classe: 'paid' };
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const vencimento = new Date(item.vencimento + 'T12:00:00');
    const dias = Math.ceil((vencimento - hoje) / 86400000);
    if (dias < 0) return { texto: 'Vencido', classe: 'overdue' };
    if (dias <= 5) return { texto: 'Próximo do vencimento', classe: 'soon' };
    return { texto: 'Pendente', classe: 'pending' };
  },

  renderAlerta() {
    document.getElementById('subscriptionAlert')?.remove();
    if (CONFIG.role === 'owner') return;
    const pendentes = this.dados.filter(x => x.status !== 'pago').sort((a,b) => a.vencimento.localeCompare(b.vencimento));
    if (!pendentes.length) return;
    const item = pendentes[0], situacao = this.situacao(item);
    if (!['soon','overdue'].includes(situacao.classe)) return;
    const banner = document.createElement('div');
    banner.id = 'subscriptionAlert';
    banner.className = 'subscription-alert ' + situacao.classe;
    banner.innerHTML = situacao.classe === 'overdue'
      ? '<strong>Assinatura pendente</strong><span>Entre em contato com o administrador da plataforma para regularização.</span>'
      : '<strong>Próximo vencimento</strong><span>A assinatura da plataforma vence em ' + Utils.escapeHTML(Utils.fmtDate(item.vencimento)) + '.</span>';
    document.querySelector('.main-content')?.prepend(banner);
  },

  render() {
    const root = document.getElementById('assinaturaContent');
    if (!root || CONFIG.role !== 'owner') return;
    const pagos = this.dados.filter(x => x.status === 'pago').length;
    const pendentes = this.dados.filter(x => x.status !== 'pago');
    const proxima = pendentes.slice().sort((a,b) => a.vencimento.localeCompare(b.vencimento))[0];
    const rows = this.dados.map(item => {
      const s = this.situacao(item);
      return '<tr><td><strong>'+Utils.escapeHTML(item.competencia)+'</strong><small>'+Utils.escapeHTML(item.tipo === 'implantacao' ? 'Implantação' : 'Mensalidade')+'</small></td><td>'+Utils.fmtDate(item.vencimento)+'</td><td>'+Utils.fmt(item.valor)+'</td><td><span class="billing-status '+s.classe+'">'+s.texto+'</span></td><td class="billing-actions">'+(item.status === 'pago' ? '<button data-receipt="'+item.id+'">Recibo</button>' : '<button data-charge="'+item.id+'">WhatsApp</button><button class="primary" data-pay="'+item.id+'">Marcar pago</button>')+'</td></tr>';
    }).join('');
    root.innerHTML = '<div class="billing-page"><div class="billing-head"><div><div class="ops-kicker">PRYNTIX • LICENCIAMENTO</div><h1>Assinatura</h1><p>Controle simples da implantação e das mensalidades da plataforma.</p></div><button class="ops-btn" id="btnNovaCobranca">+ Nova cobrança</button></div><div class="billing-summary"><article><span>Mensalidade</span><strong>R$ 300,00</strong></article><article><span>Próximo vencimento</span><strong>'+(proxima?Utils.fmtDate(proxima.vencimento):'Tudo em dia')+'</strong></article><article><span>Pagamentos registrados</span><strong>'+pagos+' de '+this.dados.length+'</strong></article></div><section class="billing-card"><div class="billing-card-title">Histórico de cobranças</div><div class="billing-table-wrap"><table class="billing-table"><thead><tr><th>Referência</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5" class="billing-empty">Nenhuma cobrança cadastrada.</td></tr>')+'</tbody></table></div></section></div>' + this.modalHTML();
    root.querySelector('#btnNovaCobranca')?.addEventListener('click',()=>this.abrirNova());
    root.querySelectorAll('[data-charge]').forEach(b=>b.addEventListener('click',()=>this.abrirWhats(b.dataset.charge)));
    root.querySelectorAll('[data-pay]').forEach(b=>b.addEventListener('click',()=>this.marcarPago(b.dataset.pay)));
    root.querySelectorAll('[data-receipt]').forEach(b=>b.addEventListener('click',()=>this.gerarRecibo(b.dataset.receipt)));
    this.bindModal(root);
  },

  modalHTML() {
    return '<div class="billing-modal-bg" id="billingModal"><div class="billing-modal"><div class="billing-modal-head"><h2 id="billingModalTitle">Nova cobrança</h2><button data-close aria-label="Fechar">×</button></div><div id="billingNewFields"><label>Tipo<select id="billingType"><option value="mensalidade">Mensalidade</option><option value="implantacao">Implantação</option></select></label><label>Referência<input id="billingCompetence" placeholder="Ex.: 10/2026 ou Parcela 1/2"></label><label>Vencimento<input id="billingDue" type="date"></label><label>Valor (R$)<input id="billingValue" type="number" min="0.01" step="0.01" value="300"></label></div><div id="billingWhatsFields" hidden><label>WhatsApp do Guto<input id="billingPhone" type="tel" inputmode="tel" placeholder="(21) 99999-9999"></label><label>Mensagem<textarea id="billingMessage" rows="9"></textarea></label><button class="billing-copy" id="billingCopy">Copiar mensagem</button></div><div class="billing-modal-actions"><button data-close>Cancelar</button><button class="primary" id="billingConfirm">Salvar</button></div></div></div>';
  },

  bindModal(root) {
    root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>root.querySelector('#billingModal')?.classList.remove('open')));
    root.querySelector('#billingConfirm')?.addEventListener('click',()=>this.confirmarModal());
    root.querySelector('#billingCopy')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(root.querySelector('#billingMessage').value);Utils.toast('Mensagem copiada.');});
  },

  abrirNova() {
    this.cobrancaAtual = null;
    const modal=document.getElementById('billingModal'); modal?.classList.add('open');
    document.getElementById('billingModalTitle').textContent='Nova cobrança';
    document.getElementById('billingNewFields').hidden=false; document.getElementById('billingWhatsFields').hidden=true;
    document.getElementById('billingConfirm').textContent='Salvar';
    const now=new Date(), next=new Date(now.getFullYear(),now.getMonth()+1,10);
    document.getElementById('billingCompetence').value=String(next.getMonth()+1).padStart(2,'0')+'/'+next.getFullYear();
    document.getElementById('billingDue').value=next.toISOString().slice(0,10);
  },

  abrirWhats(id) {
    const item=this.dados.find(x=>x.id===id); if(!item)return; this.cobrancaAtual=item;
    const modal=document.getElementById('billingModal'); modal?.classList.add('open');
    document.getElementById('billingModalTitle').textContent='Enviar cobrança';
    document.getElementById('billingNewFields').hidden=true; document.getElementById('billingWhatsFields').hidden=false;
    document.getElementById('billingConfirm').textContent='Abrir WhatsApp';
    document.getElementById('billingMessage').value='Olá, Guto! Tudo bem?\n\nA '+(item.tipo==='implantacao'?'implantação':'mensalidade')+' da plataforma 1K Beats, referente a '+item.competencia+', está disponível para pagamento.\n\nValor: '+Utils.fmt(item.valor)+'\nVencimento: '+Utils.fmtDate(item.vencimento)+'\nPIX: 52.758.157/0001-84\n\nObrigado!';
  },

  async confirmarModal() {
    if (this.cobrancaAtual) {
      const phone=Utils.normalizePhone(document.getElementById('billingPhone').value), message=document.getElementById('billingMessage').value;
      Utils.openExternal('https://wa.me/'+(phone?('55'+phone.replace(/^55/,'')):'')+'?text='+encodeURIComponent(message)); return;
    }
    const tipo=document.getElementById('billingType').value, competencia=Utils.sanitizeText(document.getElementById('billingCompetence').value,40), vencimento=document.getElementById('billingDue').value, valor=Number(document.getElementById('billingValue').value);
    if(!competencia||!vencimento||valor<=0)return Utils.toast('Preencha referência, vencimento e valor.','erro');
    try { await Api.request('/rest/v1/cobrancas_sistema',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(Api.orgPayload({tipo,competencia,vencimento,valor,status:'pendente'}))}); document.getElementById('billingModal').classList.remove('open'); await this.carregar(); Utils.toast('Cobrança cadastrada.'); } catch(e){Utils.toast(Api.friendlyError(e),'erro');}
  },

  async marcarPago(id) {
    try { await Api.request('/rest/v1/cobrancas_sistema?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'pago',pago_em:new Date().toISOString().slice(0,10)})}); await this.carregar(); Utils.toast('Pagamento confirmado. Recibo liberado.'); } catch(e){Utils.toast(Api.friendlyError(e),'erro');}
  },

  gerarRecibo(id) {
    const item=this.dados.find(x=>x.id===id); if(!item)return;
    const jspdf=window.jspdf; if(!jspdf)return Utils.toast('Gerador de PDF ainda carregando. Tente novamente.','erro');
    const doc=new jspdf.jsPDF(); doc.setFillColor(25,25,35);doc.rect(0,0,210,38,'F');doc.setTextColor(255,255,255);doc.setFontSize(22);doc.text('Pryntix',18,24);doc.setFontSize(10);doc.text('RECIBO DE PAGAMENTO',192,22,{align:'right'});doc.setTextColor(25,25,35);doc.setFontSize(18);doc.text('Recibo',18,58);doc.setFontSize(11);doc.text('Recebemos de 1000 BEATS ÁUDIO, VÍDEO E ILUMINAÇÃO LTDA.',18,76);doc.text('CNPJ 62.496.834/0001-97',18,84);doc.text('Valor: '+Utils.fmt(item.valor),18,100);doc.text('Referência: '+(item.tipo==='implantacao'?'Implantação':'Mensalidade')+' — '+item.competencia,18,108);doc.text('Pagamento registrado em: '+Utils.fmtDate(item.pago_em),18,116);doc.setDrawColor(217,26,114);doc.line(18,130,192,130);doc.setFontSize(10);doc.text('ALESSANDRO CESAR DE SOUZA LIMA',18,145);doc.text('CNPJ 52.758.157/0001-84',18,152);doc.text('Tecnologia e licenciamento por Pryntix',18,159);doc.save('recibo-1kbeats-'+item.competencia.replace('/','-')+'.pdf');
  }
};
