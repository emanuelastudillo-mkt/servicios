/**
 * FACIL AUTO — Login Google v1.1.0
 * Funciona con la web actual + Cloudflare Workers Free (*.workers.dev).
 *
 * PASO OBLIGATORIO:
 * reemplazá PEGAR_AQUI_URL_WORKER por la URL que Cloudflare te muestre,
 * por ejemplo: https://facilauto-auth.usuario.workers.dev
 */
const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';

const TOKEN_KEY = 'facilauto_session_v1';

const css = `
.fa-auth{display:flex;align-items:center;gap:10px;margin-left:auto}
.fa-auth button{appearance:none;border:1px solid #2b2b2b;background:#fff;color:#111;min-height:42px;padding:0 16px;border-radius:3px;font:700 12px/1 Arial,sans-serif;letter-spacing:.04em;cursor:pointer;white-space:nowrap}
.fa-auth button:hover{background:#f2f2f2}
.fa-auth .fa-login{background:#111;color:#fff;border-color:#111}
.fa-auth .fa-login:hover{background:#292929}
.fa-auth-user{display:flex;align-items:center;gap:9px}
.fa-auth-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#ececec;border:1px solid #ddd}
.fa-auth-meta{display:flex;flex-direction:column;min-width:0}
.fa-auth-meta strong{font:700 12px/1.2 Arial,sans-serif;color:#111;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-auth-meta small{font:500 10px/1.2 Arial,sans-serif;color:#777;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-auth-error{position:fixed;left:20px;right:20px;bottom:20px;z-index:9999;background:#181818;color:#fff;padding:12px 16px;border-radius:4px;font:600 12px/1.4 Arial,sans-serif}
@media(max-width:850px){.fa-auth-meta{display:none}.fa-auth{gap:6px}.fa-auth button{padding:0 11px;min-height:38px}}
`;

function configured() {
  return API_BASE.startsWith('https://') && !API_BASE.includes('PEGAR_AQUI');
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  if (!configured()) throw new Error('Falta configurar la URL del Worker en servicios-auth.js.');

  const headers = {
    'Accept': 'application/json',
    ...(options.body ? {'Content-Type':'application/json'} : {}),
    ...(options.headers || {})
  };
  if (token()) headers.Authorization = `Bearer ${token()}`;

  const response = await fetch(`${API_BASE.replace(/\/$/,'')}${path}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

function login() {
  if (!configured()) {
    showError('Primero configurá la URL del Worker en servicios-auth.js.');
    return;
  }
  const returnTo = window.location.href.split('#')[0].split('?')[0];
  window.location.href =
    `${API_BASE.replace(/\/$/,'')}/auth/google?return_to=${encodeURIComponent(returnTo)}`;
}

async function logout() {
  try {
    if (token()) await api('/auth/logout', {method:'POST'});
  } catch (_) {
    // La sesión local se elimina igualmente.
  }
  setToken('');
  window.location.reload();
}

function injectStyles() {
  if (document.getElementById('fa-auth-style')) return;
  const style = document.createElement('style');
  style.id = 'fa-auth-style';
  style.textContent = css;
  document.head.appendChild(style);
}

function showError(message) {
  document.querySelector('.fa-auth-error')?.remove();
  const el = document.createElement('div');
  el.className = 'fa-auth-error';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 6000);
}

function renderLoggedOut(host) {
  host.innerHTML = '';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fa-login';
  button.textContent = 'INGRESAR';
  button.addEventListener('click', login);
  host.appendChild(button);
}

function renderLoggedIn(host, user) {
  host.innerHTML = '';

  const userWrap = document.createElement('div');
  userWrap.className = 'fa-auth-user';

  if (user.picture) {
    const img = document.createElement('img');
    img.className = 'fa-auth-avatar';
    img.src = user.picture;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    userWrap.appendChild(img);
  }

  const meta = document.createElement('div');
  meta.className = 'fa-auth-meta';

  const name = document.createElement('strong');
  name.textContent = user.name || 'Mi cuenta';

  const email = document.createElement('small');
  email.textContent = user.email || '';

  meta.append(name, email);
  userWrap.appendChild(meta);

  const out = document.createElement('button');
  out.type = 'button';
  out.textContent = 'SALIR';
  out.addEventListener('click', logout);

  host.append(userWrap, out);
}

async function exchangeLoginTicket() {
  const url = new URL(window.location.href);
  const ticket = url.searchParams.get('login_ticket');
  const loginError = url.searchParams.get('login');

  if (loginError === 'error') {
    url.searchParams.delete('login');
    history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    throw new Error('No se pudo iniciar sesión con Google.');
  }

  if (!ticket) return;

  url.searchParams.delete('login_ticket');
  history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);

  const data = await api('/auth/exchange', {
    method: 'POST',
    body: JSON.stringify({ticket})
  });

  if (!data.token) throw new Error('Cloudflare no devolvió la sesión.');
  setToken(data.token);
}

async function init() {
  injectStyles();

  const header = document.querySelector('.topbar') || document.querySelector('header');
  if (!header) return;

  const host = document.createElement('div');
  host.className = 'fa-auth';
  host.setAttribute('aria-label', 'Cuenta');

  const oldCta = header.querySelector('.top-cta');
  if (oldCta) oldCta.replaceWith(host);
  else header.appendChild(host);

  renderLoggedOut(host);

  if (!configured()) {
    console.warn('FACIL AUTO: falta configurar API_BASE en servicios-auth.js');
    return;
  }

  try {
    await exchangeLoginTicket();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }

  if (!token()) return;

  try {
    const data = await api('/api/me');
    if (data.authenticated && data.user) {
      renderLoggedIn(host, data.user);
    }
  } catch (err) {
    if (err.status === 401) setToken('');
    else console.error('FACIL AUTO auth:', err);
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

export { api, login, logout };
