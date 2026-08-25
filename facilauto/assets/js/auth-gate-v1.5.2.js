/**
 * FACIL AUTO — Fail-closed consultation gate v1.5.12
 * Se carga ANTES de app.js.
 */
(() => {
  const TOKEN_KEY = 'facilauto_session_v1';
  const REFERRAL_KEY = 'facilauto_referral_v1';
  const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';

  const gate = window.FACIL_AUTO_GATE = window.FACIL_AUTO_GATE || {
    handler: null,
    allowOnce: false,
    authReady: false
  };

  function returnTo() {
    const params = new URLSearchParams(location.search);

    if (params.get('embed') === '1' && params.get('share_url')) {
      return params.get('share_url');
    }

    const url = new URL(location.href);
    url.searchParams.delete('login_ticket');
    url.searchParams.delete('login');
    return url.toString();
  }

  function referral() {
    const params = new URLSearchParams(location.search);
    const direct = String(params.get('ref') || '').trim();

    if (/^[A-Za-z0-9_-]{6,32}$/.test(direct)) {
      localStorage.setItem(REFERRAL_KEY, direct);
      return direct;
    }

    const stored = String(localStorage.getItem(REFERRAL_KEY) || '').trim();
    return /^[A-Za-z0-9_-]{6,32}$/.test(stored) ? stored : '';
  }

  function login() {
    const ref = referral();
    const target =
      `${API_BASE}/auth/google?return_to=${encodeURIComponent(returnTo())}` +
      (ref ? `&ref=${encodeURIComponent(ref)}` : '');

    if (window.top !== window.self) {
      window.top.location.href = target;
    } else {
      window.location.href = target;
    }
  }

  function show(message) {
    document.querySelector('.fa-gate-message')?.remove();

    const el = document.createElement('div');
    el.className = 'fa-gate-message';
    el.textContent = message;

    Object.assign(el.style, {
      position:'fixed',
      left:'20px',
      right:'20px',
      bottom:'20px',
      zIndex:'10060',
      background:'#181818',
      color:'#fff',
      padding:'12px 16px',
      borderRadius:'4px',
      font:'600 12px/1.4 Arial,sans-serif'
    });

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  const form = document.getElementById('vehicle-form');

  if (form) {
    form.addEventListener('submit', event => {
      if (gate.allowOnce === true) {
        gate.allowOnce = false;
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();

      if (typeof gate.handler === 'function') {
        gate.handler(form);
        return;
      }

      show('Ingresá para hacer una consulta.');
      setTimeout(login, 180);
    }, true);
  }

  const cta = document.querySelector('[data-auth-entry]');
  if (cta) {
    cta.addEventListener('click', event => {
      event.preventDefault();
      login();
    });
  }

  const button = document.querySelector(
    '#vehicle-form .calc-submit button[type="submit"]'
  );

  if (button && !localStorage.getItem(TOKEN_KEY)) {
    button.innerHTML = 'CALCULAR OPERACIÓN <span>INGRESAR →</span>';
  }

  gate.login = login;
})();
