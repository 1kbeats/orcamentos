// ════════════════════════════════════════════════════════════
// auth.js — Autenticação e controle de sessão
// ════════════════════════════════════════════════════════════

const Auth = {

  // Verifica sessão ao carregar o app
  async verificarSessao() {
    const sess = CONFIG.getSession();
    if (!sess || !sess.access_token) {
      window.location.href = './login.html';
      return;
    }
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/user', {
        headers: {
          'apikey': CONFIG.SUPABASE_ANON_KEY,
          'Authorization': 'Bearer ' + sess.access_token
        }
      });
      if (!res.ok) {
        CONFIG.clearSession();
        window.location.href = './login.html';
        return;
      }
      const user = await res.json();
      this._configurarPerfil(user);
    } catch(e) {
      CONFIG.clearSession();
      window.location.href = './login.html';
    }
  },

  // Configura visibilidade de elementos admin
  _configurarPerfil(user) {
    const email = user.email || '';
    const isAdmin = email.includes('admin');
    const adminEls = document.querySelectorAll('.admin-only');
    adminEls.forEach(el => el.style.display = isAdmin ? '' : 'none');

    const nomeEl = document.getElementById('userNome');
    if (nomeEl) {
      const meta = user.user_metadata || {};
      nomeEl.textContent = meta.nome || email.split('@')[0];
    }
  },

  // Logout
  logout() {
    CONFIG.clearSession();
    window.location.href = './login.html';
  },

  // Alterar senha do próprio usuário
  async alterarSenha(novaSenha) {
    const sess = CONFIG.getSession();
    const res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: {
        'apikey': CONFIG.SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + sess.access_token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ password: novaSenha })
    });
    return res.ok;
  }
};
