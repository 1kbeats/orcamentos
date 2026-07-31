// Configuração pública do frontend. Nunca adicione service_role ou outros segredos aqui.
const CONFIG = {
  APP_NAME: '1K Beats Orçamentos',
  APP_VERSION: 'v6.0-secure',
  SUPABASE_URL: 'https://hcjbfdspmqlyzkgypacb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjamJmZHNwbXFseXprZ3lwYWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NDkzMzAsImV4cCI6MjEwMDMyNTMzMH0.tQMrsJ7pMCvUNb2CobEhn6vvFgiKHGDtFFPM_QJFYCQ',
  STORAGE_PREFIX: '1kbeats_v6_',
  LEGACY_STORAGE_PREFIX: '1kbeats_',
  PUBLIC_APP_URL: 'https://1kbeats.github.io/orcamentos/',
  SUPPORT_WHATSAPP: '',
  context: null,

  assertSafe() {
    const key = this.SUPABASE_ANON_KEY || '';
    if (key.startsWith('sb_secret_')) throw new Error('Chave secreta não pode ser usada no navegador.');
    if (!this.SUPABASE_URL || !key) throw new Error('Supabase não configurado.');
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.role && payload.role !== 'anon') {
        throw new Error('Somente a chave pública anon pode ser usada no navegador.');
      }
    } catch (error) {
      if (error.message && error.message.includes('Somente')) throw error;
    }
  },

  headers(extra = {}) {
    const sess = this.getSession();
    return {
      apikey: this.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + (sess?.access_token || this.SUPABASE_ANON_KEY),
      'Content-Type': 'application/json',
      ...extra
    };
  },

  anonymousHeaders(extra = {}) {
    return {
      apikey: this.SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + this.SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...extra
    };
  },

  getSession() {
    for (const prefix of [this.STORAGE_PREFIX, this.LEGACY_STORAGE_PREFIX]) {
      try {
        const value = localStorage.getItem(prefix + 'session');
        if (value) return JSON.parse(value);
      } catch (_) {}
    }
    return null;
  },

  setSession(session) {
    localStorage.setItem(this.STORAGE_PREFIX + 'session', JSON.stringify(session));
    localStorage.removeItem(this.LEGACY_STORAGE_PREFIX + 'session');
  },

  clearSession() {
    localStorage.removeItem(this.STORAGE_PREFIX + 'session');
    localStorage.removeItem(this.LEGACY_STORAGE_PREFIX + 'session');
    this.context = null;
  },

  setContext(context) {
    this.context = context;
  },

  get organizationId() {
    return this.context?.organization_id || null;
  },

  get role() {
    return this.context?.role || 'member';
  },

  get plan() {
    return this.context?.organization?.plan || 'basic';
  },

  get isAdmin() {
    return this.role === 'owner' || this.role === 'admin';
  },

  publicQuoteUrl(token) {
    const base = this.PUBLIC_APP_URL || window.location.href.replace(/\/[^/?#]*(?:[?#].*)?$/, '/');
    return new URL('ver.html?t=' + encodeURIComponent(token), base).toString();
  }
};

CONFIG.assertSafe();
