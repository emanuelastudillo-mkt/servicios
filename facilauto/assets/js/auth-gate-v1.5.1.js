/**
 * FACIL AUTO — Fail-closed consultation gate v1.5.1
 *
 * Se carga ANTES de app.js.
 * Si la capa de autenticación no está lista, la calculadora queda bloqueada.
 */

(() => {
  const TOKEN_KEY = 'facilauto_session_v1';
  const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';

  const gate = window.FACIL_AUTO_GATE = window.FACIL_AUTO_GATE || {
    handler: null,
    allowOnce: false
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

  function login() {
    const target =
      `${API_BASE}/auth/google?return_to=${encodeURIComponent(returnTo())}`;

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

      // FAIL CLOSED:
      // app.js jamás recibe este submit si el gate no lo autorizó.
      event.preventDefault();
      event.stopImmediatePropagation();

      if (typeof gate.handler === 'function') {
        gate.handler(form);
        return;
      }

      const hasLocalSession = Boolean(localStorage.getItem(TOKEN_KEY));

      if (hasLocalSession) {
        show('Estamos verificando tu sesión. Intentá nuevamente en un instante.');
        return;
      }

      show('Tenés que iniciar sesión para hacer una consulta.');
      setTimeout(login, 250);
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
