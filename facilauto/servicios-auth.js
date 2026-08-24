/**
 * FACIL AUTO — Auth frontend v1.3.0
 * Login Google + acceso a /cuenta.html
 */

import './assets/js/frontend-v1.3.0.js';

const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';
const TOKEN_KEY = 'facilauto_session_v1';

const PLANS = {
  free: {
    name: 'FREE',
    price: '$0',
    queries: '10 consultas / mes',
    description: 'Para consultas ocasionales y uso personal.'
  },
  standard: {
    name: 'STANDARD',
    price: '$6.990',
    queries: '100 consultas',
    description: 'Más capacidad para usuarios frecuentes.',
    paymentUrl: 'https://mpago.la/2EqR1ks'
  },
  pro: {
    name: 'PRO',
    price: '$19.990',
    queries: '500 consultas',
    description: 'Pensado para uso intensivo y agencias.',
    paymentUrl: 'https://mpago.la/2cQiQ5Z'
  }
};

const authCss = `
.fa-auth{display:flex;align-items:center;gap:10px;margin-left:auto;justify-self:end}
.fa-auth button,.fa-auth-link{appearance:none;border:1px solid #2b2b2b;background:#fff;color:#111;min-height:42px;padding:0 16px;border-radius:3px;font:700 11px/1 Arial,sans-serif;letter-spacing:.05em;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}
.fa-auth button:hover,.fa-auth-link:hover{background:#f2f2f2}
.fa-auth .fa-login,.fa-account-link{background:#111!important;color:#fff!important;border-color:#111!important}
.fa-auth .fa-login:hover,.fa-account-link:hover{background:#292929!important}
.fa-auth-user{display:flex;align-items:center;gap:9px;min-width:0}
.fa-auth-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#ececec;border:1px solid #ddd}
.fa-auth-meta{display:flex;flex-direction:column;min-width:0}
.fa-auth-meta strong{font:700 12px/1.2 Arial,sans-serif;color:#111;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-auth-meta small{font:500 10px/1.2 Arial,sans-serif;color:#777;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-auth-error{position:fixed;left:20px;right:20px;bottom:20px;z-index:10050;background:#181818;color:#fff;padding:12px 16px;border-radius:4px;font:600 12px/1.4 Arial,sans-serif}
@media(max-width:850px){
  .fa-auth-meta{display:none}
  .fa-auth{gap:6px}
  .fa-auth button,.fa-auth-link{padding:0 11px;min-height:38px}
}
@media(max-width:520px){
  .fa-auth-user{display:none}
}
`;

