const Auth = {
  user: null,

  async verificarSessao() {
    let session = CONFIG.getSession();
    if (!session?.access_token) {
      this.redirectToLogin();
      return false;
    }
    const now = Math.floor(Date.now() / 1000);
    if (!session.expires_at || now >= session.expires_at - 60) {
      session = await this.renovarSessao(session);
      if (!session) {
        this.redirectToLogin();
        return false;
      }
    }
    try {
      const user = await Api.request('/auth/v1/user');
      this.user = user;
      await this.carregarContexto(user);
      this.configurarPerfil(user);
      return true;
    } catch (error) {
      CONFIG.clearSession();
      sessionStorage.setItem('1kbeats_login_message', Api.friendlyError(error, 'Usuário sem acesso a uma empresa.'));
      this.redirectToLogin();
      return false;
    }
  },

  async renovarSessao(session) {
    if (!session?.refresh_token) return null;
    try {
      const response = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: CONFIG.anonymousHeaders(),
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });
      if (!response.ok) return null;
      const data = await response.json();
      const renewed = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        user: data.user
      };
      CONFIG.setSession(renewed);
      return renewed;
    } catch (_) {
      return null;
    }
  },

  async buscarMembro(userId) {
    const path = '/rest/v1/organization_members' +
      '?select=organization_id,role,organizations(id,name,slug,plan,status)' +
      '&user_id=eq.' + encodeURIComponent(userId) +
      '&limit=1';
    const memberships = await Api.request(path);
    return memberships?.[0] || null;
  },

  async carregarContexto(user) {
    let membership = await this.buscarMembro(user.id);
    if (!membership) {
      const suggestedName = user.user_metadata?.company_name || user.user_metadata?.empresa || '1000 Beats';
      await Api.request('/rest/v1/rpc/bootstrap_organization', {
        method: 'POST',
        body: JSON.stringify({ p_name: suggestedName })
      });
      membership = await this.buscarMembro(user.id);
    }
    if (!membership?.organization_id || membership.organizations?.status !== 'active') {
      throw new Error('Seu usuário ainda não foi vinculado a uma empresa ativa.');
    }
    CONFIG.setContext({
      organization_id: membership.organization_id,
      role: membership.role,
      organization: membership.organizations
    });
  },

  configurarPerfil(user) {
    document.body.dataset.role = CONFIG.role;
    Nav.configurarMenu();
    const name = user.user_metadata?.name || user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário';
    const nameElement = document.getElementById('userNome');
    const avatar = document.querySelector('.sidebar-avatar');
    if (nameElement) nameElement.textContent = name;
    if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
    const company = document.getElementById('activeCompanyName');
    if (company) company.textContent = CONFIG.context.organization?.name || '';
    const roleElement = document.getElementById('activeRoleName');
    const roleLabels = {
      owner: 'Administrador principal',
      admin: 'Gestor operacional',
      member: 'Comercial',
      viewer: 'Somente visualização'
    };
    if (roleElement) roleElement.textContent = roleLabels[CONFIG.role] || 'Usuário';
  },

  redirectToLogin() {
    if (!window.location.pathname.endsWith('/login.html')) window.location.replace('./login.html');
  },

  async logout() {
    if (CONFIG.getSession()?.access_token) {
      try {
        await fetch(CONFIG.SUPABASE_URL + '/auth/v1/logout', { method: 'POST', headers: CONFIG.headers() });
      } catch (_) {}
    }
    CONFIG.clearSession();
    window.location.replace('./login.html');
  },

  async alterarSenha(newPassword) {
    if (!newPassword || newPassword.length < 8) throw new Error('Use pelo menos 8 caracteres.');
    await Api.request('/auth/v1/user', {
      method: 'PUT',
      body: JSON.stringify({ password: newPassword })
    });
    return true;
  }
};
