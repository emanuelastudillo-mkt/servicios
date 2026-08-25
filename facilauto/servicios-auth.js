/**
 * FACIL AUTO — Auth + Consultas + Admin v1.5.7
 * Login Google + acceso a /cuenta.html · v1.3.1
 */

const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';
const TOKEN_KEY = 'facilauto_session_v1';

const SITE_ROOT = new URL('./', import.meta.url);
const siteUrl = (path = '') => new URL(path, SITE_ROOT).toString();


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

let currentAccount = null;
let currentIsAdmin = false;
let consultationGateInstalled = false;

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

.fa-auth.fa-auth-logged{justify-self:end}
.fa-account-global{
  gap:9px!important;
  padding:4px 12px 4px 5px!important;
  min-height:44px!important;
  border-radius:999px!important;
  background:#111!important;
  color:#fff!important;
  border:1px solid #111!important;
}
.fa-account-global:hover{background:#2a2a2a!important}
.fa-account-global .fa-auth-avatar,
.fa-account-global-avatar{
  width:34px!important;
  height:34px!important;
  border-radius:50%!important;
  object-fit:cover!important;
  border:1px solid rgba(255,255,255,.25)!important;
  background:#eee!important;
  flex:0 0 34px!important;
}
.fa-account-global-label{
  display:inline-flex;
  align-items:center;
  font:800 10px/1 Arial,sans-serif;
  letter-spacing:.08em;
  white-space:nowrap;
}
.fa-account-global-fallback{
  width:34px;
  height:34px;
  border-radius:50%;
  display:grid;
  place-items:center;
  background:#fff;
  color:#111;
  font:800 12px/1 Arial,sans-serif;
  flex:0 0 34px;
}

.fa-admin-account-link{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height:42px;
  padding:0 16px;
  border:1px solid #111;
  background:#111;
  color:#fff!important;
  text-decoration:none!important;
  font:800 10px/1 Arial,sans-serif;
  letter-spacing:.07em;
}
.fa-admin-account-link:hover{background:#2b2b2b}
.fa-consult-submit[disabled]{opacity:.62;cursor:wait!important}
.fa-consult-submit[data-empty="1"]{background:#6d6b65!important}
@media(max-width:850px){
  .fa-auth-meta{display:none}
  .fa-auth{gap:6px}
  .fa-auth button,.fa-auth-link{padding:0 11px;min-height:38px}
}
@media(max-width:520px){
  .fa-auth-user{display:none}
  .fa-account-global{
    min-height:40px!important;
    padding:3px 10px 3px 4px!important;
    gap:7px!important;
  }
  .fa-account-global .fa-auth-avatar,
  .fa-account-global-avatar,
  .fa-account-global-fallback{
    width:32px!important;
    height:32px!important;
    flex-basis:32px!important;
  }
  .fa-account-global-label{font-size:9px}
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
  const params = new URLSearchParams(window.location.search);
  const embeddedReturn =
    params.get('embed') === '1' ? params.get('share_url') : '';

  const returnTo = embeddedReturn || cleanReturnUrl();
  const authUrl =
    `${API_BASE.replace(/\/$/,'')}/auth/google?return_to=${encodeURIComponent(returnTo)}`;

  if (window.top !== window.self) {
    window.top.location.href = authUrl;
  } else {
    window.location.href = authUrl;
  }
}

async function logout() {
  try {
    if (token()) await api('/auth/logout', {method:'POST'});
  } catch (_) {}

  setToken('');
  window.location.href = siteUrl('index.html');
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
  host.classList.remove('fa-auth-logged');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fa-login';
  button.textContent = 'INGRESAR';
  button.addEventListener('click', login);
  host.appendChild(button);
}

function renderLoggedIn(host, user) {
  host.innerHTML = '';
  host.classList.add('fa-auth-logged');

  const accountLink = document.createElement('a');
  accountLink.className = 'fa-auth-link fa-account-link fa-account-global';
  accountLink.href = siteUrl('mi-cuenta/');
  accountLink.setAttribute('aria-label', 'Mi cuenta');

  const avatar = createAvatar(user);
  if (avatar) {
    avatar.classList.add('fa-account-global-avatar');
    accountLink.appendChild(avatar);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'fa-account-global-fallback';
    fallback.textContent = (user?.name || user?.email || 'U').trim().charAt(0).toUpperCase();
    accountLink.appendChild(fallback);
  }

  const label = document.createElement('span');
  label.className = 'fa-account-global-label';
  label.textContent = 'MI CUENTA';

  accountLink.appendChild(label);
  host.appendChild(accountLink);
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

function renderAccount(user, account = currentAccount, isAdmin = currentIsAdmin) {
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

  const planName = String(account?.plan || 'free').toUpperCase();
  const available = Math.max(0, Number(account?.available ?? 0));
  const monthlyLimit = Math.max(0, Number(account?.monthly_limit ?? 10));
  const used = Math.max(0, Number(account?.used ?? 0));
  const bonus = Math.max(0, Number(account?.bonus_credits ?? 0));

  const current = document.createElement('section');
  current.className = 'account-current';
  current.innerHTML = `
    <div>
      <small>PLAN ACTUAL</small>
      <strong>${escapeHtml(planName)}</strong>
      <p>${used} usadas de ${monthlyLimit} este mes${bonus ? ` · ${bonus} adicionales` : ''}.</p>
    </div>
    <div class="account-current-volume">
      <strong>${available}</strong>
      <span>consultas disponibles</span>
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
  back.href = siteUrl('index.html');
  back.textContent = '← VOLVER A FACIL AUTO';

  const out = document.createElement('button');
  out.type = 'button';
  out.textContent = 'CERRAR SESIÓN';
  out.addEventListener('click', logout);

  actions.append(back);

  if (isAdmin) {
    const admin = document.createElement('a');
    admin.href = siteUrl('admin.html');
    admin.className = 'fa-admin-account-link';
    admin.textContent = 'PANEL DE CONTROL';
    actions.appendChild(admin);
  }

  actions.append(out);

  root.append(intro, current, plans, actions);
}


function consultationButton() {
  return document.querySelector('#vehicle-form .calc-submit button[type="submit"]');
}

function updateConsultationButton() {
  const button = consultationButton();
  if (!button) return;

  button.classList.add('fa-consult-submit');

  if (!token()) {
    button.dataset.empty = '0';
    button.innerHTML = 'CALCULAR OPERACIÓN <span>INGRESAR →</span>';
    button.setAttribute('aria-label', 'Ingresar para hacer una consulta');
    return;
  }

  if (!currentAccount) {
    button.dataset.empty = '0';
    button.innerHTML = 'CALCULAR OPERACIÓN <span>… →</span>';
    button.setAttribute('aria-label', 'Cargando consultas disponibles');
    return;
  }

  const available = Math.max(0, Number(currentAccount.available) || 0);
  button.dataset.empty = available <= 0 ? '1' : '0';
  button.innerHTML = `CALCULAR OPERACIÓN <span>(${available}) →</span>`;
  button.setAttribute(
    'aria-label',
    `Calcular operación. ${available} consultas disponibles`
  );
}

async function refreshAccount() {
  if (!token()) {
    currentAccount = null;
    updateConsultationButton();
    return null;
  }

  const data = await api('/api/me');
  currentAccount = data.account || null;
  updateConsultationButton();
  return data;
}

async function consultationGate(form) {
  const button = consultationButton();

  if (!token()) {
    showError('Tenés que iniciar sesión para hacer una consulta.');

    if (window.FACIL_AUTO_GATE?.login) {
      window.FACIL_AUTO_GATE.login();
    } else {
      login();
    }
    return;
  }

  if (!currentAccount) {
    try {
      await refreshAccount();
    } catch (err) {
      if (err.status === 401) {
        setToken('');
        currentAccount = null;
        updateConsultationButton();

        if (window.FACIL_AUTO_GATE?.login) {
          window.FACIL_AUTO_GATE.login();
        } else {
          login();
        }
        return;
      }

      showError('No se pudo comprobar tus consultas disponibles.');
      return;
    }
  }

  const available = Math.max(0, Number(currentAccount?.available) || 0);

  if (available <= 0) {
    showError('No te quedan consultas disponibles. Podés ampliar tu plan desde Planes.');

    setTimeout(() => {
      const destination = siteUrl('planes/');
      if (window.top !== window.self) window.top.location.href = destination;
      else window.location.href = destination;
    }, 700);

    return;
  }

  if (button) button.disabled = true;

  try {
    const data = await api('/api/consultations/use', {method:'POST'});
    currentAccount = data.account || currentAccount;
    updateConsultationButton();

    // Solamente después de que el Worker debitó la consulta,
    // autorizamos UN submit para app.js.
    if (!window.FACIL_AUTO_GATE) {
      throw new Error('consultation_gate_missing');
    }

    window.FACIL_AUTO_GATE.allowOnce = true;

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
    } else {
      form.dispatchEvent(new Event('submit', {
        bubbles:true,
        cancelable:true
      }));
    }
  } catch (err) {
    if (err.status === 401) {
      setToken('');
      currentAccount = null;
      updateConsultationButton();
      showError('Tu sesión venció. Volvé a ingresar.');

      setTimeout(() => {
        if (window.FACIL_AUTO_GATE?.login) window.FACIL_AUTO_GATE.login();
        else login();
      }, 450);
      return;
    }

    if (err.status === 402 || err.message === 'no_consultations_left') {
      try {
        const data = await api('/api/me');
        currentAccount = data.account || currentAccount;
      } catch (_) {}

      updateConsultationButton();
      showError('No te quedan consultas disponibles.');
      return;
    }

    showError('No se pudo registrar la consulta. Intentá nuevamente.');
    console.error('FACIL AUTO credits:', err);
  } finally {
    if (button) button.disabled = false;
  }
}

function installConsultationGate() {
  if (consultationGateInstalled) return;

  const form = document.getElementById('vehicle-form');
  if (!form) return;

  if (!window.FACIL_AUTO_GATE) {
    showError('No se pudo inicializar el control de consultas.');
    return;
  }

  window.FACIL_AUTO_GATE.handler = consultationGate;
  window.FACIL_AUTO_GATE.authReady = true;
  consultationGateInstalled = true;

  updateConsultationButton();
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

  installConsultationGate();

  try {
    await exchangeLoginTicket();
  } catch (err) {
    console.error(err);
    showError(err.message);
  }

  if (!token()) {
    currentAccount = null;
    currentIsAdmin = false;
    updateConsultationButton();
    renderAccountLoggedOut();
    return;
  }

  try {
    const data = await api('/api/me');

    if (data.authenticated && data.user) {
      currentAccount = data.account || null;
      currentIsAdmin = Boolean(data.is_admin);
      updateConsultationButton();

      if (host) renderLoggedIn(host, data.user);
      renderAccount(data.user, currentAccount, currentIsAdmin);
      return;
    }

    setToken('');
    currentAccount = null;
    currentIsAdmin = false;
    updateConsultationButton();
    renderAccountLoggedOut();
  } catch (err) {
    if (err.status === 401) {
      setToken('');
      currentAccount = null;
      currentIsAdmin = false;
      updateConsultationButton();
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

export { api, login, logout, token, PLANS, refreshAccount };
