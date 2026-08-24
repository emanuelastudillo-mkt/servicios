/**
 * FACIL AUTO — Login + Mi Cuenta v1.2.0
 * Frontend para Cloudflare Workers (*.workers.dev)
 */

const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';

const TOKEN_KEY = 'facilauto_session_v1';

const PLANS = {
  free: {
    name: 'FREE',
    price: '$0',
    queries: '10 consultas / mes',
    description: 'Para probar FACIL AUTO y realizar consultas ocasionales.'
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

const css = `
.fa-auth{display:flex;align-items:center;gap:10px;margin-left:auto}
.fa-auth button{appearance:none;border:1px solid #2b2b2b;background:#fff;color:#111;min-height:42px;padding:0 16px;border-radius:3px;font:700 12px/1 Arial,sans-serif;letter-spacing:.04em;cursor:pointer;white-space:nowrap}
.fa-auth button:hover{background:#f2f2f2}
.fa-auth .fa-login{background:#111;color:#fff;border-color:#111}
.fa-auth .fa-login:hover{background:#292929}
.fa-auth-user{display:flex;align-items:center;gap:9px;min-width:0}
.fa-auth-avatar{width:34px;height:34px;border-radius:50%;object-fit:cover;background:#ececec;border:1px solid #ddd}
.fa-auth-meta{display:flex;flex-direction:column;min-width:0}
.fa-auth-meta strong{font:700 12px/1.2 Arial,sans-serif;color:#111;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-auth-meta small{font:500 10px/1.2 Arial,sans-serif;color:#777;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-account-btn{background:#111!important;color:#fff!important;border-color:#111!important}
.fa-account-btn:hover{background:#292929!important}
.fa-auth-error{position:fixed;left:20px;right:20px;bottom:20px;z-index:10050;background:#181818;color:#fff;padding:12px 16px;border-radius:4px;font:600 12px/1.4 Arial,sans-serif}

/* MI CUENTA */
.fa-account-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;pointer-events:none;transition:opacity .18s ease}
.fa-account-overlay.is-open{opacity:1;pointer-events:auto}
.fa-account-panel{width:min(920px,100%);max-height:min(760px,calc(100vh - 48px));overflow:auto;background:#f7f7f5;color:#111;border-radius:12px;box-shadow:0 28px 80px rgba(0,0,0,.32);transform:translateY(10px);transition:transform .18s ease}
.fa-account-overlay.is-open .fa-account-panel{transform:translateY(0)}
.fa-account-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding:30px 32px 24px;border-bottom:1px solid #deded9}
.fa-account-title{margin:0;font:800 28px/1.05 Arial,sans-serif;letter-spacing:-.035em}
.fa-account-kicker{margin:0 0 7px;font:700 10px/1 Arial,sans-serif;letter-spacing:.13em;color:#777}
.fa-account-close{appearance:none;border:0;background:transparent;color:#111;width:40px;height:40px;border-radius:50%;font:400 28px/1 Arial,sans-serif;cursor:pointer}
.fa-account-close:hover{background:#e9e9e5}
.fa-account-body{padding:28px 32px 32px}
.fa-account-profile{display:flex;align-items:center;gap:14px;margin-bottom:28px}
.fa-account-profile .fa-auth-avatar{width:52px;height:52px}
.fa-account-profile-text{display:flex;flex-direction:column;min-width:0}
.fa-account-profile-text strong{font:800 16px/1.25 Arial,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-account-profile-text span{margin-top:3px;font:500 12px/1.3 Arial,sans-serif;color:#6f6f6a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fa-account-section-title{margin:0 0 13px;font:800 13px/1 Arial,sans-serif;letter-spacing:.04em}
.fa-current-plan{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:22px;background:#111;color:#fff;border-radius:8px;margin-bottom:30px}
.fa-current-label{display:inline-flex;align-items:center;width:max-content;padding:6px 9px;border:1px solid rgba(255,255,255,.28);border-radius:100px;font:700 9px/1 Arial,sans-serif;letter-spacing:.1em}
.fa-current-plan h3{margin:12px 0 4px;font:800 22px/1 Arial,sans-serif}
.fa-current-plan p{margin:0;color:#c9c9c9;font:500 12px/1.4 Arial,sans-serif}
.fa-current-queries{text-align:right}
.fa-current-queries strong{display:block;font:800 18px/1.1 Arial,sans-serif}
.fa-current-queries span{display:block;margin-top:4px;color:#aaa;font:600 10px/1.2 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}
.fa-plan-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.fa-plan-card{display:flex;flex-direction:column;min-height:240px;padding:24px;border:1px solid #d9d9d4;background:#fff;border-radius:8px}
.fa-plan-top{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}
.fa-plan-name{margin:0;font:800 18px/1 Arial,sans-serif}
.fa-plan-price{text-align:right;font:800 21px/1 Arial,sans-serif}
.fa-plan-price small{display:block;margin-top:4px;color:#8a8a85;font:600 9px/1.2 Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase}
.fa-plan-queries{margin:28px 0 7px;font:800 20px/1.15 Arial,sans-serif}
.fa-plan-desc{margin:0 0 22px;color:#70706b;font:500 12px/1.45 Arial,sans-serif}
.fa-plan-pay{display:flex;align-items:center;justify-content:center;margin-top:auto;min-height:44px;padding:0 15px;border-radius:4px;background:#111;color:#fff!important;text-decoration:none!important;font:800 11px/1 Arial,sans-serif;letter-spacing:.06em}
.fa-plan-pay:hover{background:#292929}
.fa-payment-note{margin:14px 0 0;color:#85857f;font:500 10px/1.45 Arial,sans-serif}
.fa-account-footer{display:flex;justify-content:flex-end;margin-top:26px;padding-top:20px;border-top:1px solid #deded9}
.fa-account-logout{appearance:none;border:0;background:transparent;color:#666;padding:8px 0;font:700 10px/1 Arial,sans-serif;letter-spacing:.08em;cursor:pointer}
.fa-account-logout:hover{color:#111}

@media(max-width:850px){
  .fa-auth-meta{display:none}
  .fa-auth{gap:6px}
  .fa-auth button{padding:0 11px;min-height:38px}
  .fa-account-overlay{padding:0;align-items:flex-end}
  .fa-account-panel{width:100%;max-height:92vh;border-radius:14px 14px 0 0}
  .fa-account-head{padding:24px 20px 19px}
  .fa-account-body{padding:22px 20px 28px}
  .fa-account-title{font-size:24px}
  .fa-current-plan{grid-template-columns:1fr}
  .fa-current-queries{text-align:left}
  .fa-plan-grid{grid-template-columns:1fr}
  .fa-plan-card{min-height:220px}
}
@media(max-width:520px){
  .fa-auth-user{display:none}
}
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

function createAvatar(user, className = 'fa-auth-avatar') {
  if (!user.picture) return null;

  const img = document.createElement('img');
  img.className = className;
  img.src = user.picture;
  img.alt = '';
  img.referrerPolicy = 'no-referrer';

  return img;
}

function planCard(planKey) {
  const plan = PLANS[planKey];

  const card = document.createElement('article');
  card.className = 'fa-plan-card';

  const top = document.createElement('div');
  top.className = 'fa-plan-top';

  const name = document.createElement('h3');
  name.className = 'fa-plan-name';
  name.textContent = plan.name;

  const price = document.createElement('div');
  price.className = 'fa-plan-price';
  price.innerHTML = `${plan.price}<small>pago por plan</small>`;

  top.append(name, price);

  const queries = document.createElement('div');
  queries.className = 'fa-plan-queries';
  queries.textContent = plan.queries;

  const desc = document.createElement('p');
  desc.className = 'fa-plan-desc';
  desc.textContent = plan.description;

  const pay = document.createElement('a');
  pay.className = 'fa-plan-pay';
  pay.href = plan.paymentUrl;
  pay.target = '_blank';
  pay.rel = 'noopener noreferrer';
  pay.textContent = `ELEGIR ${plan.name}`;

  card.append(top, queries, desc, pay);

  return card;
}

function createAccountPanel(user) {
  document.querySelector('.fa-account-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'fa-account-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('section');
  panel.className = 'fa-account-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', 'Mi cuenta');

  const head = document.createElement('header');
  head.className = 'fa-account-head';

  const titleWrap = document.createElement('div');

  const kicker = document.createElement('p');
  kicker.className = 'fa-account-kicker';
  kicker.textContent = 'FACIL AUTO';

  const title = document.createElement('h2');
  title.className = 'fa-account-title';
  title.textContent = 'Mi cuenta';

  titleWrap.append(kicker, title);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'fa-account-close';
  close.setAttribute('aria-label', 'Cerrar');
  close.textContent = '×';

  head.append(titleWrap, close);

  const body = document.createElement('div');
  body.className = 'fa-account-body';

  const profile = document.createElement('div');
  profile.className = 'fa-account-profile';

  const avatar = createAvatar(user);
  if (avatar) profile.appendChild(avatar);

  const profileText = document.createElement('div');
  profileText.className = 'fa-account-profile-text';

  const profileName = document.createElement('strong');
  profileName.textContent = user.name || 'Usuario FACIL AUTO';

  const profileEmail = document.createElement('span');
  profileEmail.textContent = user.email || '';

  profileText.append(profileName, profileEmail);
  profile.appendChild(profileText);

  const currentTitle = document.createElement('h3');
  currentTitle.className = 'fa-account-section-title';
  currentTitle.textContent = 'PLAN ACTUAL';

  const current = document.createElement('div');
  current.className = 'fa-current-plan';

  const currentInfo = document.createElement('div');
  currentInfo.innerHTML = `
    <span class="fa-current-label">PLAN ACTUAL</span>
    <h3>${PLANS.free.name}</h3>
    <p>${PLANS.free.description}</p>
  `;

  const currentQueries = document.createElement('div');
  currentQueries.className = 'fa-current-queries';
  currentQueries.innerHTML = `
    <strong>${PLANS.free.queries}</strong>
    <span>incluidas</span>
  `;

  current.append(currentInfo, currentQueries);

  const plansTitle = document.createElement('h3');
  plansTitle.className = 'fa-account-section-title';
  plansTitle.textContent = 'AMPLIAR CONSULTAS';

  const grid = document.createElement('div');
  grid.className = 'fa-plan-grid';
  grid.append(planCard('standard'), planCard('pro'));

  const note = document.createElement('p');
  note.className = 'fa-payment-note';
  note.textContent = 'Pago mediante Mercado Pago. En esta etapa, la acreditación del plan requiere validación del pago.';

  const footer = document.createElement('div');
  footer.className = 'fa-account-footer';

  const logoutButton = document.createElement('button');
  logoutButton.type = 'button';
  logoutButton.className = 'fa-account-logout';
  logoutButton.textContent = 'CERRAR SESIÓN';
  logoutButton.addEventListener('click', logout);

  footer.appendChild(logoutButton);

  body.append(profile, currentTitle, current, plansTitle, grid, note, footer);
  panel.append(head, body);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function open() {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    setTimeout(() => close.focus(), 0);
  }

  function hide() {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  close.addEventListener('click', hide);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) hide();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && overlay.classList.contains('is-open')) hide();
  });

  return {open, hide};
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
  name.textContent = user.name || 'Mi cuenta';

  const email = document.createElement('small');
  email.textContent = user.email || '';

  meta.append(name, email);
  userWrap.appendChild(meta);

  const account = createAccountPanel(user);

  const accountButton = document.createElement('button');
  accountButton.type = 'button';
  accountButton.className = 'fa-account-btn';
  accountButton.textContent = 'MI CUENTA';
  accountButton.addEventListener('click', account.open);

  host.append(userWrap, accountButton);
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
