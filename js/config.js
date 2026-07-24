// ════════════════════════════════════════════════════════════
// config.js — Configurações centralizadas da 1K Beats
// Para mudar de projeto Supabase, edite apenas este arquivo
// ════════════════════════════════════════════════════════════

const CONFIG = {
  EMPRESA: '1K Beats',
  APP_VERSION: 'v1.5',

  SUPABASE_URL: 'https://hcjbfdspmqlyzkgypacb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjamJmZHNwbXFseXprZ3lwYWNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NDkzMzAsImV4cCI6MjEwMDMyNTMzMH0.tQMrsJ7pMCvUNb2CobEhn6vvFgiKHGDtFFPM_QJFYCQ',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjamJmZHNwbXFseXprZ3lwYWNiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDc0OTMzMCwiZXhwIjoyMTAwMzI1MzMwfQ.glyjZXNs4jUBHDEH0XcIqQU-7PK0np5i490YY2nArEw',

  STORAGE_PREFIX: '1kbeats_',

  // Helpers para montar headers padrão
  headers() {
    const sess = this.getSession();
    const token = sess ? sess.access_token : this.SUPABASE_ANON_KEY;
    return {
      'apikey': this.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };
  },

  headersService() {
    return {
      'apikey': this.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + this.SUPABASE_SERVICE_KEY,
      'Content-Type': 'application/json'
    };
  },

  getSession() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_PREFIX + 'session') || 'null');
    } catch(e) { return null; }
  },

  setSession(s) {
    localStorage.setItem(this.STORAGE_PREFIX + 'session', JSON.stringify(s));
  },

  clearSession() {
    localStorage.removeItem(this.STORAGE_PREFIX + 'session');
  }
};
