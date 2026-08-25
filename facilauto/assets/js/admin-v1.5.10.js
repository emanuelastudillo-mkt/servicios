import {api, token} from '../../servicios-auth.js?v=1.5.10';

const $ = selector => document.querySelector(selector);

function deny() {
  location.replace('./index.html');
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-AR').format(Number(value) || 0);
}

function formatDate(unix) {
  if (!unix) return '—';
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle:'short',
    timeStyle:'short',
    timeZone:'America/Argentina/Buenos_Aires'
  }).format(new Date(Number(unix) * 1000));
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  })[c]);
}

function avatar(user) {
  if (user.picture) {
    return `<img class="admin-avatar" src="${escapeHtml(user.picture)}" alt="" referrerpolicy="no-referrer">`;
  }

  const letter = (user.name || user.email || 'U').trim().charAt(0).toUpperCase();
  return `<span class="admin-avatar-fallback">${escapeHtml(letter)}</span>`;
}

function renderUsers(users) {
  const list = $('#admin-users-list');
  if (!list) return;

  if (!users.length) {
    list.innerHTML = '<div class="admin-empty">Todavía no hay usuarios registrados.</div>';
    return;
  }

  list.innerHTML = users.map(user => `
    <div class="admin-row">
      <div class="admin-user">
        ${avatar(user)}
        <div class="admin-user-copy">
          <strong>${escapeHtml(user.name || 'Usuario')}</strong>
          <span>${escapeHtml(user.email)}</span>
        </div>
      </div>
      <div class="admin-cell">
        <span class="admin-plan">${escapeHtml(String(user.plan || 'free').toUpperCase())}</span>
      </div>
      <div class="admin-cell">
        <strong>${formatNumber(user.available)}</strong>
        <small>disponibles</small>
      </div>
      <div class="admin-cell">
        <strong>${formatNumber(user.purchased_total)}</strong>
        <small>compradas históricas</small>
      </div>
      <div class="admin-cell">
        <strong>${formatNumber(user.used_this_month)}</strong>
        <small>usadas este mes · ${escapeHtml(formatDate(user.last_login_at))}</small>
      </div>
    </div>
  `).join('');
}

async function init() {
  if (!token()) return deny();

  try {
    const me = await api('/api/me');

    if (!me?.authenticated || !me?.is_admin) return deny();

    // Recién después de validar en el Worker se revela el panel.
    document.documentElement.classList.remove('fa-admin-pending');

    const data = await api('/api/admin/users');
    const users = Array.isArray(data.users) ? data.users : [];

    const totalAvailable = users.reduce((sum, user) => sum + (Number(user.available) || 0), 0);
    const totalPurchased = users.reduce((sum, user) => sum + (Number(user.purchased_total) || 0), 0);

    $('#admin-total-users').textContent = formatNumber(users.length);
    $('#admin-total-available').textContent = formatNumber(totalAvailable);
    $('#admin-total-purchased').textContent = formatNumber(totalPurchased);

    renderUsers(users);
  } catch (err) {
    if (err?.status === 401 || err?.status === 403) return deny();

    console.error('FACIL AUTO admin:', err);
    const list = $('#admin-users-list');
    if (list) {
      list.innerHTML = '<div class="admin-empty">No se pudo cargar el listado de usuarios.</div>';
    }
    document.documentElement.classList.remove('fa-admin-pending');
  }
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init, {once:true})
  : init();
