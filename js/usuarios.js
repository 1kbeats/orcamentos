const Usuarios = {
  _editUserId: null,
  _editAccessUserId: null,
  _editPermissions: {},
  modules: [
    ['dashboard','Início','Indicadores e visão geral'],
    ['orcamentos','Orçamentos','Criação, envio e aprovação'],
    ['agenda','Agenda de eventos','Eventos, equipe e ordens de serviço'],
    ['clientes_catalogo','Clientes e catálogo','Cadastros comerciais'],
    ['financeiro','Financeiro','Verbas, custos e resultados'],
    ['despesas','Despesas da empresa','Gastos sem vínculo com evento'],
    ['equipe','Equipe e freelancers','Profissionais e diárias'],
    ['fornecedores','Fornecedores externos','Prestadores e pagamentos'],
    ['estoque','Estoque','Itens e movimentações']
  ],

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

  accessLabel(status) {
    return { active: 'Ativo', activation_pending: 'Ativação pendente', suspended: 'Suspenso' }[status] || 'Ativação pendente';
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
        let name = user.name || user.email.split('@')[0];
        if (user.role === 'owner' && String(name).trim().toLowerCase() === 'admin') name = 'Alessandro Lima';
        const protectedOwner = user.role === 'owner';
        const card = document.createElement('div');
        card.className = 'card user-card';
        card.innerHTML =
          '<div class="user-info">' +
            '<div class="user-nome">' + Utils.escapeHTML(name) + '</div>' +
            '<div class="user-email">' + Utils.escapeHTML(user.email) + '</div>' +
            '<div class="user-status ' + (user.access_status === 'active' ? 'ativo' : user.access_status === 'suspended' ? 'inativo' : 'pendente') + '">' +
              '● ' + Utils.escapeHTML(this.accessLabel(user.access_status)) + ' · ' + Utils.escapeHTML(this.roleLabel(user.role)) +
            '</div>' +
          '</div>' +
          '<div class="user-actions">' +
            (!protectedOwner ? '<button class="btn-edit-access" type="button">Acesso</button>' : '') +
            (!protectedOwner ? '<button class="btn-edit-senha" type="button">Senha</button>' : '') +
            (!protectedOwner ? '<select class="user-access-select" aria-label="Situação do acesso"><option value="active"'+(user.access_status==='active'?' selected':'')+'>Ativo</option><option value="activation_pending"'+(user.access_status==='activation_pending'?' selected':'')+'>Ativação pendente</option><option value="suspended"'+(user.access_status==='suspended'?' selected':'')+'>Suspenso</option></select>' : '') +
          '</div>';
        card.querySelector('.btn-edit-access')?.addEventListener('click', () => this.abrirEditAcesso(user.id, name, user.role, user.permissions || {}));
        card.querySelector('.btn-edit-senha')?.addEventListener('click', () => this.abrirEditSenha(user.id, name));
        card.querySelector('.user-access-select')?.addEventListener('change', event => this.setAccessStatus(user.id, event.target.value));
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
    const status = document.getElementById('novoUsuarioStatus');
    if (status) status.value = 'activation_pending';
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
    const access_status = document.getElementById('novoUsuarioStatus')?.value || 'activation_pending';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Utils.toast('Informe nome e e-mail válidos.', 'erro');
      return;
    }
    if (password.length < 8) {
      Utils.toast('A senha deve ter pelo menos 8 caracteres.', 'erro');
      return;
    }
    try {
      await this.callAdmin('create', { name, email, password, role, access_status });
      this.fecharModalNovoUsuario();
      await this.carregar();
      Utils.toast('Usuário criado com segurança.');
    } catch (error) {
      Utils.toast(Api.friendlyError(error, 'Erro ao criar usuário.'), 'erro');
    }
  },

  abrirEditAcesso(userId, name, role, permissions = {}) {
    this._editAccessUserId = userId;
    this._editPermissions = permissions;
    const label = document.getElementById('editAcessoNome');
    if (label) label.textContent = name;
    const summaryName = document.getElementById('editAcessoNomeResumo');
    if (summaryName) summaryName.textContent = name;
    const roleLabel = document.getElementById('editAcessoPerfil');
    if (roleLabel) roleLabel.textContent = this.roleLabel(role) + ' · usuário ativo';
    const grid = document.getElementById('modulePermissionsGrid');
    if (grid) grid.innerHTML = this.modules.map(([key,title,desc]) => {
      const fallback = role === 'admin' ? 'edit' : role === 'viewer' ? 'view' : (['dashboard','orcamentos','clientes_catalogo'].includes(key) ? 'edit' : 'none');
      const level = ['none','view','edit'].includes(permissions[key]) ? permissions[key] : fallback;
      return '<label class="permission-row"><span><strong>'+Utils.escapeHTML(title)+'</strong><small>'+Utils.escapeHTML(desc)+'</small></span><select data-module="'+key+'"><option value="none"'+(level==='none'?' selected':'')+'>Sem acesso</option><option value="view"'+(level==='view'?' selected':'')+'>Somente visualizar</option><option value="edit"'+(level==='edit'?' selected':'')+'>Visualizar e editar</option></select></label>';
    }).join('') + '<div class="permission-row permission-locked"><span><strong>Usuários e administração</strong><small>Exclusivo do administrador principal</small></span><select disabled><option>Sem acesso</option></select></div>';
    document.getElementById('modalEditAcesso')?.classList.add('open');
    grid?.querySelector('select')?.focus();
  },

  fecharEditAcesso() {
    document.getElementById('modalEditAcesso')?.classList.remove('open');
    this._editAccessUserId = null;
  },

  async salvarAcesso() {
    if (!this._editAccessUserId || !CONFIG.canManageUsers) return;
    const permissions = {};
    document.querySelectorAll('#modulePermissionsGrid select[data-module]').forEach(select => { permissions[select.dataset.module] = select.value; });
    try {
      await this.callAdmin('update_permissions', { user_id: this._editAccessUserId, permissions });
      this.fecharEditAcesso();
      await this.carregar();
      Utils.toast('Permissões atualizadas com segurança.');
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

  async setAccessStatus(userId, accessStatus) {
    if (!CONFIG.canManageUsers) return;
    try {
      await this.callAdmin('set_access_status', { user_id: userId, access_status: accessStatus });
      await this.carregar();
      Utils.toast(accessStatus === 'active' ? 'Acesso liberado.' : accessStatus === 'suspended' ? 'Acesso suspenso.' : 'Acesso aguardando ativação.');
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
    document.querySelectorAll('[data-permission-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = button.dataset.permissionPreset;
      document.querySelectorAll('#modulePermissionsGrid select[data-module]').forEach(select => { select.value = preset === 'operational' ? 'edit' : preset === 'view' ? 'view' : 'none'; });
    }));
    document.getElementById('btnSalvarSenha')?.addEventListener('click', () => this.salvarNovaSenha());
    document.getElementById('btnCancelarSenha')?.addEventListener('click', () => this.fecharEditSenha());
    document.getElementById('btnConfAlterarSenha')?.addEventListener('click', () => this.confirmarAlterarSenha());
    document.getElementById('btnCancelAlterarSenha')?.addEventListener('click', () => this.fecharAlterarSenha());
  }
};
