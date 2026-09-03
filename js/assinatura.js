const Assinatura = {
  dados: [],
  cobrancaAtual: null,
  pixConfig: null,

  async carregar(silencioso = false) {
    try {
      const path = Api.orgFilter('/rest/v1/cobrancas_sistema?select=*&order=vencimento.desc');
      this.dados = await Api.request(path) || [];
      if (CONFIG.role === 'owner') {
        const configPath = Api.orgFilter('/rest/v1/config_cobranca_sistema?select=*&limit=1');
        this.pixConfig = (await Api.request(configPath) || [])[0] || null;
      }
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
    const pendentes = this.dados.filter(x => x.status !== 'pago' && x.aviso_visivel).sort((a,b) => a.vencimento.localeCompare(b.vencimento));
    if (!pendentes.length) return;
    const item = pendentes[0], situacao = this.situacao(item);
    const banner = document.createElement('div');
    banner.id = 'subscriptionAlert';
    banner.className = 'subscription-alert ' + situacao.classe;
    banner.innerHTML = situacao.classe === 'overdue'
      ? '<strong>Assinatura pendente</strong><span>Entre em contato com o administrador da plataforma para regularização.</span>'
      : '<strong>Aviso de assinatura</strong><span>A assinatura da plataforma vence em ' + Utils.escapeHTML(Utils.fmtDate(item.vencimento)) + '.</span>';
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
      return '<tr><td><strong>'+Utils.escapeHTML(item.competencia)+'</strong><small>'+Utils.escapeHTML(item.tipo === 'implantacao' ? 'Implantação' : 'Mensalidade')+(item.mensagem_envio?'<span class="billing-draft-ready">✓ Cobrança preparada</span>':'')+'</small></td><td>'+Utils.fmtDate(item.vencimento)+'</td><td>'+Utils.fmt(item.valor)+'</td><td><span class="billing-status '+s.classe+'">'+s.texto+'</span>'+(item.aviso_visivel&&item.status!=='pago'?'<small class="billing-notice-on">● Aviso visível para Walter</small>':'')+'</td><td class="billing-actions">'+(item.status === 'pago' ? '<button data-receipt="'+item.id+'">Recibo</button>' : '<button class="billing-charge-primary" data-charge="'+item.id+'">Cobrar cliente</button><button class="primary" data-pay="'+item.id+'">Marcar como pago</button><details class="billing-more"><summary aria-label="Mais ações">•••</summary><button data-notice="'+item.id+'">'+(item.aviso_visivel?'Ocultar aviso do Walter':'Exibir aviso para Walter')+'</button></details>')+'</td></tr>';
    }).join('');
    root.innerHTML = '<div class="billing-page"><div class="billing-head"><div><div class="ops-kicker">PRYNTIX • LICENCIAMENTO</div><h1>Assinatura</h1><p>Controle simples da implantação e das mensalidades da plataforma.</p></div><div class="billing-head-actions"><button class="ops-btn secondary" id="btnConfigPix">Configurar PIX</button><button class="ops-btn" id="btnNovaCobranca">+ Nova cobrança</button></div></div><div class="billing-summary"><article><span>Mensalidade</span><strong>R$ 300,00</strong></article><article><span>Próximo vencimento</span><strong>'+(proxima?Utils.fmtDate(proxima.vencimento):'Tudo em dia')+'</strong></article><article><span>Pagamentos registrados</span><strong>'+pagos+' de '+this.dados.length+'</strong></article></div><section class="billing-card"><div class="billing-card-title">Histórico de cobranças</div><div class="billing-table-wrap"><table class="billing-table"><thead><tr><th>Referência</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th>Ações</th></tr></thead><tbody>'+(rows||'<tr><td colspan="5" class="billing-empty">Nenhuma cobrança cadastrada.</td></tr>')+'</tbody></table></div></section></div>' + this.modalHTML();
    root.querySelector('#btnNovaCobranca')?.addEventListener('click',()=>this.abrirNova());
    root.querySelector('#btnConfigPix')?.addEventListener('click',()=>this.abrirConfigPix());
    root.querySelectorAll('[data-charge]').forEach(b=>b.addEventListener('click',()=>this.abrirWhats(b.dataset.charge)));
    root.querySelectorAll('[data-pay]').forEach(b=>b.addEventListener('click',()=>this.marcarPago(b.dataset.pay)));
    root.querySelectorAll('[data-notice]').forEach(b=>b.addEventListener('click',()=>this.alternarAviso(b.dataset.notice)));
    root.querySelectorAll('[data-receipt]').forEach(b=>b.addEventListener('click',()=>this.gerarRecibo(b.dataset.receipt)));
    this.bindModal(root);
  },

  modalHTML() {
    return '<div class="billing-modal-bg" id="billingModal"><div class="billing-modal"><div class="billing-modal-head"><h2 id="billingModalTitle">Nova cobrança</h2><button data-close aria-label="Fechar">×</button></div><div id="billingNewFields"><label>Tipo<select id="billingType"><option value="mensalidade">Mensalidade</option><option value="implantacao">Implantação</option></select></label><label>Referência<input id="billingCompetence" placeholder="Ex.: 10/2026 ou Parcela 1/2"></label><label>Vencimento<input id="billingDue" type="date"></label><label>Valor (R$)<input id="billingValue" type="number" min="0.01" step="0.01" value="300"></label></div><div id="billingWhatsFields" hidden><div class="billing-charge-summary"><span id="billingChargeReference"></span><strong id="billingChargeValue"></strong></div><label>WhatsApp do Guto<input id="billingPhone" type="tel" inputmode="tel" placeholder="(21) 99999-9999"></label><label>Mensagem<textarea id="billingMessage" rows="7"></textarea></label><button class="billing-copy" id="billingCopy">Copiar mensagem</button></div><div id="billingConfigPixFields" hidden><label>Chave PIX (CPF)<input id="billingPixKey" inputmode="numeric" placeholder="Digite somente os números"></label><label>Favorecido<input id="billingPixName" value="Alessandro César de Souza Lima"></label><label>Cidade<input id="billingPixCity" value="NITEROI"></label><label>Instituição<input id="billingPixBank" value="Nubank"></label><small class="billing-security">Dados protegidos e visíveis somente no seu perfil.</small></div><div id="billingPixPreview" hidden><div class="billing-pix-document"><div id="billingQr"></div><div><strong id="billingPixAmount"></strong><span id="billingPixReference"></span><small>Pagamento direcionado ao favorecido configurado.</small></div></div><label class="billing-payload-label">PIX Copia e Cola<textarea id="billingPixPayload" rows="3" readonly></textarea></label><div class="billing-pix-tools"><button class="billing-copy" id="billingCopyPix">Copiar PIX</button><button class="billing-copy" id="billingDownloadPix">Baixar PDF</button></div></div><div class="billing-modal-actions"><button data-close>Cancelar</button><button id="billingSaveDraft" hidden>Salvar para depois</button><button class="primary" id="billingConfirm">Salvar</button></div></div></div>';
  },

  bindModal(root) {
    root.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>root.querySelector('#billingModal')?.classList.remove('open')));
    root.querySelector('#billingConfirm')?.addEventListener('click',()=>this.confirmarModal());
    root.querySelector('#billingCopy')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(root.querySelector('#billingMessage').value);Utils.toast('Mensagem copiada.');});
    root.querySelector('#billingCopyPix')?.addEventListener('click',async()=>{await navigator.clipboard.writeText(root.querySelector('#billingPixPayload').value);Utils.toast('Código PIX copiado.');});
    root.querySelector('#billingDownloadPix')?.addEventListener('click',()=>this.baixarCobrancaPix());
    root.querySelector('#billingSaveDraft')?.addEventListener('click',()=>this.salvarParaDepois());
  },

  abrirNova() {
    this.cobrancaAtual = null;
    const modal=document.getElementById('billingModal'); modal?.classList.add('open');
    document.getElementById('billingModalTitle').textContent='Nova cobrança';
    document.getElementById('billingNewFields').hidden=false; document.getElementById('billingWhatsFields').hidden=true; document.getElementById('billingConfigPixFields').hidden=true; document.getElementById('billingPixPreview').hidden=true;
    document.getElementById('billingConfirm').textContent='Salvar';
    document.getElementById('billingSaveDraft').hidden=true;
    const now=new Date(), next=new Date(now.getFullYear(),now.getMonth()+1,10);
    document.getElementById('billingCompetence').value=String(next.getMonth()+1).padStart(2,'0')+'/'+next.getFullYear();
    document.getElementById('billingDue').value=next.toISOString().slice(0,10);
  },

  abrirWhats(id) {
    const item=this.dados.find(x=>x.id===id); if(!item)return;
    if(!this.pixConfig){Utils.toast('Configure sua chave PIX antes de gerar a cobrança.','erro');return this.abrirConfigPix();}
    this.cobrancaAtual=item; const payload=this.gerarPayloadPix(item);
    const modal=document.getElementById('billingModal'); modal?.classList.add('open');
    document.getElementById('billingModalTitle').textContent='Cobrar cliente';
    document.getElementById('billingNewFields').hidden=true; document.getElementById('billingWhatsFields').hidden=false; document.getElementById('billingConfigPixFields').hidden=true; document.getElementById('billingPixPreview').hidden=false;
    document.getElementById('billingConfirm').textContent='Enviar com PDF';
    document.getElementById('billingSaveDraft').hidden=false;
    document.getElementById('billingChargeReference').textContent=(item.tipo==='implantacao'?'Implantação':'Mensalidade')+' '+item.competencia+' · vence em '+Utils.fmtDate(item.vencimento);
    document.getElementById('billingChargeValue').textContent=Utils.fmt(item.valor);
    const pix=this.pixConfig?.pix_chave?this.pixConfig.pix_chave.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'):'configure no menu Assinatura';
    const mensagemPadrao='Olá, Guto! Tudo bem?\n\nA '+(item.tipo==='implantacao'?'implantação':'mensalidade')+' da plataforma 1K Beats, referente a '+item.competencia+', está disponível para pagamento.\n\nValor: '+Utils.fmt(item.valor)+'\nVencimento: '+Utils.fmtDate(item.vencimento)+'\nPIX: '+pix+'\n\nObrigado!';
    document.getElementById('billingPhone').value=item.telefone_envio||'';
    document.getElementById('billingMessage').value=item.mensagem_envio||mensagemPadrao;
    document.getElementById('billingPixAmount').textContent=Utils.fmt(item.valor); document.getElementById('billingPixReference').textContent='PIX referente a '+item.competencia; document.getElementById('billingPixPayload').value=payload;
    const qr=document.getElementById('billingQr'); qr.innerHTML=''; new QRCode(qr,{text:payload,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});
  },

  async confirmarModal() {
    if (!document.getElementById('billingConfigPixFields').hidden) return this.salvarConfigPix();
    if (!document.getElementById('billingPixPreview').hidden) return this.compartilharCobranca();
    if (this.cobrancaAtual) {
      const phone=Utils.normalizePhone(document.getElementById('billingPhone').value), message=document.getElementById('billingMessage').value;
      Utils.openExternal('https://wa.me/'+(phone?('55'+phone.replace(/^55/,'')):'')+'?text='+encodeURIComponent(message)); return;
    }
    const tipo=document.getElementById('billingType').value, competencia=Utils.sanitizeText(document.getElementById('billingCompetence').value,40), vencimento=document.getElementById('billingDue').value, valor=Number(document.getElementById('billingValue').value);
    if(!competencia||!vencimento||valor<=0)return Utils.toast('Preencha referência, vencimento e valor.','erro');
    try { await Api.request('/rest/v1/cobrancas_sistema',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(Api.orgPayload({tipo,competencia,vencimento,valor,status:'pendente'}))}); document.getElementById('billingModal').classList.remove('open'); await this.carregar(); Utils.toast('Cobrança cadastrada.'); } catch(e){Utils.toast(Api.friendlyError(e),'erro');}
  },

  abrirConfigPix() {
    this.cobrancaAtual=null;
    document.getElementById('billingModal').classList.add('open');
    document.getElementById('billingModalTitle').textContent='Configurar recebimento PIX';
    document.getElementById('billingNewFields').hidden=true; document.getElementById('billingWhatsFields').hidden=true; document.getElementById('billingPixPreview').hidden=true; document.getElementById('billingConfigPixFields').hidden=false;
    document.getElementById('billingPixKey').value=this.pixConfig?.pix_chave||'';
    document.getElementById('billingPixName').value=this.pixConfig?.favorecido||'Alessandro César de Souza Lima';
    document.getElementById('billingPixCity').value=this.pixConfig?.cidade||'NITEROI';
    document.getElementById('billingPixBank').value=this.pixConfig?.instituicao||'Nubank';
    document.getElementById('billingConfirm').textContent='Salvar PIX';
    document.getElementById('billingSaveDraft').hidden=true;
  },

  semAcentos(value,max) { return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9 ]/g,'').toUpperCase().trim().slice(0,max); },
  favorecidoExibicao() { const nome=this.pixConfig?.favorecido||'Alessandro César de Souza Lima'; return this.semAcentos(nome,100)==='ALESSANDRO CESAR DE SOUZA LIMA'?'Alessandro César de Souza Lima':nome; },
  campo(id,value) { const v=String(value); return id+String(v.length).padStart(2,'0')+v; },
  crc16(value) { let crc=0xFFFF; for(let i=0;i<value.length;i++){crc^=value.charCodeAt(i)<<8;for(let j=0;j<8;j++)crc=(crc&0x8000)?((crc<<1)^0x1021):(crc<<1);crc&=0xFFFF;}return crc.toString(16).toUpperCase().padStart(4,'0'); },
  cpfValido(value) { const cpf=String(value||'').replace(/\D/g,''); if(cpf.length!==11||/^(\d)\1{10}$/.test(cpf))return false; const digito=tamanho=>{let soma=0;for(let i=0;i<tamanho;i++)soma+=Number(cpf[i])*(tamanho+1-i);const resto=(soma*10)%11;return resto===10?0:resto;};return digito(9)===Number(cpf[9])&&digito(10)===Number(cpf[10]); },

  gerarPayloadPix(item) {
    const cfg=this.pixConfig, key=String(cfg.pix_chave||'').replace(/\D/g,''), name=this.semAcentos(cfg.favorecido,25), city=this.semAcentos(cfg.cidade,15), txid=this.semAcentos('1K'+item.competencia,25).replace(/ /g,'')||'***';
    const merchant=this.campo('00','BR.GOV.BCB.PIX')+this.campo('01',key)+this.campo('02',this.semAcentos('1K Beats '+item.competencia,72));
    let payload=this.campo('00','01')+this.campo('26',merchant)+this.campo('52','0000')+this.campo('53','986')+this.campo('54',Number(item.valor).toFixed(2))+this.campo('58','BR')+this.campo('59',name)+this.campo('60',city)+this.campo('62',this.campo('05',txid))+'6304';
    return payload+this.crc16(payload);
  },

  async salvarConfigPix() {
    const key=String(document.getElementById('billingPixKey').value||'').replace(/\D/g,''), favorecido=Utils.sanitizeText(document.getElementById('billingPixName').value,100), cidade=this.semAcentos(document.getElementById('billingPixCity').value,15), instituicao=Utils.sanitizeText(document.getElementById('billingPixBank').value,50);
    if(!this.cpfValido(key)||!favorecido||!cidade)return Utils.toast('Informe um CPF válido, favorecido e cidade.','erro');
    const payload={organization_id:CONFIG.organizationId,pix_tipo:'cpf',pix_chave:key,favorecido,cidade,instituicao};
    try { await Api.request('/rest/v1/config_cobranca_sistema?on_conflict=organization_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)}); this.pixConfig=payload; document.getElementById('billingModal').classList.remove('open'); Utils.toast('PIX configurado com segurança.'); } catch(e){Utils.toast(Api.friendlyError(e),'erro');}
  },

  abrirCobrancaPix(id) {
    const item=this.dados.find(x=>x.id===id); if(!item)return;
    if(!this.pixConfig){Utils.toast('Configure sua chave PIX antes de gerar a cobrança.','erro');return this.abrirConfigPix();}
    this.cobrancaAtual=item; const payload=this.gerarPayloadPix(item);
    document.getElementById('billingModal').classList.add('open'); document.getElementById('billingModalTitle').textContent='Cobrança PIX'; document.getElementById('billingNewFields').hidden=true; document.getElementById('billingWhatsFields').hidden=true; document.getElementById('billingConfigPixFields').hidden=true; document.getElementById('billingPixPreview').hidden=false; document.getElementById('billingPixAmount').textContent=Utils.fmt(item.valor); document.getElementById('billingPixReference').textContent='Mensalidade '+item.competencia+' · vence em '+Utils.fmtDate(item.vencimento); document.getElementById('billingPixPayload').value=payload; document.getElementById('billingConfirm').textContent='Baixar PDF';
    const qr=document.getElementById('billingQr'); qr.innerHTML=''; new QRCode(qr,{text:payload,width:180,height:180,correctLevel:QRCode.CorrectLevel.M});
  },

  baixarCobrancaPix() {
    const doc=this.criarDocumentoCobranca(); if(!doc)return;
    const item=this.cobrancaAtual; doc.save('cobranca-pix-1kbeats-'+item.competencia.replace('/','-')+'.pdf');
  },

  criarDocumentoCobranca() {
    const item=this.cobrancaAtual, canvas=document.querySelector('#billingQr canvas'), jspdf=window.jspdf;
    if(!item||!canvas||!jspdf)return Utils.toast('Aguarde o QR Code carregar.','erro');
    const doc=new jspdf.jsPDF(); doc.setFillColor(25,25,35);doc.rect(0,0,210,48,'F');doc.setDrawColor(217,26,114);doc.setLineWidth(1.5);doc.line(0,48,210,48);doc.setTextColor(255,255,255);doc.setFontSize(22);doc.text('PRYNTIX',18,26);doc.setFontSize(9);doc.text('DOCUMENTO DE COBRANÇA',192,18,{align:'right'});doc.setFontSize(18);doc.text('Aviso de cobrança',192,31,{align:'right'});doc.setTextColor(30,30,40);doc.setFontSize(9);doc.text('CLIENTE',18,64);doc.setFontSize(12);doc.text('1000 BEATS ÁUDIO, VÍDEO E ILUMINAÇÃO LTDA.',18,73);doc.setFontSize(9);doc.text('CNPJ 62.496.834/0001-97',18,80);doc.setFillColor(252,240,246);doc.rect(18,90,174,31,'F');doc.setFontSize(9);doc.text('REFERÊNCIA',24,99);doc.text('VENCIMENTO',87,99);doc.text('VALOR',145,99);doc.setFontSize(12);doc.text(item.competencia,24,111);doc.text(Utils.fmtDate(item.vencimento),87,111);doc.setTextColor(217,26,114);doc.setFontSize(15);doc.text(Utils.fmt(item.valor),145,111);doc.addImage(canvas.toDataURL('image/png'),'PNG',18,134,55,55);doc.setTextColor(30,30,40);doc.setFontSize(14);doc.text('Pagamento via PIX',85,143);doc.setFontSize(10);doc.text('Escaneie o QR Code ou use o PIX Copia e Cola.',85,153);doc.text('Favorecido: '+this.favorecidoExibicao(),85,164);doc.text('Instituição: '+(this.pixConfig.instituicao||''),85,172);doc.setFontSize(8);doc.setTextColor(110,110,125);doc.text('Este documento é um aviso de cobrança para pagamento via PIX.',18,208);doc.text('O recibo será disponibilizado após a confirmação do pagamento.',18,214);return doc;
  },

  async compartilharCobranca() {
    const doc=this.criarDocumentoCobranca(); if(!doc)return;
    const item=this.cobrancaAtual, nome='cobranca-pix-1kbeats-'+item.competencia.replace('/','-')+'.pdf', mensagem=document.getElementById('billingMessage').value;
    const arquivo=new File([doc.output('blob')],nome,{type:'application/pdf'});
    if(navigator.share&&navigator.canShare?.({files:[arquivo]})) {
      try { await navigator.share({title:'Cobrança 1K Beats',text:mensagem,files:[arquivo]}); return; } catch(e) { if(e?.name==='AbortError')return; }
    }
    doc.save(nome);
    const phone=Utils.normalizePhone(document.getElementById('billingPhone').value);
    Utils.toast('PDF baixado. Anexe o arquivo na conversa do WhatsApp.');
    setTimeout(()=>Utils.openExternal('https://wa.me/'+(phone?('55'+phone.replace(/^55/,'')):'')+'?text='+encodeURIComponent(mensagem)),500);
  },

  async salvarParaDepois() {
    const item=this.cobrancaAtual; if(!item)return;
    const telefone=Utils.normalizePhone(document.getElementById('billingPhone').value);
    const mensagem=Utils.sanitizeText(document.getElementById('billingMessage').value,2000);
    if(!mensagem)return Utils.toast('Escreva a mensagem antes de salvar.','erro');
    try {
      await Api.request('/rest/v1/cobrancas_sistema?id=eq.'+encodeURIComponent(item.id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({telefone_envio:telefone||null,mensagem_envio:mensagem})});
      document.getElementById('billingModal').classList.remove('open');
      await this.carregar();
      Utils.toast('Cobrança salva para enviar depois.');
    } catch(e) { Utils.toast(Api.friendlyError(e),'erro'); }
  },

  async marcarPago(id) {
    try { await Api.request('/rest/v1/cobrancas_sistema?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:'pago',pago_em:new Date().toISOString().slice(0,10),aviso_visivel:false})}); await this.carregar(); Utils.toast('Pagamento confirmado. Aviso retirado e recibo liberado.'); } catch(e){Utils.toast(Api.friendlyError(e),'erro');}
  },

  async alternarAviso(id) {
    const item=this.dados.find(x=>x.id===id); if(!item)return;
    const visivel=!item.aviso_visivel;
    try { await Api.request('/rest/v1/cobrancas_sistema?id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({aviso_visivel:visivel})}); await this.carregar(); Utils.toast(visivel?'Aviso liberado para Walter.':'Aviso ocultado para Walter.'); } catch(e){Utils.toast(Api.friendlyError(e),'erro');}
  },

  gerarRecibo(id) {
    const item=this.dados.find(x=>x.id===id); if(!item)return;
    const jspdf=window.jspdf; if(!jspdf)return Utils.toast('Gerador de PDF ainda carregando. Tente novamente.','erro');
    const doc=new jspdf.jsPDF(); doc.setFillColor(25,25,35);doc.rect(0,0,210,38,'F');doc.setTextColor(255,255,255);doc.setFontSize(22);doc.text('Pryntix',18,24);doc.setFontSize(10);doc.text('RECIBO DE PAGAMENTO',192,22,{align:'right'});doc.setTextColor(25,25,35);doc.setFontSize(18);doc.text('Recibo',18,58);doc.setFontSize(11);doc.text('Recebemos de 1000 BEATS ÁUDIO, VÍDEO E ILUMINAÇÃO LTDA.',18,76);doc.text('CNPJ 62.496.834/0001-97',18,84);doc.text('Valor: '+Utils.fmt(item.valor),18,100);doc.text('Referência: '+(item.tipo==='implantacao'?'Implantação':'Mensalidade')+' — '+item.competencia,18,108);doc.text('Pagamento registrado em: '+Utils.fmtDate(item.pago_em),18,116);doc.setDrawColor(217,26,114);doc.line(18,130,192,130);doc.setFontSize(10);doc.text('ALESSANDRO CESAR DE SOUZA LIMA',18,145);doc.text('CNPJ 52.758.157/0001-84',18,152);doc.text('Tecnologia e licenciamento por Pryntix',18,159);doc.save('recibo-1kbeats-'+item.competencia.replace('/','-')+'.pdf');
  }
};
