const Usuarios = {
  _editUserId: null,
  _editAccessUserId: null,

  async callAdmin(action, payload = {}) {
    return Api.request('/functions/v1/admin-user', {
      method: 'POST',
      body: JSON.stringify({
        action,
        organization_id: CONFIG.organizationId,
        ...payload
      })
    });
  },

  roleLabel(role) {
    return {
      owner: 'Administrador principal',
      admin: 'Gestor operacional',
      member: 'Comercial',
      viewer: 'Somente visualização'
    }[role] || 'Comercial';
  },

  async carregar() {
    const container = document.getElementById('listaUsuarios');
    if (!container || !CONFIG.canManageUsers) return;
    container.innerHTML = '<div class="empty-state">Carregando usuários...</div>';
    try {
      const data = await this.callAdmin('list');
      const users = data.users || [];
      if (!users.length) {
        container.innerHTML = '<div class="empty-state">Nenhum usuário cadastrado.</div>';
        return;
      }
      container.innerHTML = '';
      users.forEach(user => {
        const name = user.name || user.email.split('@')[0];
        const protectedOwner = user.role === 'owner';
        const card = document.createElement('div');
        card.className = 'card user-card';
        card.innerHTML =
          '<div class="user-info">' +
            '<div class="user-nome">' + Utils.escapeHTML(name) + '</div>' +
            '<div class="user-email">' + Utils.escapeHTML(user.email) + '</div>' +
            '<div class="user-status ' + (user.active ? 'ativo' : 'inativo') + '">' +
              (user.active ? '● Ativo' : '● Sem acesso') + ' · ' + Utils.escapeHTML(this.roleLabel(user.role)) +
            '</div>' +
          '</div>' +
          '<div class="user-actions">' +
            (!protectedOwner ? '<button class="btn-edit-access" type="button">Acesso</button>' : '') +
            (!protectedOwner ? '<button class="btn-edit-senha" type="button">Senha</button>' : '') +
            (!protectedOwner ? '<button class="btn-toggle-user" type="button">' + (user.active ? 'Desativar' : 'Ativar') + '</button>' : '') +
          '</div>';
        card.querySelector('.btn-edit-access')?.addEventListener('click', () => this.abrirEditAcesso(user.id, name, user.role));
        card.querySelector('.btn-edit-senha')?.addEventListener('click', () => this.abrirEditSenha(user.id, name));
        card.querySelector('.btn-toggle-user')?.addEventListener('click', () => this.toggleUsuario(user.id, user.active));
        container.appendChild(card);
      });
    } catch (error) {
      container.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>';
    }
  },

  abrirNovoUsuario() {
    if (!CONFIG.canManageUsers) return;
    ['novoUsuarioNome', 'novoUsuarioEmail', 'novoUsuarioSenha'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
    const role = document.getElementById('novoUsuarioRole');
    if (role) role.value = 'admin';
    document.getElementById('modalNovoUsuario')?.classList.add('open');
    document.getElementById('novoUsuarioNome')?.focus();
  },

  fecharModalNovoUsuario() {
    document.getElementById('modalNovoUsuario')?.classList.remove('open');
  },

  async criarUsuario() {
    if (!CONFIG.canManageUsers) return;
    const name = Utils.sanitizeText(document.getElementById('novoUsuarioNome')?.value, 100);
    const email = String(document.getElementById('novoUsuarioEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('novoUsuarioSenha')?.value || '';
    const role = document.getElementById('novoUsuarioRole')?.value || 'admin';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Utils.toast('Informe nome e e-mail válidos.', 'erro');
      return;
    }
    if (password.length < 8) {
      Utils.toast('A senha deve ter pelo menos 8 caracteres.', 'erro');
      return;
    }
    try {
      await this.callAdmin('create', { name, email, password, role });
      this.fecharModalNovoUsuario();
      await this.carregar();
      Utils.toast('Usuário criado com segurança.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao criar usuário.'), 'erro');
    }
  },

  abrirEditAcesso(userId, name, role) {
    this._editAccessUserId = userId;
    const label = document.getElementById('editAcessoNome');
    if (label) label.textContent = name;
    const select = document.getElementById('editAcessoRole');
    if (select) select.value = ['admin', 'member', 'viewer'].includes(role) ? role : 'member';
    document.getElementById('modalEditAcesso')?.classList.add('open');
    select?.focus();
  },

  fecharEditAcesso() {
    document.getElementById('modalEditAcesso')?.classList.remove('open');
    this._editAccessUserId = null;
  },

  async salvarAcesso() {
    if (!this._editAccessUserId || !CONFIG.canManageUsers) return;
    const role = document.getElementById('editAcessoRole')?.value || 'member';
    try {
      await this.callAdmin('update_role', { user_id: this._editAccessUserId, role });
      this.fecharEditAcesso();
      await this.carregar();
      Utils.toast('Perfil de acesso atualizado.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao atualizar o acesso.'), 'erro');
    }
  },

  abrirEditSenha(userId, name) {
    this._editUserId = userId;
    const label = document.getElementById('editSenhaNome');
    if (label) label.textContent = name;
    const input = document.getElementById('editSenhaInput');
    if (input) input.value = '';
    document.getElementById('modalEditSenha')?.classList.add('open');
    input?.focus();
  },

  fecharEditSenha() {
    document.getElementById('modalEditSenha')?.classList.remove('open');
    this._editUserId = null;
  },

  async salvarNovaSenha() {
    const password = document.getElementById('editSenhaInput')?.value || '';
    if (password.length < 8) {
      Utils.toast('Use pelo menos 8 caracteres.', 'erro');
      return;
    }
    try {
      await this.callAdmin('update_password', { user_id: this._editUserId, password });
      this.fecharEditSenha();
      Utils.toast('Senha atualizada.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  async toggleUsuario(userId, active) {
    if (!CONFIG.canManageUsers) return;
    try {
      await this.callAdmin('set_active', { user_id: userId, active: !active });
      await this.carregar();
      Utils.toast(active ? 'Usuário desativado.' : 'Usuário ativado.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  abrirAlterarSenha() {
    const input = document.getElementById('novaSenhaInput');
    if (input) input.value = '';
    document.getElementById('modalAlterarSenha')?.classList.add('open');
    input?.focus();
  },

  fecharAlterarSenha() {
    document.getElementById('modalAlterarSenha')?.classList.remove('open');
  },

  async confirmarAlterarSenha() {
    try {
      await Auth.alterarSenha(document.getElementById('novaSenhaInput')?.value || '');
      this.fecharAlterarSenha();
      Utils.toast('Senha alterada com sucesso.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error), 'erro');
    }
  },

  bindEvents() {
    document.getElementById('btnNovoUsuario')?.addEventListener('click', () => this.abrirNovoUsuario());
    document.getElementById('btnCriarUsuario')?.addEventListener('click', () => this.criarUsuario());
    document.getElementById('btnCancelarNovoUsuario')?.addEventListener('click', () => this.fecharModalNovoUsuario());
    document.getElementById('btnSalvarAcesso')?.addEventListener('click', () => this.salvarAcesso());
    document.getElementById('btnCancelarAcesso')?.addEventListener('click', () => this.fecharEditAcesso());
    document.getElementById('btnSalvarSenha')?.addEventListener('click', () => this.salvarNovaSenha());
    document.getElementById('btnCancelarSenha')?.addEventListener('click', () => this.fecharEditSenha());
    document.getElementById('btnConfAlterarSenha')?.addEventListener('click', () => this.confirmarAlterarSenha());
    document.getElementById('btnCancelAlterarSenha')?.addEventListener('click', () => this.fecharAlterarSenha());
  }
};
