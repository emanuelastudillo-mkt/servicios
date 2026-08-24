/**
 * FACIL AUTO — Login v1.0.0
 * Frontend público.
 *
 * ÚNICA CONFIGURACIÓN QUE PODÉS NECESITAR CAMBIAR:
 * API_BASE, si usás otro subdominio.
 */
const API_BASE = 'https://api.emanuelmkt.com.ar';

const css = `
  .fa-auth{display:flex;align-items:center;gap:10px;margin-left:auto}
  .fa-auth button,.fa-auth a{
    appearance:none;border:1px solid #2b2b2b;background:#fff;color:#111;
    min-height:42px;padding:0 16px;border-radius:3px;font:700 12px/1 Arial,sans-serif;
    letter-spacing:.04em;text-decoration:none;cursor:pointer;white-space:nowrap
  }
  .fa-auth button:hover,.fa-auth a:hover{background:#f2f2f2}
  .fa-auth .fa-login{background:#111;color:#fff;border-color:#111}
  .fa-auth .fa-login:hover{background:#292929}
  .fa-auth-user{display:flex;align-items:center;gap:9px}
  .fa-auth-avatar{
    width:34px;height:34px;border-radius:50%;object-fit:cover;background:#ececec;
    border:1px solid #ddd
  }
  .fa-auth-meta{display:flex;flex-direction:column;min-width:0}
  .fa-auth-meta strong{font:700 12px/1.2 Arial,sans-serif;color:#111;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fa-auth-meta small{font:500 10px/1.2 Arial,sans-serif;color:#777;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .fa-auth-error{position:fixed;left:20px;right:20px;bottom:20px;z-index:9999;background:#181818;color:white;padding:12px 16px;border-radius:4px;font:600 12px/1.4 Arial,sans-serif}
  @media(max-width:850px){
    .fa-auth-meta{display:none}
    .fa-auth{gap:6px}
    .fa-auth button,.fa-auth a{padding:0 11px;min-height:38px}
  }
`;

function injectStyles() {
  if (document.getElementById('fa-auth-style')) return;
  const style = document.createElement('style');
  style.id = 'fa-auth-style';
  style.textContent = css;
  document.head.appendChild(style);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(options.body ? {'Content-Type':'application/json'} : {}),
      ...(options.headers || {})
    },
    ...options
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
  const returnTo = window.location.href.split('#')[0];
  window.location.href = `${API_BASE}/auth/google?return_to=${encodeURIComponent(returnTo)}`;
}

async function logout() {
  try {
    await api('/auth/logout', {method:'POST'});
  } finally {
    window.location.reload();
  }
}

function showError(message) {
  const old = document.querySelector('.fa-auth-error');
  if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'fa-auth-error';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function targetHeader() {
  return document.querySelector('.topbar') || document.querySelector('header') || document.body;
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
  out.addEventListener('click', () => logout().catch(() => showError('No se pudo cerrar la sesión.')));

  host.append(userWrap, out);
}

async function init() {
  injectStyles();

  const host = document.createElement('div');
  host.className = 'fa-auth';
  host.setAttribute('aria-label', 'Cuenta');

  const header = targetHeader();

  // En la topbar actual reemplaza visualmente al CTA derecho.
  const oldCta = header.querySelector?.('.top-cta');
  if (oldCta) oldCta.replaceWith(host);
  else header.appendChild(host);

  renderLoggedOut(host);

  try {
    const data = await api('/api/me');
    if (data.authenticated && data.user) renderLoggedIn(host, data.user);
  } catch (err) {
    if (err.status !== 401) {
      console.error('FACIL AUTO auth:', err);
    }
  }

  const params = new URLSearchParams(location.search);
  if (params.get('login') === 'ok') {
    params.delete('login');
    const clean = `${location.pathname}${params.toString() ? '?' + params : ''}${location.hash}`;
    history.replaceState({}, '', clean);
  }
  if (params.get('login') === 'error') {
    showError('No se pudo iniciar sesión con Google.');
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

export { api, login, logout };
