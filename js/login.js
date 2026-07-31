(function loginPage() {
  const formButton = document.getElementById('btnLogin');
  const emailInput = document.getElementById('usuario');
  const passwordInput = document.getElementById('senha');
  const errorBox = document.getElementById('errMsg');
  const forgotLink = document.getElementById('forgotLink');

  const message = sessionStorage.getItem('1kbeats_login_message');
  if (message) {
    sessionStorage.removeItem('1kbeats_login_message');
    showError(message);
  }

  const session = CONFIG.getSession();
  if (session?.expires_at && Date.now() / 1000 < session.expires_at) {
    window.location.replace('./index.html');
  }

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = 'block';
  }

  async function login() {
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
      showError('Informe seu e-mail e sua senha.');
      return;
    }
    formButton.disabled = true;
    formButton.textContent = 'CONECTANDO...';
    errorBox.style.display = 'none';
    try {
      const response = await fetch(CONFIG.SUPABASE_URL + '/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: CONFIG.anonymousHeaders(),
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok || !data.access_token) throw new Error('E-mail ou senha incorretos.');
      CONFIG.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + (data.expires_in || 3600),
        user: data.user
      });
      window.location.replace('./index.html');
    } catch (error) {
      showError(error.message || 'Não foi possível entrar.');
      formButton.disabled = false;
      formButton.textContent = 'ENTRAR';
    }
  }

  async function recoverPassword(event) {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Digite seu e-mail acima para recuperar a senha.');
      emailInput.focus();
      return;
    }
    try {
      const redirectTo = new URL('./reset-password.html', window.location.href).toString();
      await Api.anonymous('/auth/v1/recover?redirect_to=' + encodeURIComponent(redirectTo), {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      showError('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
    } catch (_) {
      showError('Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.');
    }
  }

  formButton.addEventListener('click', login);
  passwordInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') login();
  });
  emailInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') passwordInput.focus();
  });
  forgotLink?.addEventListener('click', recoverPassword);
})();
