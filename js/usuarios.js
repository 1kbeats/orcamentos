// ════════════════════════════════════════════════════════════
// usuarios.js — Módulo de administração de usuários
// ════════════════════════════════════════════════════════════

const Usuarios = {

  _editUserId: null,

  carregar() {
    const container = document.getElementById('listaUsuarios');
    if (!container) return;
    container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Carregando...</div>';
    fetch(CONFIG.SUPABASE_URL + '/auth/v1/admin/users', { headers: CONFIG.headersService() })
      .then(r => r.json())
      .then(data => {
        const users = data.users || [];
        if (users.length === 0) { container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Nenhum usuário.</div>'; return; }
        container.innerHTML = '';
        users.forEach(u => {
          const div = document.createElement('div');
          div.className = 'card user-card';
          const meta = u.user_metadata || {};
          const nome = meta.nome || u.email.split('@')[0];
          const ativo = !u.banned_until;
          div.innerHTML =
            '<div class="user-info">' +
              '<div class="user-nome">' + nome + '</div>' +
              '<div class="user-email">' + u.email + '</div>' +
              '<div class="user-status ' + (ativo ? 'ativo' : 'inativo') + '">' + (ativo ? '● Ativo' : '● Inativo') + '</div>' +
            '</div>' +
            '<div class="user-actions">' +
              '<button class="btn-edit-senha" data-id="' + u.id + '" data-nome="' + nome + '">Senha</button>' +
              '<button class="btn-toggle-user" data-id="' + u.id + '" data-desativar="' + ativo + '">' + (ativo ? 'Desativar' : 'Ativar') + '</button>' +
            '</div>';
          div.querySelector('.btn-edit-senha').addEventListener('click', (e) => {
            this.abrirEditSenha(e.target.dataset.id, e.target.dataset.nome);
          });
          div.querySelector('.btn-toggle-user').addEventListener('click', (e) => {
            this.toggleUsuario(e.target.dataset.id, e.target.dataset.desativar === 'true');
          });
          container.appendChild(div);
        });
      })
      .catch(() => { container.innerHTML = '<div style="color:#999;padding:2rem;text-align:center">Erro ao carregar usuários.</div>'; });
  },

  abrirNovoUsuario() {
    document.getElementById('novoUsuarioEmail').value = '';
    document.getElementById('novoUsuarioNome').value = '';
    document.getElementById('novoUsuarioSenha').value = '';
    document.getElementById('modalNovoUsuario').classList.add('open');
    document.getElementById('novoUsuarioNome').focus();
  },

  fecharModalNovoUsuario() {
    document.getElementById('modalNovoUsuario').classList.remove('open');
  },

  async criarUsuario() {
    const nome  = document.getElementById('novoUsuarioNome').value.trim();
    const senha = document.getElementById('novoUsuarioSenha').value;
    if (!nome || !senha) { Utils.toast('Informe nome e senha.'); return; }
    const email = nome.toLowerCase().replace(/\s+/g, '.') + '@1kbeats.interno';
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/functions/v1/criar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.SUPABASE_ANON_KEY },
        body: JSON.stringify({ email, password: senha, nome })
      });
      const data = await res.json();
      if (data.error) { Utils.toast('Erro: ' + data.error); return; }
      this.fecharModalNovoUsuario();
      this.carregar();
      Utils.toast('Usuário criado: ' + email);
    } catch(e) {
      Utils.toast('Erro ao criar usuário.');
    }
  },

  abrirEditSenha(userId, nome) {
    this._editUserId = userId;
    document.getElementById('editSenhaNome').textContent = nome;
    document.getElementById('editSenhaInput').value = '';
    document.getElementById('modalEditSenha').classList.add('open');
    document.getElementById('editSenhaInput').focus();
  },

  fecharEditSenha() {
    document.getElementById('modalEditSenha').classList.remove('open');
    this._editUserId = null;
  },

  async salvarNovaSenha() {
    const senha = document.getElementById('editSenhaInput').value;
    if (!senha || senha.length < 6) { Utils.toast('Mínimo 6 caracteres.'); return; }
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/admin/users/' + this._editUserId, {
        method: 'PUT', headers: CONFIG.headersService(), body: JSON.stringify({ password: senha })
      });
      if (res.ok) { this.fecharEditSenha(); Utils.toast('Senha alterada!'); }
      else Utils.toast('Erro ao alterar senha.');
    } catch(e) { Utils.toast('Erro ao alterar senha.'); }
  },

  async toggleUsuario(userId, desativar) {
    const payload = desativar ? { banned_until: '2099-01-01T00:00:00Z' } : { banned_until: null };
    try {
      const res = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
        method: 'PUT', headers: CONFIG.headersService(), body: JSON.stringify(payload)
      });
      if (res.ok) { this.carregar(); Utils.toast(desativar ? 'Usuário desativado.' : 'Usuário ativado.'); }
      else Utils.toast('Erro ao alterar usuário.');
    } catch(e) { Utils.toast('Erro ao alterar usuário.'); }
  },

  // Alterar a própria senha
  abrirAlterarSenha() {
    document.getElementById('novaSenhaInput').value = '';
    document.getElementById('modalAlterarSenha').classList.add('open');
    document.getElementById('novaSenhaInput').focus();
  },

  fecharAlterarSenha() {
    document.getElementById('modalAlterarSenha').classList.remove('open');
  },

  async confirmarAlterarSenha() {
    const senha = document.getElementById('novaSenhaInput').value;
    if (!senha || senha.length < 6) { Utils.toast('Mínimo 6 caracteres.'); return; }
    const ok = await Auth.alterarSenha(senha);
    if (ok) { this.fecharAlterarSenha(); Utils.toast('Senha alterada com sucesso!'); }
    else Utils.toast('Erro ao alterar senha.');
  },

  bindEvents() {
    const btnNovo = document.getElementById('btnNovoUsuario');
    if (btnNovo) btnNovo.addEventListener('click', () => this.abrirNovoUsuario());

    const btnCriar = document.getElementById('btnCriarUsuario');
    if (btnCriar) btnCriar.addEventListener('click', () => this.criarUsuario());

    const btnCancelarNovo = document.getElementById('btnCancelarNovoUsuario');
    if (btnCancelarNovo) btnCancelarNovo.addEventListener('click', () => this.fecharModalNovoUsuario());

    const btnSalvarSenha = document.getElementById('btnSalvarSenha');
    if (btnSalvarSenha) btnSalvarSenha.addEventListener('click', () => this.salvarNovaSenha());

    const btnCancelarSenha = document.getElementById('btnCancelarSenha');
    if (btnCancelarSenha) btnCancelarSenha.addEventListener('click', () => this.fecharEditSenha());

    const btnConfAlterarSenha = document.getElementById('btnConfAlterarSenha');
    if (btnConfAlterarSenha) btnConfAlterarSenha.addEventListener('click', () => this.confirmarAlterarSenha());

    const btnCancelAlterarSenha = document.getElementById('btnCancelAlterarSenha');
    if (btnCancelAlterarSenha) btnCancelAlterarSenha.addEventListener('click', () => this.fecharAlterarSenha());
  }
};
