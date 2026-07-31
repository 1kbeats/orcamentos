(function resetPasswordPage() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get('access_token');
  const button = document.getElementById('btnResetPassword');
  const password = document.getElementById('newPassword');
  const confirmPassword = document.getElementById('confirmPassword');
  const message = document.getElementById('resetMessage');

  function show(text, error = false) {
    message.textContent = text;
    message.className = error ? 'reset-message error' : 'reset-message success';
  }

  if (!accessToken || params.get('type') !== 'recovery') {
    show('Este link é inválido ou expirou. Solicite uma nova recuperação.', true);
    button.disabled = true;
  }

  button.addEventListener('click', async () => {
    if (password.value.length < 8) {
      show('Use pelo menos 8 caracteres.', true);
      return;
    }
    if (password.value !== confirmPassword.value) {
      show('As senhas não coincidem.', true);
      return;
    }
    button.disabled = true;
    try {
      const response = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/user', {
        method: 'PUT',
        headers: {
          apikey: CONFIG.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password: password.value })
      });
      if (!response.ok) throw new Error();
      history.replaceState(null, '', window.location.pathname);
      show('Senha alterada. Você já pode entrar.');
      setTimeout(() => window.location.replace('./login.html'), 1800);
    } catch (_) {
      show('Não foi possível alterar a senha. Solicite um novo link.', true);
      button.disabled = false;
    }
  });
})();
