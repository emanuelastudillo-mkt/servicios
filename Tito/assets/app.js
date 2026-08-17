const categories = [
  { id: 'tapas', name: 'Tapas de empanadas', icon: '🥟', description: 'Criollas, hojaldre y más.', color: '#b65f43', soft: '#f3ddd4', image: 'assets/images/categoria-tapas-empanadas.webp' },
  { id: 'prepizzas', name: 'Prepizzas', icon: '🍕', description: 'Distintos tamaños y formatos.', color: '#c79542', soft: '#f4ead3', image: 'assets/images/categoria-prepizzas.webp' },
  { id: 'aceitunas', name: 'Aceitunas', icon: '🫒', description: 'Verdes, negras y variedades.', color: '#7f8550', soft: '#e9ead8', image: 'assets/images/categoria-aceitunas.webp' },
  { id: 'quesos', name: 'Quesos', icon: '🧀', description: 'Muzzarella, cremosos y barra.', color: '#d3ae55', soft: '#f5ecd5', image: 'assets/images/categoria-quesos.webp' },
  { id: 'fiambres', name: 'Fiambres', icon: '🥓', description: 'Jamón, paleta, salames y más.', color: '#b45c58', soft: '#f0d9d7', image: 'assets/images/categoria-fiambres.webp' },
  { id: 'almacen', name: 'Almacén y otros', icon: '🥫', description: 'Complementos para tu negocio.', color: '#54756a', soft: '#dbe8e3', image: 'assets/images/categoria-almacen.webp' }
];

const products = [
  { id: 1, name: 'Tapas criollas', category: 'tapas', brand: 'Marca surtida', presentation: 'Pack gastronómico', image: 'assets/images/producto-tapas-criollas.webp' },
  { id: 2, name: 'Tapas de hojaldre', category: 'tapas', brand: 'Marca surtida', presentation: 'Pack gastronómico', image: 'assets/images/producto-tapas-hojaldradas.webp' },
  { id: 3, name: 'Prepizza clásica', category: 'prepizzas', brand: 'Marca surtida', presentation: 'Pack por unidades', image: 'assets/images/producto-prepizza-clasica.webp' },
  { id: 4, name: 'Prepizza individual', category: 'prepizzas', brand: 'Marca surtida', presentation: 'Pack por unidades', image: 'assets/images/producto-prepizza-individual.webp' },
  { id: 5, name: 'Aceitunas verdes', category: 'aceitunas', brand: 'Marca surtida', presentation: 'Presentación gastronómica', image: 'assets/images/producto-aceitunas-verdes.webp' },
  { id: 6, name: 'Aceitunas negras', category: 'aceitunas', brand: 'Marca surtida', presentation: 'Presentación gastronómica', image: 'assets/images/producto-aceitunas-negras.webp' },
  { id: 7, name: 'Muzzarella en barra', category: 'quesos', brand: 'Marca surtida', presentation: 'Barra / horma', image: 'assets/images/producto-muzzarella-barra.webp' },
  { id: 8, name: 'Queso cremoso', category: 'quesos', brand: 'Marca surtida', presentation: 'Horma', image: 'assets/images/producto-queso-cremoso.webp' },
  { id: 9, name: 'Jamón cocido', category: 'fiambres', brand: 'Marca surtida', presentation: 'Pieza', image: 'assets/images/producto-jamon-cocido.webp' },
  { id: 10, name: 'Salame', category: 'fiambres', brand: 'Marca surtida', presentation: 'Pieza', image: 'assets/images/producto-salame.webp' }
];

const THEME_STORAGE_KEY = 'gentilezzaTheme';
const VALID_THEMES = ['clasica', 'alternativa', 'moderna'];
const THEME_COLORS = {
  clasica: '#173f33',
  alternativa: '#536451',
  moderna: '#173f33'
};

function applyTheme(theme, persist = true) {
  const nextTheme = VALID_THEMES.includes(theme) ? theme : 'clasica';
  document.body.dataset.theme = nextTheme;

  const selector = document.querySelector('#theme-select');
  if (selector && selector.value !== nextTheme) selector.value = nextTheme;

  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.setAttribute('content', THEME_COLORS[nextTheme]);

  if (persist) localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
}

const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
applyTheme(VALID_THEMES.includes(savedTheme) ? savedTheme : 'clasica', false);

