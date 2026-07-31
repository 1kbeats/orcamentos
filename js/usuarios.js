const Usuarios = {
  _editUserId: null,

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

  async carregar() {
    const container = document.getElementById('listaUsuarios');
    if (!container || !CONFIG.isAdmin) return;
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
        const roleLabel = { owner: 'Proprietário', admin: 'Administrador', member: 'Colaborador' }[user.role] || 'Colaborador';
        const card = document.createElement('div');
        card.className = 'card user-card';
        card.innerHTML =
          '<div class="user-info">' +
            '<div class="user-nome">' + Utils.escapeHTML(name) + '</div>' +
            '<div class="user-email">' + Utils.escapeHTML(user.email) + '</div>' +
            '<div class="user-status ' + (user.active ? 'ativo' : 'inativo') + '">' +
              (user.active ? '● Ativo' : '● Inativo') + ' · ' + Utils.escapeHTML(roleLabel) +
            '</div>' +
          '</div>' +
          '<div class="user-actions">' +
            (user.role !== 'owner' ? '<button class="btn-edit-senha" type="button">Senha</button>' : '') +
            (user.role !== 'owner' ? '<button class="btn-toggle-user" type="button">' + (user.active ? 'Desativar' : 'Ativar') + '</button>' : '') +
          '</div>';
        const passwordButton = card.querySelector('.btn-edit-senha');
        const toggleButton = card.querySelector('.btn-toggle-user');
        if (passwordButton) passwordButton.addEventListener('click', () => this.abrirEditSenha(user.id, name));
        if (toggleButton) toggleButton.addEventListener('click', () => this.toggleUsuario(user.id, user.active));
        container.appendChild(card);
      });
    } catch (error) {
      container.innerHTML = '<div class="empty-state error-state">' + Utils.escapeHTML(Api.friendlyError(error)) + '</div>';
    }
  },

  abrirNovoUsuario() {
    if (!CONFIG.isAdmin) return;
    ['novoUsuarioNome', 'novoUsuarioEmail', 'novoUsuarioSenha'].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = '';
    });
    const role = document.getElementById('novoUsuarioRole');
    if (role) role.value = 'member';
    document.getElementById('modalNovoUsuario')?.classList.add('open');
    document.getElementById('novoUsuarioNome')?.focus();
  },

  fecharModalNovoUsuario() {
    document.getElementById('modalNovoUsuario')?.classList.remove('open');
  },

  async criarUsuario() {
    const name = Utils.sanitizeText(document.getElementById('novoUsuarioNome')?.value, 100);
    const email = String(document.getElementById('novoUsuarioEmail')?.value || '').trim().toLowerCase();
    const password = document.getElementById('novoUsuarioSenha')?.value || '';
    const role = document.getElementById('novoUsuarioRole')?.value || 'member';
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
    document.getElementById('btnSalvarSenha')?.addEventListener('click', () => this.salvarNovaSenha());
    document.getElementById('btnCancelarSenha')?.addEventListener('click', () => this.fecharEditSenha());
    document.getElementById('btnConfAlterarSenha')?.addEventListener('click', () => this.confirmarAlterarSenha());
    document.getElementById('btnCancelAlterarSenha')?.addEventListener('click', () => this.fecharAlterarSenha());
  }
};
