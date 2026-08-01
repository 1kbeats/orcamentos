(() => {
  let deferredPrompt = null;

  const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const installButtons = () => Array.from(document.querySelectorAll('[data-pwa-install]'));
  const setButtonsVisible = visible => installButtons().forEach(button => { button.style.display = visible ? '' : 'none'; });

  const closeInstructions = () => document.getElementById('pwaInstallHelp')?.remove();
  const showInstructions = () => {
    closeInstructions();
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const steps = isIOS
      ? ['Toque no botão Compartilhar do Chrome.', 'Escolha “Adicionar à Tela de Início”.', 'Confirme tocando em “Adicionar”.']
      : isAndroid
        ? ['Toque no menu ⋮ do Chrome.', 'Escolha “Instalar app” ou “Adicionar à tela inicial”.', 'Confirme a instalação.']
        : ['Abra o menu do navegador.', 'Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.', 'Confirme a instalação.'];
    const overlay = document.createElement('div');
    overlay.id = 'pwaInstallHelp';
    overlay.className = 'pwa-install-overlay';
    overlay.innerHTML = '<section class="pwa-install-dialog" role="dialog" aria-modal="true" aria-labelledby="pwaInstallTitle"><div class="pwa-install-dialog-head"><div><small>Aplicativo 1K Beats</small><h2 id="pwaInstallTitle">Instalar no celular</h2></div><button class="pwa-install-close" type="button" data-pwa-close aria-label="Fechar">×</button></div><div class="pwa-install-dialog-body">Siga estes passos no seu navegador:<ol class="pwa-install-steps">' + steps.map(step => '<li>' + step + '</li>').join('') + '</ol></div><div class="pwa-install-dialog-actions"><button class="pwa-install-ok" type="button" data-pwa-close>Entendi</button></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelectorAll('[data-pwa-close]').forEach(button => button.addEventListener('click', closeInstructions));
    overlay.addEventListener('click', event => { if (event.target === overlay) closeInstructions(); });
  };

  const requestInstall = async () => {
    if (!deferredPrompt) return showInstructions();
    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    deferredPrompt = null;
    if (result.outcome === 'accepted') setButtonsVisible(false);
  };

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    setButtonsVisible(true);
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    setButtonsVisible(false);
  });

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-pwa-install]');
    if (!button) return;
    event.preventDefault();
    requestInstall();
  });
  document.addEventListener('keydown', event => {
    const button = event.target.closest?.('[data-pwa-install]');
    if (!button || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    requestInstall();
  });

  const initialize = async () => {
    setButtonsVisible(!isStandalone());
    if (!('serviceWorker' in navigator)) return;
    try {
      await navigator.serviceWorker.register('./sw.js?v=6.2.6', { scope: './', updateViaCache: 'none' });
    } catch (_) {}
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();