const state = {
  filter: 'todos',
  search: '',
  order: JSON.parse(localStorage.getItem('gentilezzaOrder') || '{}')
};

const els = {
  categories: document.querySelector('#category-grid'),
  filters: document.querySelector('#filter-row'),
  products: document.querySelector('#product-grid'),
  search: document.querySelector('#product-search'),
  empty: document.querySelector('#empty-state'),
  count: document.querySelector('#order-count'),
  drawer: document.querySelector('#order-drawer'),
  backdrop: document.querySelector('#drawer-backdrop'),
  items: document.querySelector('#order-items'),
  close: document.querySelector('#close-order'),
  clear: document.querySelector('#clear-order'),
  send: document.querySelector('#send-order'),
  menuToggle: document.querySelector('.menu-toggle'),
  nav: document.querySelector('#main-nav'),
  theme: document.querySelector('#theme-select')
};

function catName(id) {
  return categories.find(c => c.id === id)?.name || id;
}

// Permite conservar la estructura recomendada /assets/images/ y, a la vez,
// usar proyectos donde los WEBP fueron guardados directamente en /assets/.
// CSS usa ambas URL como capas: si la primera no existe, se ve la segunda.
function imageFallbackStack(path) {
  const alternate = path.replace('assets/images/', 'assets/');
  return `url('${path}'),url('${alternate}')`;
}

function renderCategories() {
  els.categories.innerHTML = categories.map(c => `
    <article class="category-card" style="--cat:${c.color};--cat-soft:${c.soft};--cat-image:${imageFallbackStack(c.image)}">
      <div class="category-icon">${c.icon}</div>
      <h3>${c.name}</h3>
      <p>${c.description}</p>
      <button type="button" aria-label="Ver ${c.name}" data-category-jump="${c.id}">→</button>
    </article>
  `).join('');
}

function renderFilters() {
  const all = [{ id: 'todos', name: 'Todos' }, ...categories];
  els.filters.innerHTML = all.map(c => `<button class="filter-btn ${state.filter === c.id ? 'active' : ''}" data-filter="${c.id}">${c.name}</button>`).join('');
}

function filteredProducts() {
  const q = state.search.trim().toLowerCase();
  return products.filter(p => {
    const byFilter = state.filter === 'todos' || p.category === state.filter;
    const haystack = `${p.name} ${p.brand} ${p.presentation} ${catName(p.category)}`.toLowerCase();
    return byFilter && (!q || haystack.includes(q));
  });
}

