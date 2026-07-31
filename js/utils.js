const Utils = {
  fmt(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
      .format(Number(value) || 0);
  },

  fmtDate(iso) {
    if (!iso) return '';
    const date = new Date(String(iso).length === 10 ? iso + 'T12:00:00' : iso);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR');
  },

  saudacao() {
    const hour = new Date().getHours();
    return hour >= 6 && hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  },

  toast(message, type = 'ok') {
    const element = document.getElementById('toastBox');
    if (!element) return;
    element.textContent = String(message || '');
    element.className = 'toast show ' + type;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => element.classList.remove('show'), 4000);
  },

  escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  safeId(value) {
    return String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  },

  sanitizeText(value, maxLength = 500) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);
  },

  mascararDoc(value) {
    const raw = String(value || '').replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 11) {
      return raw
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return raw
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  },

  normalizePhone(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 13);
  },

  openExternal(url) {
    const parsed = new URL(url, window.location.href);
    if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('Link inválido.');
    window.open(parsed.toString(), '_blank', 'noopener,noreferrer');
  },

  fmtNumero(number) {
    return String(number || '').padStart(4, '0');
  },

  downloadCSV(filename, rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      this.toast('Não há dados para exportar.', 'erro');
      return;
    }
    const headers = Object.keys(rows[0]);
    const quote = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
    const csv = '\uFEFF' + [
      headers.map(quote).join(';'),
      ...rows.map(row => headers.map(key => quote(row[key])).join(';'))
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
};