function configured() {
  return API_BASE.startsWith('https://');
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

async function api(path, options = {}) {
  if (!configured()) throw new Error('La conexión de FACIL AUTO no está configurada.');

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

function cleanReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('login_ticket');
  url.searchParams.delete('login');
  return url.toString();
}

function login() {
  const returnTo = cleanReturnUrl();
  window.location.href =
    `${API_BASE.replace(/\/$/,'')}/auth/google?return_to=${encodeURIComponent(returnTo)}`;
}

async function logout() {
  try {
    if (token()) await api('/auth/logout', {method:'POST'});
  } catch (_) {}

  setToken('');
  window.location.href = './index.html';
}

function injectStyles() {
  if (document.getElementById('fa-auth-style')) return;
  const style = document.createElement('style');
  style.id = 'fa-auth-style';
  style.textContent = authCss;
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

function createAvatar(user) {
  if (!user?.picture) return null;
  const img = document.createElement('img');
  img.className = 'fa-auth-avatar';
  img.src = user.picture;
  img.alt = '';
  img.referrerPolicy = 'no-referrer';
  return img;
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

  const avatar = createAvatar(user);
  if (avatar) userWrap.appendChild(avatar);

  const meta = document.createElement('div');
  meta.className = 'fa-auth-meta';

  const name = document.createElement('strong');
  name.textContent = user.name || 'Usuario FACIL AUTO';

  const email = document.createElement('small');
  email.textContent = user.email || '';

  meta.append(name, email);
  userWrap.appendChild(meta);

  const accountLink = document.createElement('a');
  accountLink.className = 'fa-auth-link fa-account-link';
  accountLink.href = './cuenta.html';
  accountLink.textContent = document.body.dataset.page === 'account' ? 'MI CUENTA' : 'MI CUENTA';

  host.append(userWrap, accountLink);
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

  if (!data.token) throw new Error('No se recibió una sesión válida.');
  setToken(data.token);
}

function findHeaderHost() {
  const header = document.querySelector('.topbar') || document.querySelector('header.site-header');
  if (!header) return null;

  let host = header.querySelector('.fa-auth');
  if (host) return host;

  host = document.createElement('div');
  host.className = 'fa-auth';
  host.setAttribute('aria-label', 'Cuenta');

  const oldCta = header.querySelector('.top-cta');
  if (oldCta) oldCta.replaceWith(host);
  else header.appendChild(host);

  return host;
}

function renderAccountLoggedOut() {
  const root = document.getElementById('account-page-root');
  if (!root) return;

  root.innerHTML = `
    <section class="account-empty">
      <span class="account-eyebrow">CUENTA FACIL AUTO</span>
      <h1>Ingresá para ver tu cuenta.</h1>
      <p>Desde acá vas a poder consultar tu plan, tus consultas disponibles y acceder a las opciones Standard y PRO.</p>
      <button type="button" id="account-login-button">INGRESAR CON GOOGLE</button>
    </section>
  `;

  root.querySelector('#account-login-button')?.addEventListener('click', login);
}

function planCard(key) {
  const plan = PLANS[key];
  const article = document.createElement('article');
  article.className = `account-plan account-plan-${key}`;

  article.innerHTML = `
    <div class="account-plan-head">
      <div>
        <small>PLAN</small>
        <h3>${plan.name}</h3>
      </div>
      <div class="account-plan-price">
        <strong>${plan.price}</strong>
        <span>por plan</span>
      </div>
    </div>
    <div class="account-plan-volume">${plan.queries}</div>
    <p>${plan.description}</p>
    <a href="${plan.paymentUrl}" target="_blank" rel="noopener noreferrer">ELEGIR ${plan.name}</a>
  `;
  return article;
}

function renderAccount(user) {
  const root = document.getElementById('account-page-root');
  if (!root) return;

  root.innerHTML = '';

  const intro = document.createElement('section');
  intro.className = 'account-intro';

  const avatar = createAvatar(user);
  if (avatar) {
    avatar.classList.add('account-avatar');
    intro.appendChild(avatar);
  }

  const identity = document.createElement('div');
  identity.innerHTML = `
    <span class="account-eyebrow">MI CUENTA</span>
    <h1>${escapeHtml(user.name || 'Usuario FACIL AUTO')}</h1>
    <p>${escapeHtml(user.email || '')}</p>
  `;
  intro.appendChild(identity);

  const current = document.createElement('section');
  current.className = 'account-current';
  current.innerHTML = `
    <div>
      <small>PLAN ACTUAL</small>
      <strong>FREE</strong>
      <p>Acceso inicial para consultas ocasionales.</p>
    </div>
    <div class="account-current-volume">
      <strong>10</strong>
      <span>consultas / mes</span>
    </div>
  `;

  const plans = document.createElement('section');
  plans.className = 'account-plans-wrap';
  plans.innerHTML = `
    <div class="account-section-head">
      <div>
        <span class="account-eyebrow">PLANES</span>
        <h2>Ampliá tus consultas.</h2>
      </div>
      <p>Elegí el volumen que necesitás. La automatización de acreditación se conectará en la etapa de pagos.</p>
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'account-plans';
  grid.append(planCard('standard'), planCard('pro'));
  plans.appendChild(grid);

  const actions = document.createElement('section');
  actions.className = 'account-actions';
  const back = document.createElement('a');
  back.href = './index.html';
  back.textContent = '← VOLVER A FACIL AUTO';

  const out = document.createElement('button');
  out.type = 'button';
  out.textContent = 'CERRAR SESIÓN';
  out.addEventListener('click', logout);

  actions.append(back, out);

  root.append(intro, current, plans, actions);
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[char]);
}

async function init() {
  injectStyles();

  const host = findHeaderHost();
  if (host) renderLoggedOut(host);

  try {
    await exchangeLoginTicket();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }

  if (!token()) {
    renderAccountLoggedOut();
    return;
  }

  try {
    const data = await api('/api/me');

    if (data.authenticated && data.user) {
      if (host) renderLoggedIn(host, data.user);
      renderAccount(data.user);
      return;
    }

    setToken('');
    renderAccountLoggedOut();
  } catch (err) {
    if (err.status === 401) {
      setToken('');
      renderAccountLoggedOut();
    } else {
      console.error('FACIL AUTO auth:', err);
      showError('No se pudo cargar la cuenta.');
    }
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();

export { api, login, logout, token, PLANS };
