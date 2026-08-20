// Configuração pública do frontend. Nunca adicione service_role ou outros segredos aqui.
const CONFIG = {
  APP_NAME: '1K Beats — Gestão de eventos',
  APP_VERSION: 'v6.9.0',
  SUPABASE_URL: 'https://hcjbfdspmqlyzkgypacb.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_muX8-m3AXYd3lOHGGsd23w_iRsXUq7X',
  STORAGE_PREFIX: '1kbeats_v6_',
  LEGACY_STORAGE_PREFIX: '1kbeats_',
  PUBLIC_APP_URL: 'https://1kbeats.github.io/orcamentos/',
  SUPPORT_WHATSAPP: '',
  context: null,

  assertSafe() {
    const key = this.SUPABASE_PUBLISHABLE_KEY || '';
    if (!this.SUPABASE_URL || !key) throw new Error('Supabase não configurado.');
    if (!key.startsWith('sb_publishable_')) {
      throw new Error('Somente uma chave pública publishable pode ser usada no navegador.');
    }
  },

  headers(extra = {}) {
    const sess = this.getSession();
    const headers = {
      apikey: this.SUPABASE_PUBLISHABLE_KEY,
      'Content-Type': 'application/json',
      ...extra
    };
    if (sess?.access_token && !headers.Authorization) {
      headers.Authorization = 'Bearer ' + sess.access_token;
    }
    return headers;
  },

  anonymousHeaders(extra = {}) {
    return {
      apikey: this.SUPABASE_PUBLISHABLE_KEY,
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

  get canManageUsers() {
    return this.role === 'owner';
  },

  get canManageOperations() {
    return this.role === 'owner' || this.role === 'admin';
  },

  get canViewOperations() {
    return this.role === 'owner' || this.role === 'admin' || this.role === 'viewer';
  },

  get canEditCommercial() {
    return this.role === 'owner' || this.role === 'admin' || this.role === 'member';
  },

  get isReadOnly() {
    return this.role === 'viewer';
  },

  publicQuoteUrl(token) {
    const base = this.PUBLIC_APP_URL || window.location.href.replace(/\/[^/?#]*(?:[?#].*)?$/, '/');
    return new URL('ver.html?t=' + encodeURIComponent(token), base).toString();
  }
};

CONFIG.assertSafe();
