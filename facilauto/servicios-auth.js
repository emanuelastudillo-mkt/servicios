/**
 * FACIL AUTO — Auth + Consultas + Admin + Planes + Referidos + Marca + Mobile + Draft + Insurance + Admin Refill + NoFlash + CTA v1.5.27
 * Login Google + acceso a /cuenta.html · v1.3.1
 */

const API_BASE = 'https://facilauto-auth.emanuelastudillo.workers.dev';
const TOKEN_KEY = 'facilauto_session_v1';
const REFERRAL_KEY = 'facilauto_referral_v1';
const FRONTEND_VERSION = '1.5.27';
const INSTAGRAM_URL = 'https://www.instagram.com/facilauto.ok';

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
let currentProductSettings = {
  plans:{free:true,standard:false,pro:false},
  referrals:{enabled:true,reward_credits:20}
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

.fa-plan-disabled{display:none!important}
.fa-referral-account{
  margin-top:26px;
  padding:24px;
  border:1px solid #111;
  background:#f7f5ef;
}
.fa-referral-account h2{margin:5px 0 8px;font-size:28px;letter-spacing:-.04em}
.fa-referral-account p{margin:0;color:#6d6b65;font:13px/1.55 Georgia,"Times New Roman",serif}
.fa-referral-link-row{display:flex;gap:8px;margin-top:18px}
.fa-referral-link-row input{
  flex:1;min-width:0;height:42px;border:1px solid #aaa;background:#fff;padding:0 12px;
  font:600 11px/1 Arial,sans-serif
}
.fa-referral-link-row button{
  min-height:42px;padding:0 14px;border:1px solid #111;background:#111;color:#fff;
  font:800 9px/1 Arial,sans-serif;letter-spacing:.07em;cursor:pointer
}
.fa-referral-stats{display:flex;gap:22px;margin-top:16px}
.fa-referral-stats span{font-size:9px;color:#777}
.fa-referral-stats strong{color:#111;font-size:14px}
.fa-referral-public-card .seo-plan-price{font-size:30px}
.fa-plan-unavailable-note{
  margin-top:16px;padding:12px 14px;border:1px solid #111;background:#f4f1e9;
  font:12px/1.5 Georgia,"Times New Roman",serif
}
@media(max-width:600px){
  .fa-referral-link-row{flex-direction:column}
  .fa-referral-link-row button{width:100%}
}



/* Contraste global FACIL AUTO */
.calculator-section{
  color:#fbfaf7!important;
}
.calculator-section .section-title h2,
.calculator-section .block-head span,
.calculator-section .calc-submit button,
.calculator-section input,
.calculator-section select{
  color:#fff!important;
}
.calculator-section .block-head small,
.calculator-section label>span,
.calculator-section .settings summary,
.calculator-section .calc-submit p{
  color:#aaa89f!important;
}
.calculator-section .section-title p{
  color:#e94f32!important;
}

.seo-tool{
  color:#fbfaf7!important;
}
.seo-tool h1,
.seo-tool h2,
.seo-tool h3,
.seo-tool strong{
  color:#fff!important;
}
.seo-tool .seo-kicker{
  color:#e94f32!important;
}
.seo-tool .seo-tool-head>p{
  color:#aaa89f!important;
}

.magic-stats,
.magic-instagram,
.magic-data-pulse,
.fa-floating-quote{
  color:#fff!important;
}
.magic-stats strong,
.magic-instagram h2,
.magic-instagram strong,
.magic-instagram a,
.magic-data-pulse b{
  color:#fff!important;
}

.fa-floating-quote{
  position:fixed;
  right:22px;
  bottom:22px;
  z-index:10020;
  display:flex;
  align-items:stretch;
  background:#01A5BC;
  color:#fff;
  border:1px solid #01A5BC;
  box-shadow:0 10px 28px rgba(0,0,0,.16);
  transform:translateY(18px);
  opacity:0;
  pointer-events:none;
  transition:opacity .28s ease,transform .28s ease;
}
.fa-floating-quote.is-visible{
  transform:none;
  opacity:1;
  pointer-events:auto;
}
.fa-floating-quote>a{
  min-height:50px;
  display:flex;
  align-items:center;
  gap:18px;
  padding:0 18px;
  color:#fff!important;
  text-decoration:none!important;
  font:800 10px/1 Arial,sans-serif;
  letter-spacing:.09em;
  text-transform:uppercase;
}
.fa-floating-quote>a span{
  color:#fff;
  font-size:18px;
  font-weight:400;
  transition:transform .2s ease;
}
.fa-floating-quote>a:hover{
  background:rgba(0,0,0,.06);
}
.fa-floating-quote>a:hover span{
  transform:translateX(4px);
}
.fa-floating-quote-close{
  width:42px;
  min-height:50px;
  border:0;
  border-left:1px solid rgba(255,255,255,.42);
  background:transparent;
  color:#fff;
  cursor:pointer;
  font:300 19px/1 Arial,sans-serif;
}
.fa-floating-quote-close:hover{
  background:rgba(0,0,0,.08);
}
@media(max-width:620px){
  .fa-floating-quote{
    right:14px;
    bottom:14px;
    max-width:calc(100vw - 28px);
  }
  .fa-floating-quote>a{
    min-height:46px;
    padding:0 14px;
    gap:12px;
    font-size:9px;
  }
  .fa-floating-quote-close{
    width:40px;
    min-height:46px;
  }
}
@media(prefers-reduced-motion:reduce){
  .fa-floating-quote{
    transition:none;
  }
}

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



function isEmbeddedTool() {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  } catch (_) {
    return false;
  }
}

function isAdminArea() {
  return /\/facilauto\/admin(?:\/|\.html|$)/.test(window.location.pathname);
}

function plansMenuLink() {
  const nav = document.querySelector('.topnav');
  if (!nav || isAdminArea() || isEmbeddedTool()) return null;

  let link =
    nav.querySelector('[data-fa-plans-menu]') ||
    [...nav.querySelectorAll('a')].find(a =>
      /(^|\/)planes\/?(?:$|[?#])/.test(a.href) ||
      a.textContent.trim().toUpperCase() === 'PLANES'
    );

  if (!link) {
    link = document.createElement('a');
    link.href = siteUrl('planes/');
    link.textContent = 'Planes';
    nav.appendChild(link);
  }

  link.dataset.faPlansMenu = '1';
  return link;
}

function syncPlansMenu(account = currentAccount) {
  const link = plansMenuLink();
  if (!link) return;

  const plan = String(account?.plan || 'free').trim().toLowerCase();
  const hasPaidPlan = Boolean(account) && plan !== 'free';

  link.hidden = hasPaidPlan;
  link.setAttribute('aria-hidden', hasPaidPlan ? 'true' : 'false');

  if (hasPaidPlan) {
    link.tabIndex = -1;
  } else {
    link.removeAttribute('tabindex');
  }
}

function ensureInstagramLink() {
  if (isAdminArea() || isEmbeddedTool()) return;

  const footer = document.querySelector('footer');
  if (!footer) return;

  let link = footer.querySelector('[data-fa-instagram]');
  if (link) return;

  link = document.createElement('a');
  link.href = INSTAGRAM_URL;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Instagram';
  link.dataset.faInstagram = '1';

  const host =
    footer.querySelector('.seo-footer-links') ||
    footer.querySelector('.footer-links') ||
    footer.querySelector('.site-footer-links');

  if (host) {
    host.appendChild(link);
  } else {
    link.style.marginLeft = '14px';
    footer.appendChild(link);
  }
}

function syncVisibleVersion() {
  document.querySelectorAll('footer p').forEach(el => {
    if (/v\d+\.\d+\.\d+/.test(el.textContent || '')) {
      el.textContent = el.textContent.replace(
        /v\d+\.\d+\.\d+/g,
        `v${FRONTEND_VERSION}`
      );
    }
  });
}

function syncGlobalUi(account = currentAccount) {
  syncPlansMenu(account);
  ensureInstagramLink();
  ensureFloatingQuote();
  syncVisibleVersion();
}



function brandUrl(path) {
  return siteUrl(`assets/brand/${path}`);
}


function ensureMobilePolishStylesheet() {
  if (document.querySelector('link[data-fa-mobile-polish]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = siteUrl(`assets/css/mobile-polish.css?v=${FRONTEND_VERSION}`);
  link.dataset.faMobilePolish = '1';
  document.head.appendChild(link);
}


function ensureBrandCriticalStyles() {
  if (document.getElementById('fa-brand-critical')) return;

  const style = document.createElement('style');
  style.id = 'fa-brand-critical';
  style.textContent = `
    .fa-brand-header{
      display:inline-flex!important;
      align-items:center!important;
      width:auto!important;
      line-height:1!important;
    }
    .fa-brand-header img,
    .fa-brand-footer img{
      object-fit:contain!important;
    }
    .fa-brand-header-logotipo{
      display:block!important;
      width:154px!important;
      height:auto!important;
      max-height:51px!important;
    }
    .fa-brand-header-isotipo{
      display:none!important;
      width:42px!important;
      height:42px!important;
    }
    .fa-brand-footer{
      display:inline-flex!important;
      align-items:center!important;
      width:auto!important;
      line-height:1!important;
    }
    .fa-brand-footer img{
      display:block!important;
      width:86px!important;
      height:auto!important;
      max-height:65px!important;
    }
    @media(max-width:980px){
      .fa-brand-header-logotipo{
        display:none!important;
      }
      .fa-brand-header-isotipo{
        display:block!important;
      }
    }
    @media(max-width:520px){
      .fa-brand-header-isotipo{
        width:36px!important;
        height:36px!important;
      }
      .fa-brand-footer img{
        width:72px!important;
        max-height:54px!important;
      }
    }
  `;

  document.head.appendChild(style);
}

function ensureBrandStylesheet() {
  if (document.querySelector('link[data-fa-brand-css]')) return;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = siteUrl(`assets/css/brand.css?v=${FRONTEND_VERSION}`);
  link.dataset.faBrandCss = '1';
  document.head.appendChild(link);
}

function ensureBrandFavicons() {
  const faviconHref = brandUrl('favicon.ico');
  const pngHref = brandUrl('favicon.png');
  const appleHref = brandUrl('apple-touch-icon.png');

  document.querySelectorAll(
    'link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]'
  ).forEach(link => link.remove());

  const ico = document.createElement('link');
  ico.rel = 'icon';
  ico.href = faviconHref;
  ico.type = 'image/x-icon';

  const png = document.createElement('link');
  png.rel = 'icon';
  png.href = pngHref;
  png.type = 'image/png';
  png.sizes = '192x192';

  const apple = document.createElement('link');
  apple.rel = 'apple-touch-icon';
  apple.href = appleHref;
  apple.sizes = '180x180';

  document.head.append(ico, png, apple);
}

function applyBrandToWordmarks() {
  document.querySelectorAll('.topbar .wordmark').forEach(link => {
    if (link.dataset.faBrandApplied === 'header') return;

    link.dataset.faBrandApplied = 'header';
    link.classList.add('fa-brand-header');
    link.setAttribute('aria-label', 'FACIL AUTO');

    link.innerHTML = `
      <img
        class="fa-brand-header-logotipo"
        src="${brandUrl('facil-auto-logotipo.png')}"
        width="154"
        height="51"
        alt="FACIL AUTO"
      >
      <img
        class="fa-brand-header-isotipo"
        src="${brandUrl('facil-auto-isotipo.png')}"
        width="42"
        height="42"
        alt=""
        aria-hidden="true"
      >
    `;
  });

  document.querySelectorAll('footer .wordmark').forEach(link => {
    if (link.dataset.faBrandApplied === 'footer') return;

    link.dataset.faBrandApplied = 'footer';
    link.classList.add('fa-brand-footer');
    link.setAttribute('aria-label', 'FACIL AUTO');

    link.innerHTML = `
      <img
        src="${brandUrl('facil-auto-logo.png')}"
        width="86"
        height="65"
        alt="FACIL AUTO"
      >
    `;
  });
}

function applyBrandIdentity() {
  ensureBrandCriticalStyles();
  ensureBrandStylesheet();
  ensureMobilePolishStylesheet();
  ensureBrandFavicons();
  applyBrandToWordmarks();
}



function ensureFloatingQuote() {
  if (isAdminArea() || isEmbeddedTool()) return;
  if (sessionStorage.getItem('facilauto_quote_closed_v1') === '1') return;
  if (document.querySelector('.fa-floating-quote')) return;

  const box = document.createElement('div');
  box.className = 'fa-floating-quote';
  box.setAttribute('role', 'complementary');
  box.setAttribute('aria-label', 'Cotizar auto');

  const link = document.createElement('a');
  link.href = siteUrl('cuanto-vale-mi-auto/');
  link.innerHTML = 'COTIZAR AUTO <span aria-hidden="true">→</span>';
  link.setAttribute('aria-label', 'Cotizar auto');

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'fa-floating-quote-close';
  close.innerHTML = '×';
  close.setAttribute('aria-label', 'Cerrar acceso rápido');

  close.addEventListener('click', () => {
    box.classList.remove('is-visible');
    sessionStorage.setItem('facilauto_quote_closed_v1', '1');

    window.setTimeout(() => box.remove(), 280);
  });

  box.append(link, close);
  document.body.appendChild(box);

  window.setTimeout(() => {
    box.classList.add('is-visible');
  }, 650);
}


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


function captureReferralFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = String(url.searchParams.get('ref') || '').trim();

    if (/^[A-Za-z0-9_-]{6,32}$/.test(code)) {
      localStorage.setItem(REFERRAL_KEY, code);
      url.searchParams.delete('ref');
      history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  } catch (_) {}
}

function storedReferral() {
  const code = String(localStorage.getItem(REFERRAL_KEY) || '').trim();
  return /^[A-Za-z0-9_-]{6,32}$/.test(code) ? code : '';
}

async function loadProductSettings() {
  try {
    const data = await api('/api/public/settings');
    if (data?.settings) currentProductSettings = data.settings;
  } catch (err) {
    console.warn('FACIL AUTO settings:', err);
  }

  applyProductSettingsToStaticPages();
  return currentProductSettings;
}

function enabledPaidPlans() {
  return ['standard','pro'].filter(key => currentProductSettings?.plans?.[key]);
}

function applyProductSettingsToStaticPages() {
  const enabled = currentProductSettings?.plans || {};

  document.querySelectorAll('[data-fa-plan]').forEach(el => {
    const key = el.getAttribute('data-fa-plan');
    el.classList.toggle('fa-plan-disabled', enabled[key] === false);
  });

  const paymentMap = {
    'https://mpago.la/2EqR1ks':'standard',
    'https://mpago.la/2cQiQ5Z':'pro'
  };

  document.querySelectorAll('a[href]').forEach(link => {
    const key = paymentMap[link.href];
    if (key && enabled[key] === false) {
      link.classList.add('fa-plan-disabled');
      link.setAttribute('aria-hidden','true');
      link.tabIndex = -1;
    }
  });

  document.querySelectorAll('.seo-plan').forEach(card => {
    const title = card.querySelector('h2')?.textContent?.trim().toLowerCase();
    if ((title === 'standard' || title === 'pro') && enabled[title] === false) {
      card.classList.add('fa-plan-disabled');
    }
  });

  document.querySelectorAll('.seo-fact').forEach(fact => {
    const title = fact.querySelector('span')?.textContent?.trim().toLowerCase();
    if ((title === 'standard' || title === 'pro') && enabled[title] === false) {
      fact.classList.add('fa-plan-disabled');
    }
  });

  const plansGrid = document.querySelector('.seo-plans');
  if (plansGrid && currentProductSettings?.referrals?.enabled) {
    if (!plansGrid.querySelector('.fa-referral-public-card')) {
      const reward = Math.max(
        1,
        Number(currentProductSettings.referrals.reward_credits) || 20
      );
      const article = document.createElement('article');
      article.className = 'seo-plan fa-referral-public-card';
      article.innerHTML = `
        <small>PROGRAMA</small>
        <h2>REFERIDOS</h2>
        <div class="seo-plan-price">+${reward}</div>
        <div class="seo-plan-volume">consultas por invitación</div>
        <p>Invitá a una persona nueva a FACIL AUTO y recibí ${reward} consultas adicionales.</p>
        <a href="${siteUrl('mi-cuenta/')}">OBTENER MI LINK</a>
      `;
      plansGrid.appendChild(article);
    }
  }
}


function cleanReturnUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete('login_ticket');
  url.searchParams.delete('login');
  return url.toString();
}

function login() {
  window.FACIL_AUTO_DRAFT?.save?.();

  const params = new URLSearchParams(window.location.search);
  const embeddedReturn =
    params.get('embed') === '1' ? params.get('share_url') : '';

  const returnTo = embeddedReturn || cleanReturnUrl();
  const referral = storedReferral();
  const authUrl =
    `${API_BASE.replace(/\/$/,'')}/auth/google?return_to=${encodeURIComponent(returnTo)}` +
    (referral ? `&ref=${encodeURIComponent(referral)}` : '');

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
  localStorage.removeItem(REFERRAL_KEY);
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

  const paid = enabledPaidPlans();
  const extra = paid.length
    ? ` y acceder a ${paid.map(key => PLANS[key].name).join(' / ')}`
    : '';
  const referralText = currentProductSettings?.referrals?.enabled
    ? ' También vas a encontrar tu enlace personal de referidos.'
    : '';

  root.innerHTML = `
    <section class="account-empty">
      <span class="account-eyebrow">CUENTA FACIL AUTO</span>
      <h1>Ingresá para ver tu cuenta.</h1>
      <p>Desde acá podés consultar tu plan y tus consultas disponibles${extra}.${referralText}</p>
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


async function renderReferralAccount(root) {
  if (!root || !currentProductSettings?.referrals?.enabled) return;

  const section = document.createElement('section');
  section.className = 'fa-referral-account';
  section.innerHTML = `
    <span class="account-eyebrow">REFERIDOS</span>
    <h2>Invitá y sumá consultas.</h2>
    <p>Cada usuario nuevo que se registre desde tu enlace te suma consultas adicionales.</p>
    <div class="fa-referral-link-row">
      <input type="text" readonly value="Cargando tu enlace…" aria-label="Enlace de referidos">
      <button type="button">COPIAR LINK</button>
    </div>
    <div class="fa-referral-stats"></div>
  `;

  root.appendChild(section);

  try {
    const data = await api('/api/referral');
    if (!data?.enabled) {
      section.remove();
      return;
    }

    const input = section.querySelector('input');
    const button = section.querySelector('button');
    const stats = section.querySelector('.fa-referral-stats');
    const reward = Math.max(1, Number(data.reward_credits) || 20);

    input.value = data.invite_url || '';

    stats.innerHTML = `
      <span><strong>+${reward}</strong> por referido</span>
      <span><strong>${Math.max(0, Number(data.total_referrals) || 0)}</strong> referidos</span>
      <span><strong>${Math.max(0, Number(data.credits_earned) || 0)}</strong> consultas ganadas</span>
    `;

    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(input.value);
        button.textContent = 'COPIADO';
        setTimeout(() => { button.textContent = 'COPIAR LINK'; }, 1500);
      } catch (_) {
        input.select();
        document.execCommand('copy');
        button.textContent = 'COPIADO';
        setTimeout(() => { button.textContent = 'COPIAR LINK'; }, 1500);
      }
    });
  } catch (err) {
    console.error('FACIL AUTO referrals:', err);
    section.remove();
  }
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

  const paidPlans = enabledPaidPlans();
  paidPlans.forEach(key => grid.appendChild(planCard(key)));

  if (paidPlans.length) {
    plans.appendChild(grid);
  } else {
    const onlyFree = document.createElement('p');
    onlyFree.textContent = 'Por el momento el único plan disponible es Free.';
    plans.appendChild(onlyFree);
  }

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

  root.append(intro, current, plans);
  renderReferralAccount(root);
  root.append(actions);
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
  currentIsAdmin = Boolean(data.is_admin);
  updateConsultationButton();
  syncGlobalUi(currentAccount);
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

  if (available <= 0 && !currentIsAdmin) {
    showError('No te quedan consultas disponibles. Podés ampliar tu plan desde Planes.');

    setTimeout(() => {
      const destination = siteUrl('planes/');
      if (window.top !== window.self) window.top.location.href = destination;
      else window.location.href = destination;
    }, 700);

    return;
  }

  // Para el administrador, un intento con saldo 0 debe llegar al Worker:
  // ese intento falla y dispara una recarga automática de 10 bonus.
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
        currentIsAdmin = Boolean(data.is_admin);
      } catch (_) {}

      updateConsultationButton();

      const refreshedAvailable = Math.max(
        0,
        Number(currentAccount?.available) || 0
      );

      if (currentIsAdmin && refreshedAvailable > 0) {
        showError(
          `Llegaste a 0. Se regeneraron ${refreshedAvailable} consultas de administrador. Volvé a calcular.`
        );
        return;
      }

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


function installMobileInteractionPolish() {
  if (window.__faMobilePolishInstalled) return;
  window.__faMobilePolishInstalled = true;

  const isFormControl = target =>
    target instanceof Element &&
    target.matches('input,select,textarea,[contenteditable="true"]');

  document.addEventListener('focusin', event => {
    if (isFormControl(event.target)) {
      document.body.classList.add('fa-input-active');
    }
  });

  document.addEventListener('focusout', () => {
    window.setTimeout(() => {
      if (!isFormControl(document.activeElement)) {
        document.body.classList.remove('fa-input-active');
      }
    }, 80);
  });
}

async function init() {
  injectStyles();
  applyBrandIdentity();
  installMobileInteractionPolish();
  captureReferralFromUrl();
  syncGlobalUi(null);
  await loadProductSettings();

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
    syncGlobalUi(null);
    renderAccountLoggedOut();
    return;
  }

  try {
    const data = await api('/api/me');

    if (data.authenticated && data.user) {
      currentAccount = data.account || null;
      currentIsAdmin = Boolean(data.is_admin);
      updateConsultationButton();
      syncGlobalUi(currentAccount);

      if (host) renderLoggedIn(host, data.user);
      renderAccount(data.user, currentAccount, currentIsAdmin);
      return;
    }

    setToken('');
    currentAccount = null;
    currentIsAdmin = false;
    updateConsultationButton();
    syncGlobalUi(null);
    renderAccountLoggedOut();
  } catch (err) {
    if (err.status === 401) {
      setToken('');
      currentAccount = null;
      currentIsAdmin = false;
      updateConsultationButton();
      syncGlobalUi(null);
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
