// ════════════════════════════════════════════════════════════
// utils.js — Funções utilitárias compartilhadas
// ════════════════════════════════════════════════════════════

const Utils = {

  // Formata valor para moeda brasileira
  fmt(v) {
    return 'R$ ' + parseFloat(v || 0).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  },

  // Formata data ISO para DD/MM/AAAA
  fmtDate(iso) {
    if (!iso) return '';
    const p = iso.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  },

  // Saudação por horário
  saudacao() {
    const h = new Date().getHours();
    return h >= 6 && h < 12 ? 'Bom dia' : h >= 12 && h < 18 ? 'Boa tarde' : 'Boa noite';
  },

  // Toast de notificação
  toast(msg, tipo = 'ok') {
    const el = document.getElementById('toastBox');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast show ' + tipo;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  },

  // Máscara CPF/CNPJ
  mascararDoc(val) {
    const raw = val.replace(/[^0-9]/g, '').slice(0, 14);
    if (raw.length <= 11) {
      return raw.replace(/(\d{3})(\d{3})(\d{3})(\d{0,2})/, (_, a, b, c, d) =>
        d ? `${a}.${b}.${c}-${d}` : c ? `${a}.${b}.${c}` : b ? `${a}.${b}` : a
      );
    }
    return raw.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, (_, a, b, c, d, e) =>
      e ? `${a}.${b}.${c}/${d}-${e}` : d ? `${a}.${b}.${c}/${d}` : `${a}.${b}.${c}`
    );
  },

  // Abre link externo
  abrirLink(url) {
    window.open(url, '_blank');
  },

  // Formata número do orçamento com zeros à esquerda
  fmtNumero(n) {
    return String(n || '').padStart(4, '0');
  }
};
