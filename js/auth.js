// ════════════════════════════════════════════════════════════
// auth.js — Autenticação e controle de sessão
// ════════════════════════════════════════════════════════════

const Auth = {

  // Verifica sessão ao carregar o app
  async verificarSessao() {
    const sess = CONFIG.getSession();

    // Sem sessão — vai para login
    if (!sess || !sess.access_token) {
      window.location.href = './login.html';
      return;
    }

    // Token ainda válido localmente — usa sem chamar o servidor
    const agora = Math.floor(Date.now() / 1000);
    if (sess.expires_at && agora < sess.expires_at - 60) {
      if (sess.user) this._configurarPerfil(sess.user);
      return;
    }

    // Token expirado — tenta renovar com refresh_token
    if (sess.refresh_token) {
      try {
        const res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          headers: { 'apikey': CONFIG.SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: sess.refresh_token })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.access_token) {
            CONFIG.setSession({
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
              user: data.user
            });
            if (data.user) this._configurarPerfil(data.user);
            return;
          }
        }
      } catch(e) { /* segue para login */ }
    }

    // Sem renovação possível — limpa e redireciona
    CONFIG.clearSession();
    window.location.href = './login.html';
  },

  // Configura visibilidade de elementos admin e perfil
  _configurarPerfil(user) {
    const email = user.email || '';
    const meta = user.user_metadata || {};
    const isAdmin = email.includes('admin');
    const plano = meta.plano || 'basico';

    // Configurar menu com perfil
    if (typeof Nav !== 'undefined') {
      Nav.configurarMenu(isAdmin, plano);
    }

    // Nome do usuário na sidebar
    const nomeEl = document.getElementById('userNome');
    if (nomeEl) nomeEl.textContent = meta.nome || email.split('@')[0];

    // Avatar inicial
    const avatarEl = document.querySelector('.sidebar-avatar');
    if (avatarEl) {
      const nome = meta.nome || email.split('@')[0];
      avatarEl.textContent = nome.charAt(0).toUpperCase();
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
