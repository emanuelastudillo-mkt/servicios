const WHATSAPP = '5491161264371';
let allProducts = [];

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

function waLink(message) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`;
}

function productPrice(product) {
  if (typeof product.price === 'number' && Number.isFinite(product.price)) return currency.format(product.price);
  return product.priceLabel || 'Consultar';
}

function productCard(product) {
  const image = product.image || 'assets/product-placeholder.svg';
  const presentation = product.presentation || 'Consultar presentación';
  const message = `Hola, quiero consultar por ${product.name} - ${product.variety}${product.presentation ? ` (${product.presentation})` : ''}.`;
  return `
    <article class="product-card" data-variety="${product.variety || ''}">
      <a class="product-image" href="${waLink(message)}" target="_blank" rel="noopener" aria-label="Consultar ${product.name} ${product.variety}">
        <img src="${image}" alt="${product.name} ${product.variety}" loading="lazy" onerror="this.src='assets/product-placeholder.svg'">
      </a>
      <div class="product-body">
        <span class="tag">Elaboración artesanal</span>
        <h3>${product.name}</h3>
        <div class="product-variety">${product.variety}</div>
        <div class="product-bottom">
          <div class="product-pres">${presentation}</div>
          <div class="price">${productPrice(product)}</div>
        </div>
      </div>
    </article>`;
}

function renderProducts(filter = 'Todas') {
  const grid = document.querySelector('#productGrid');
  const products = allProducts.filter(p => p.active !== false && (filter === 'Todas' || p.variety === filter));
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state">No hay productos disponibles en esta categoría.</div>';
    return;
  }
  grid.innerHTML = products
    .sort((a,b) => (a.order ?? 999) - (b.order ?? 999))
    .map(productCard).join('');
}

function setupFilters() {
  const wrap = document.querySelector('#filters');
  const varieties = ['Todas', ...new Set(allProducts.filter(p => p.active !== false).map(p => p.variety).filter(Boolean))];
  wrap.innerHTML = varieties.map((v,i) => `<button class="filter ${i === 0 ? 'active' : ''}" data-filter="${v}">${v}</button>`).join('');
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
      status.textContent = 'Catálogo listo para vincular con Google Sheets.';
    }
  } catch (error) {
    console.error(error);
    allProducts = [];
    document.querySelector('#productGrid').innerHTML = '<div class="empty-state">No pudimos cargar el catálogo. Consultanos por WhatsApp.</div>';
  }
}

document.querySelectorAll('[data-wa]').forEach(link => {
  const message = link.dataset.wa || 'Hola, quiero hacer una consulta por las tapas Abuela Florentina.';
  link.href = waLink(message);
});

document.querySelector('#year').textContent = new Date().getFullYear();
loadCatalog();
