const WHATSAPP = '5491161264371';
const THEME_KEY = 'abuelaFlorentinaDesign';
let allProducts = [];

const currency = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0
});

function waLink(message) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
}

function productPrice(product) {
  if (typeof product.price === 'number' && Number.isFinite(product.price)) return currency.format(product.price);
  return product.priceLabel || 'Consultar';
}

function safeText(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function productCard(product) {
  const image = product.image || 'assets/product-placeholder.svg';
  const presentation = product.presentation || 'Consultar presentación';
  return `
    <article class="product-card" data-variety="${safeText(product.variety || '')}">
      <div class="product-image">
        <img src="${safeText(image)}" alt="${safeText(product.name)} ${safeText(product.variety || '')}" loading="lazy" onerror="handleProductImageError(this)">
      </div>
      <div class="product-body">
        <span class="tag">Elaboración artesanal</span>
        <h3>${safeText(product.name)}</h3>
        <div class="product-variety">${safeText(product.variety || '')}</div>
        <div class="product-bottom">
          <div class="product-pres">${safeText(presentation)}</div>
          <div class="price">${safeText(productPrice(product))}</div>
        </div>
      </div>
    </article>`;
}

window.handleProductImageError = function(img) {
  const original = img.getAttribute('src') || '';
  const attemptedWebp = img.dataset.attemptedWebp === '1';
  if (!attemptedWebp && /\.wedp(?:\?|$)/i.test(original)) {
    img.dataset.attemptedWebp = '1';
    img.src = original.replace(/\.wedp(?=\?|$)/i, '.webp');
    return;
  }
  img.onerror = null;
  img.src = 'assets/product-placeholder.svg';
};

function renderProducts(filter = 'Todas') {
  const grid = document.querySelector('#productGrid');
  const products = allProducts.filter(p => p.active !== false && (filter === 'Todas' || p.variety === filter));
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state">No hay productos disponibles en esta categoría.</div>';
    return;
  }
  grid.innerHTML = products
    .sort((a,b) => (a.order ?? 999) - (b.order ?? 999))
    .map(productCard)
    .join('');
}

function setupFilters() {
  const wrap = document.querySelector('#filters');
  const varieties = ['Todas', ...new Set(allProducts.filter(p => p.active !== false).map(p => p.variety).filter(Boolean))];
  wrap.innerHTML = varieties.map((v,i) => `<button class="filter ${i === 0 ? 'active' : ''}" data-filter="${safeText(v)}">${safeText(v)}</button>`).join('');
  wrap.addEventListener('click', (e) => {
    const button = e.target.closest('[data-filter]');
    if (!button) return;
    wrap.querySelectorAll('.filter').forEach(b => b.classList.toggle('active', b === button));
    renderProducts(button.dataset.filter);
  });
}

async function loadCatalog() {
  try {
    const res = await fetch(`data/catalog.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    allProducts = Array.isArray(data.products) ? data.products : [];
    setupFilters();
    renderProducts();
    const status = document.querySelector('#syncStatus');
    if (data.updatedAt) {
      const date = new Date(data.updatedAt);
      status.textContent = `Catálogo actualizado: ${date.toLocaleString('es-AR')}`;
    } else {
      status.textContent = '';
    }
  } catch (error) {
    console.error(error);
    document.querySelector('#productGrid').innerHTML = '<div class="empty-state">No pudimos cargar el catálogo.</div>';
  }
}

function applyTheme(theme) {
  const allowed = ['clasica', 'calida', 'moderna'];
  const selected = allowed.includes(theme) ? theme : 'clasica';
  document.body.dataset.theme = selected;
  const select = document.querySelector('#designSelect');
  if (select) select.value = selected;
  localStorage.setItem(THEME_KEY, selected);

  const meta = document.querySelector('meta[name="theme-color"]');
  const colors = {
    clasica: '#263a8b',
    calida: '#33488f',
    moderna: '#4059a7'
  };
  if (meta) meta.setAttribute('content', colors[selected]);
}

function setupThemePicker() {
  const select = document.querySelector('#designSelect');
  if (!select) return;
  applyTheme(localStorage.getItem(THEME_KEY) || 'clasica');
  select.addEventListener('change', () => applyTheme(select.value));
}

document.querySelectorAll('[data-wa]').forEach(link => {
  const message = link.dataset.wa || 'Hola, quiero hacer una consulta por las tapas Abuela Florentina.';
  link.href = waLink(message);
});

document.querySelector('#year').textContent = new Date().getFullYear();
setupThemePicker();
loadCatalog();