function renderProducts() {
  const list = filteredProducts();
  els.empty.hidden = list.length > 0;
  els.products.innerHTML = list.map(p => {
    const qty = state.order[p.id] || 1;
    const isAdded = !!state.order[p.id];
    return `
      <article class="product-card">
        <div class="product-image" style="--product-image:${imageFallbackStack(p.image)}" role="img" aria-label="${p.name}"><span class="product-chip">${p.brand}</span></div>
        <div class="product-body">
          <span class="product-category">${catName(p.category)}</span>
          <h3>${p.name}</h3>
          <p class="product-meta">${p.presentation}</p>
          <div class="product-actions">
            <div class="qty-control">
              <button type="button" data-qty-minus="${p.id}" aria-label="Restar">−</button>
              <span data-qty-value="${p.id}">${qty}</span>
              <button type="button" data-qty-plus="${p.id}" aria-label="Sumar">+</button>
            </div>
            <button type="button" class="add-btn ${isAdded ? 'added' : ''}" data-add="${p.id}">${isAdded ? 'En pedido' : 'Agregar'}</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function saveOrder() {
  localStorage.setItem('gentilezzaOrder', JSON.stringify(state.order));
  updateCount();
  renderOrder();
}

function updateCount() {
  const total = Object.values(state.order).reduce((a, b) => a + b, 0);
  els.count.textContent = total;
}

function renderOrder() {
  const entries = Object.entries(state.order).filter(([, qty]) => qty > 0);
  if (!entries.length) {
    els.items.innerHTML = '<div class="order-empty">Todavía no agregaste productos.</div>';
    return;
  }
  els.items.innerHTML = entries.map(([id, qty]) => {
    const p = products.find(x => x.id === Number(id));
    if (!p) return '';
    return `<div class="order-item">
      <div><strong>${p.name}</strong><small>${catName(p.category)} · ${p.presentation}</small></div>
      <div class="order-item-controls">
        <button type="button" data-order-minus="${p.id}">−</button><strong>${qty}</strong><button type="button" data-order-plus="${p.id}">+</button>
      </div>
    </div>`;
  }).join('');
}

function openOrder() {
  els.backdrop.hidden = false;
  requestAnimationFrame(() => els.drawer.classList.add('open'));
  els.drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
}

function closeOrder() {
  els.drawer.classList.remove('open');
  els.drawer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  setTimeout(() => els.backdrop.hidden = true, 280);
}

function updateProductQty(id, delta) {
  const valueEl = document.querySelector(`[data-qty-value="${id}"]`);
  if (!valueEl) return;
  const current = Number(valueEl.textContent) || 1;
  valueEl.textContent = Math.max(1, current + delta);
}

function addProduct(id) {
  const valueEl = document.querySelector(`[data-qty-value="${id}"]`);
  const qty = Number(valueEl?.textContent || 1);
  state.order[id] = qty;
  saveOrder();
  renderProducts();
}

function buildOrderText() {
  const entries = Object.entries(state.order).filter(([, qty]) => qty > 0);
  if (!entries.length) return '';
  const lines = entries.map(([id, qty]) => {
    const p = products.find(x => x.id === Number(id));
    return `• ${qty} x ${p?.name || 'Producto'}`;
  });
  return `Hola, quiero consultar por este pedido de La Gentilezza:\n\n${lines.join('\n')}\n\n¿Me confirman disponibilidad, precio y entrega?`;
}

renderCategories();
renderFilters();
renderProducts();
renderOrder();
updateCount();
document.querySelector('#year').textContent = new Date().getFullYear();

els.search.addEventListener('input', e => { state.search = e.target.value; renderProducts(); });

els.filters.addEventListener('click', e => {
  const btn = e.target.closest('[data-filter]'); if (!btn) return;
  state.filter = btn.dataset.filter; renderFilters(); renderProducts();
});

els.categories.addEventListener('click', e => {
  const btn = e.target.closest('[data-category-jump]'); if (!btn) return;
  state.filter = btn.dataset.categoryJump; renderFilters(); renderProducts();
  document.querySelector('#productos').scrollIntoView({ behavior: 'smooth' });
});

els.products.addEventListener('click', e => {
  const minus = e.target.closest('[data-qty-minus]');
  const plus = e.target.closest('[data-qty-plus]');
  const add = e.target.closest('[data-add]');
  if (minus) updateProductQty(minus.dataset.qtyMinus, -1);
  if (plus) updateProductQty(plus.dataset.qtyPlus, +1);
  if (add) addProduct(add.dataset.add);
});

document.querySelectorAll('[data-open-order]').forEach(b => b.addEventListener('click', openOrder));
els.close.addEventListener('click', closeOrder); els.backdrop.addEventListener('click', closeOrder);

els.items.addEventListener('click', e => {
  const plus = e.target.closest('[data-order-plus]');
  const minus = e.target.closest('[data-order-minus]');
  if (plus) state.order[plus.dataset.orderPlus] = (state.order[plus.dataset.orderPlus] || 0) + 1;
  if (minus) {
    const id = minus.dataset.orderMinus;
    state.order[id] = Math.max(0, (state.order[id] || 0) - 1);
    if (!state.order[id]) delete state.order[id];
  }
  if (plus || minus) { saveOrder(); renderProducts(); }
});

els.clear.addEventListener('click', () => { state.order = {}; saveOrder(); renderProducts(); });
els.send.addEventListener('click', () => {
  const text = buildOrderText();
  if (!text) { alert('Agregá al menos un producto al pedido.'); return; }
  navigator.clipboard?.writeText(text).catch(() => {});
  alert('Pedido preparado y copiado. Falta configurar el número de WhatsApp para enviarlo directamente.');
});

if (els.theme) {
  els.theme.addEventListener('change', e => applyTheme(e.target.value));
}

els.menuToggle.addEventListener('click', () => {
  const open = els.nav.classList.toggle('open');
  els.menuToggle.setAttribute('aria-expanded', String(open));
});
els.nav.addEventListener('click', () => { els.nav.classList.remove('open'); els.menuToggle.setAttribute('aria-expanded', 'false'); });
