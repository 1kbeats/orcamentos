(async function publicQuotePage() {
  const card = document.getElementById('cardOrc');
  const footerButton = document.getElementById('btnRodape');
  const token = new URLSearchParams(window.location.search).get('t');

  function showError() {
    card.innerHTML =
      '<div class="empty"><h2>Orçamento indisponível</h2>' +
      '<p>Este link pode estar incorreto, desativado ou expirado.</p></div>';
  }

  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    showError();
    return;
  }

  try {
    const quote = await Api.anonymous('/rest/v1/rpc/get_public_quote', {
      method: 'POST',
      body: JSON.stringify({ p_token: token })
    });
    if (!quote || !quote.numero) {
      showError();
      return;
    }
    const items = Array.isArray(quote.itens) ? quote.itens.slice(0, 100) : [];
    const subtotal = items.reduce((sum, item) =>
      sum + (Number(item.tot) || (Number(item.qty || item.q) * Number(item.unit || item.u))), 0);
    const discountValue = Number(quote.desconto_valor) || 0;
    const discount = quote.desconto_tipo === 'pct' ? subtotal * discountValue / 100 : discountValue;
    const total = Number(quote.total) || Math.max(0, subtotal - discount);
    const rows = items.map(item => {
      const description = item.desc || item.d || '';
      const quantity = Number(item.qty || item.q) || 0;
      const unit = Number(item.unit || item.u) || 0;
      return '<tr>' +
        '<td>' + Utils.escapeHTML(description) + '</td>' +
        '<td style="text-align:center">' + Utils.escapeHTML(quantity) + '</td>' +
        '<td style="text-align:right">' + Utils.escapeHTML(Utils.fmt(unit)) + '</td>' +
        '<td style="text-align:right">' + Utils.escapeHTML(Utils.fmt(quantity * unit)) + '</td>' +
      '</tr>';
    }).join('');
    const discountRow = discount > 0
      ? '<tr><td>Desconto</td><td style="text-align:right">- ' + Utils.escapeHTML(Utils.fmt(discount)) + '</td></tr>'
      : '';
    card.innerHTML =
      '<div class="hdr">' +
        '<div class="brand" aria-label="1K Beats">' +
          '<div class="brand-name"><span class="brand-1k">1K</span><span class="brand-beats">beats</span><span class="brand-wave">))</span></div>' +
          '<div class="brand-company"><div class="brand-company-label">Emitido por</div><div class="brand-company-name">' +
            Utils.escapeHTML(quote.empresa || '1000 Beats Áudio, Vídeo e Iluminação Ltda.') + '</div>' +
            '<div class="brand-company-doc">' + (quote.cnpj_emp ? 'CNPJ ' + Utils.escapeHTML(quote.cnpj_emp) : 'CNPJ não informado') + '</div></div>' +
        '</div>' +
        '<div class="hdr-right"><div class="meta">' +
          '<div class="doc-label">Documento comercial</div><div class="doc-title">Orçamento</div>' +
          '<div><strong>Nº</strong> ' + Utils.escapeHTML(Utils.fmtNumero(quote.numero)) + '</div>' +
          '<div><strong>Emissão</strong> ' + Utils.escapeHTML(Utils.fmtDate(quote.created_at)) + '</div>' +
          '<div><strong>Validade</strong> ' + Utils.escapeHTML(Utils.fmtDate(quote.valido_ate)) + '</div>' +
        '</div></div>' +
      '</div>' +
      (quote.referencia ? '<div class="ref-band"><span class="ref-band-label">REF.</span><span class="ref-band-value">' + Utils.escapeHTML(quote.referencia) + '</span></div>' : '') +
      '<div class="body">' +
        '<div class="client-grid">' +
          '<div><div class="cf-label">Cliente</div><div class="cf-val">' + Utils.escapeHTML(quote.cliente_nome || '—') +
            (quote.solicitante ? '<br><small>Solicitante: ' + Utils.escapeHTML(quote.solicitante) + '</small>' : '') +
          '</div></div>' +
          '<div><div class="cf-label">CNPJ / CPF</div><div class="cf-val">' + Utils.escapeHTML(quote.cnpj_cli || '—') + '</div></div>' +
          '<div class="issuer"><div class="cf-label">Emitido por</div><div class="cf-val">' +
            Utils.escapeHTML(quote.empresa || '—') + '</div></div>' +
        '</div>' +

        '<div class="sec-label">Itens do orçamento</div>' +
        '<table><thead><tr><th>Descrição</th><th>Qtd.</th><th>Valor unitário</th><th>Total</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><div style="width:280px"><table>' +
          '<tbody><tr><td>Subtotal</td><td style="text-align:right">' + Utils.escapeHTML(Utils.fmt(subtotal)) + '</td></tr>' +
          discountRow +
          '<tr><td style="font-size:16px;font-weight:700">Total</td><td style="text-align:right;font-size:16px;font-weight:700;color:#D91A72">' +
            Utils.escapeHTML(Utils.fmt(total)) + '</td></tr></tbody></table></div></div>' +
        (quote.observacoes ? '<div style="margin-top:24px;padding:12px 16px;border-left:3px solid #D91A72;background:#FDF5F9;white-space:pre-wrap">' +
          Utils.escapeHTML(quote.observacoes) + '</div>' : '') +
        '<div class="footer"><div>' + Utils.escapeHTML(quote.empresa || '') +
          (quote.cnpj_emp ? ' · CNPJ: ' + Utils.escapeHTML(quote.cnpj_emp) : '') + '</div><div>' +
          Utils.escapeHTML([quote.tel_emp, quote.email_emp].filter(Boolean).join(' · ')) + '</div></div>' +
      '</div>';
    card.appendChild(footerButton);
    footerButton.style.display = 'block';
    document.title = 'Orçamento ' + Utils.fmtNumero(quote.numero) + ' — ' + (quote.empresa || '1K Beats Orçamentos');
    document.getElementById('btnSalvarPDF')?.addEventListener('click', () => window.print());
  } catch (_) {
    showError();
  }
})();
