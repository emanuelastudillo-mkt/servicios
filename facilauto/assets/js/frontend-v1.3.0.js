/**
 * FACIL AUTO — Frontend presentation v1.3.1
 * Capa pública: privacidad de fuentes, SVGs y compartir resultados.
 */

const GENERIC_COPY = {
  hero: 'Las estimaciones se construyen combinando datos oficiales, relevamientos de mercado y consultas realizadas a agencias y usuarios.',
  coverage: 'El catálogo combina datos oficiales y relevamientos del mercado automotor para ampliar marcas, modelos y versiones.',
  marketSource: 'Datos oficiales + relevamientos y encuestas del mercado automotor.',
  officialSource: 'Datos oficiales vigentes.',
  financeSource: 'Tasas y condiciones publicadas por entidades financieras. Valores orientativos.'
};

const ICONS = {
  valuation: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 35V16l16-8 16 8v19"/><path d="M14 35V20h20v15"/><path d="M18 28h12"/><circle cx="24" cy="20" r="3"/><path d="M7 40h34"/></svg>`,
  transfer: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 15h25"/><path d="m28 10 5 5-5 5"/><path d="M40 33H15"/><path d="m20 28-5 5 5 5"/><rect x="13" y="21" width="22" height="7" rx="2"/></svg>`,
  close: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 12h28v24H10z"/><path d="M10 18h28"/><path d="M16 27h8"/><path d="M16 32h15"/><circle cx="33" cy="27" r="2"/></svg>`,
  finance: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M7 18 24 8l17 10"/><path d="M10 20h28"/><path d="M13 20v15M21 20v15M29 20v15M37 20v15"/><path d="M8 36h32M6 40h36"/></svg>`,
  insurance: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 6 38 11v11c0 9-5.5 15.6-14 20-8.5-4.4-14-11-14-20V11z"/><path d="m17 24 5 5 10-11"/></svg>`,
  share: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.9 7.4-4.5M8.3 13.1l7.4 4.5"/></svg>`,
  whatsapp: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.7a8 8 0 0 1-11.8 7L4 20l1.3-4.1A8 8 0 1 1 20 11.7Z"/><path d="M8.8 8.4c.4 3 2.2 4.9 5.2 5.9"/></svg>`,
  copy: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>`
};

const frontendCss = `
.result-strip summary{position:relative}
.fa-result-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;border:1px solid currentColor;border-radius:50%;margin-right:2px}
.fa-result-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.fa-share-panel{display:flex;align-items:center;justify-content:space-between;gap:18px;margin:18px 0 20px;padding:16px 18px;border:1px solid var(--ink,#121212);background:var(--paper,#fbfaf7)}
.fa-share-copy small{display:block;font-size:8px;font-weight:800;letter-spacing:.14em;color:var(--accent,#e94f32);margin-bottom:3px}
.fa-share-copy strong{font-size:14px}
.fa-share-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.fa-share-button{appearance:none;border:1px solid var(--ink,#121212);background:transparent;color:var(--ink,#121212);height:38px;padding:0 12px;display:inline-flex;align-items:center;gap:8px;font:800 9px/1 Arial,sans-serif;letter-spacing:.07em;cursor:pointer;text-decoration:none}
.fa-share-button:hover{background:var(--ink,#121212);color:#fff}
.fa-share-button svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.fa-share-toast{position:fixed;right:20px;bottom:20px;z-index:9999;background:#111;color:#fff;padding:11px 14px;font:700 10px/1 Arial,sans-serif;letter-spacing:.05em}
.fa-generic-source{font-style:normal}
@media(max-width:760px){
  .fa-share-panel{align-items:flex-start;flex-direction:column}
  .fa-share-actions{justify-content:flex-start;width:100%}
  .fa-share-button{flex:1;min-width:115px;justify-content:center}
  .fa-result-icon{width:36px;height:36px;flex-basis:36px}
  .fa-result-icon svg{width:19px;height:19px}
}
`;

function injectCss() {
  if (document.getElementById('fa-frontend-130')) return;
  const style = document.createElement('style');
  style.id = 'fa-frontend-130';
  style.textContent = frontendCss;
  document.head.appendChild(style);
}

function text(selector, value) {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
}

function renameStaticCopy() {
  const navSources = [...document.querySelectorAll('.topnav a')].find(a =>
    a.textContent.trim().toLowerCase() === 'fuentes'
  );
  if (navSources) navSources.textContent = 'Datos';

  const heroData = document.querySelector('.hero-data');
  if (heroData) {
    const lines = heroData.querySelectorAll('.data-line');
    if (lines[0]?.querySelector('span')) lines[0].querySelector('span').textContent = 'Mercado automotor';
    if (lines[1]?.querySelector('span')) lines[1].querySelector('span').textContent = 'Datos oficiales';
    if (lines[2]?.querySelector('span')) lines[2].querySelector('span').textContent = 'Financiación';
    const p = heroData.querySelector(':scope > p');
    if (p) p.textContent = GENERIC_COPY.hero;
  }

  document.querySelectorAll('.block-head small').forEach((el, index) => {
    if (index === 0) el.textContent = GENERIC_COPY.coverage;
  });

  text('#catalog-coverage', GENERIC_COPY.coverage);

  const labels = {
    '#market-pdf-value': 'Valor de referencia',
    '#market-pdf-unit': 'Base utilizada',
    '#dnrpa-value': 'Valuación oficial'
  };

  const detailRows = document.querySelectorAll('.valuation-strip .data-list > div, .transfer-strip .data-list > div');
  detailRows.forEach(row => {
    const dt = row.querySelector('dt');
    const dd = row.querySelector('dd');
    if (!dt || !dd) return;
    if (dd.id === 'market-pdf-value') dt.textContent = 'Valor de referencia';
    if (dd.id === 'market-pdf-unit') dt.textContent = 'Base utilizada';
    if (dd.id === 'dnrpa-value') dt.textContent = 'Valuación oficial';
  });

  const legal = document.querySelector('.legal-note');
  if (legal) {
    legal.textContent = 'Los resultados son orientativos y se construyen con datos oficiales, relevamientos de mercado y consultas a agencias y usuarios. Cuando una combinación no cuenta con referencia directa, se aplican métodos estadísticos y reglas internas de estimación. Tasas, aranceles, sellos y valores pueden modificarse antes de cerrar una operación.';
  }

  rewriteMethodology();
  rewriteSourcesSection();
}

function rewriteMethodology() {
  const list = document.querySelector('.method-list');
  if (!list) return;

  const articles = list.querySelectorAll('article');
  const replacements = [
    ['REFERENCIA DE VALOR', 'La valuación combina datos oficiales con relevamientos, consultas a agencias y datos aportados por usuarios. Cuando no existe una referencia directa para una versión y año, se utilizan relaciones estadísticas entre vehículos comparables.'],
    ['KILOMETRAJE', 'Hasta 100.000 km el valor permanece dentro de una zona normal de usado, con una mejora moderada para unidades de muy bajo kilometraje. Desde 100.000 hasta 400.000 km se aplica una depreciación exponencial progresiva, limitada al 30%.'],
    ['OPORTUNIDAD', 'Compara el precio publicado o pactado con la referencia estimada y aplica un margen comercial para interpretar si la operación se encuentra por debajo, dentro o por encima del mercado.'],
    ['CIERRE', 'Integra precio, transferencia, anticipo y financiación para mostrar de forma simple cuánto dinero requiere la operación.'],
    ['TRANSFERENCIA', 'Los costos registrales se estiman usando valuaciones y parámetros oficiales vigentes, junto con los supuestos seleccionados para jurisdicción y tipo de comprador.']
  ];

  articles.forEach((article, i) => {
    if (!replacements[i]) return;
    const b = article.querySelector('b');
    const p = article.querySelector('p');
    if (b) b.textContent = replacements[i][0];
    if (p) p.textContent = replacements[i][1];
  });
}

function rewriteSourcesSection() {
  const section = document.querySelector('#fuentes, .sources-section');
  if (!section) return;

  const kicker = section.querySelector('.source-kicker');
  if (kicker) kicker.textContent = 'DATOS';

  const heading = section.querySelector('h2');
  if (heading) heading.textContent = 'Información que alimenta las estimaciones.';

  // IMPORTANTE:
  // No reemplazar el innerHTML de .source-list.
  // app.js necesita los IDs source-market-date, source-dnrpa-date y
  // source-rates-date mientras termina de cargar los JSON.
  const rows = section.querySelectorAll('.source-list > div');

  const publicRows = [
    ['Mercado', 'Datos oficiales + relevamientos y encuestas'],
    ['Oficial', 'Datos y parámetros oficiales vigentes'],
    ['Financiación', 'Tasas y condiciones publicadas']
  ];

  rows.forEach((row, index) => {
    const label = row.querySelector('span');
    const name = row.querySelector('b');

    if (publicRows[index]) {
      if (label) label.textContent = publicRows[index][0];
      if (name) name.textContent = publicRows[index][1];
    }
  });
}
function genericMethod(original='') {
  const value = String(original).toLowerCase();
  if (!value || value === '—') return 'Según datos oficiales y encuestas.';
  if (value.includes('exacto') || value.includes('guía mensual')) {
    return 'Referencia directa según datos oficiales y encuestas.';
  }
  if (value.includes('interpol')) {
    return 'Estimación estadística entre referencias comparables.';
  }
  if (value.includes('proyección') || value.includes('extrapol')) {
    return 'Proyección estadística con referencias comparables.';
  }
  if (value.includes('promedio') || value.includes('similares')) {
    return 'Estimación ponderada con vehículos comparables.';
  }
  if (value.includes('dnrpa') || value.includes('registro')) {
    return 'Estimación combinada con datos oficiales y relevamientos.';
  }
  return 'Según datos oficiales, relevamientos y encuestas.';
}

let sanitizing = false;
function sanitizeDynamicResult() {
  if (sanitizing) return;
  sanitizing = true;

  try {
    const result = document.querySelector('#resultados');
    if (!result || result.hidden) return;

    const baseValue = document.querySelector('#market-pdf-value');
    if (baseValue && /sin valor exacto/i.test(baseValue.textContent)) {
      baseValue.textContent = 'Referencia estimada';
    }

    const unit = document.querySelector('#market-pdf-unit');
    if (unit) unit.textContent = 'Según datos oficiales y encuestas.';

    const method = document.querySelector('#market-method');
    if (method && !method.dataset.faGeneric) {
      method.textContent = genericMethod(method.textContent);
      method.dataset.faGeneric = '1';
    } else if (method && /guía|dnrpa|pdf|pág|registro/i.test(method.textContent)) {
      method.textContent = genericMethod(method.textContent);
    }

    const marketSource = document.querySelector('#market-source');
    if (marketSource) marketSource.textContent = GENERIC_COPY.marketSource;

    const officialSource = document.querySelector('#dnrpa-source');
    if (officialSource) officialSource.textContent = GENERIC_COPY.officialSource;

    const match = document.querySelector('#dnrpa-match');
    if (match && match.textContent !== '—') {
      if (/no se encontró/i.test(match.textContent)) {
        match.textContent = 'No se encontró una referencia oficial equivalente.';
      } else if (/consultar alta/i.test(match.textContent)) {
        match.textContent = 'Consultar costos oficiales de alta / patentamiento.';
      } else {
        match.textContent = 'Coincidencia con datos oficiales vigentes.';
      }
    }

    const state = document.querySelector('#dnrpa-status');
    if (state && state.textContent === 'Exacta') state.textContent = 'Referencia directa';

    const financeSource = document.querySelector('#finance-source');
    if (financeSource) financeSource.textContent = GENERIC_COPY.financeSource;

    const status = document.querySelector('#data-status');
    if (status && /referencias de mercado|registros DNRPA/i.test(status.textContent)) {
      status.textContent = 'Datos oficiales y relevamientos de mercado cargados.';
    }
  } finally {
    sanitizing = false;
  }
}

function currentShareData() {
  const unit = document.querySelector('#result-unit')?.textContent?.trim() || 'Vehículo';
  const valuation = document.querySelector('#market-value')?.textContent?.trim() || '—';
  const transfer = document.querySelector('#transfer-total')?.textContent?.trim() || '—';
  const close = document.querySelector('#cash-close')?.textContent?.trim() || '—';
  const opportunity = document.querySelector('#opportunity-rating')?.textContent?.trim() || '';
  const pct = document.querySelector('#opportunity-pct')?.textContent?.trim() || '';

  const lines = [
    `FACIL AUTO · ${unit}`,
    `Valuación estimada: ${valuation}`,
    `Transferencia estimada: ${transfer}`,
    `Cierre al contado: ${close}`
  ];

  if (opportunity && !/ingresá/i.test(opportunity)) {
    lines.push(`Oportunidad: ${opportunity}${pct && pct !== '—' ? ` (${pct})` : ''}`);
  }

  lines.push('Estimación orientativa basada en datos oficiales y relevamientos de mercado.');
  return {
    title: `FACIL AUTO · ${unit}`,
    text: lines.join('\n'),
    url: `${location.origin}${location.pathname}`
  };
}

function toast(message) {
  document.querySelector('.fa-share-toast')?.remove();
  const el = document.createElement('div');
  el.className = 'fa-share-toast';
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

async function nativeShare() {
  const data = currentShareData();
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      if (err?.name === 'AbortError') return;
    }
  }
  await copyResult();
}

async function copyResult() {
  const data = currentShareData();
  const value = `${data.text}\n${data.url}`;
  try {
    await navigator.clipboard.writeText(value);
    toast('RESULTADO COPIADO');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('RESULTADO COPIADO');
  }
}

function openWhatsApp() {
  const data = currentShareData();
  const url = `https://wa.me/?text=${encodeURIComponent(`${data.text}\n${data.url}`)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openX() {
  const data = currentShareData();
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(data.text)}&url=${encodeURIComponent(data.url)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function openFacebook() {
  const data = currentShareData();
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(data.url)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function addSharePanel() {
  const result = document.querySelector('#resultados .shell');
  if (!result || result.querySelector('.fa-share-panel')) return;

  const opportunity = result.querySelector('.opportunity-panel');
  const panel = document.createElement('div');
  panel.className = 'fa-share-panel';
  panel.innerHTML = `
    <div class="fa-share-copy">
      <small>COMPARTIR RESULTADO</small>
      <strong>Mandá esta estimación por WhatsApp o redes.</strong>
    </div>
    <div class="fa-share-actions">
      <button class="fa-share-button" type="button" data-share="native">${ICONS.share}<span>COMPARTIR</span></button>
      <button class="fa-share-button" type="button" data-share="whatsapp">${ICONS.whatsapp}<span>WHATSAPP</span></button>
      <button class="fa-share-button" type="button" data-share="x"><span>𝕏</span><span>X</span></button>
      <button class="fa-share-button" type="button" data-share="facebook"><span>f</span><span>FACEBOOK</span></button>
      <button class="fa-share-button" type="button" data-share="copy">${ICONS.copy}<span>COPIAR</span></button>
    </div>
  `;

  if (opportunity) opportunity.insertAdjacentElement('afterend', panel);
  else result.appendChild(panel);

  panel.querySelector('[data-share="native"]')?.addEventListener('click', nativeShare);
  panel.querySelector('[data-share="whatsapp"]')?.addEventListener('click', openWhatsApp);
  panel.querySelector('[data-share="x"]')?.addEventListener('click', openX);
  panel.querySelector('[data-share="facebook"]')?.addEventListener('click', openFacebook);
  panel.querySelector('[data-share="copy"]')?.addEventListener('click', copyResult);
}

function watchResults() {
  const result = document.querySelector('#resultados');
  if (!result) return;

  const observer = new MutationObserver(() => {
    queueMicrotask(() => {
      sanitizeDynamicResult();
      addResultIcons();
      addSharePanel();
    });
  });

  observer.observe(result, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['hidden']
  });

  const form = document.querySelector('#vehicle-form');
  form?.addEventListener('submit', () => {
    setTimeout(() => {
      sanitizeDynamicResult();
      addResultIcons();
      addSharePanel();
    }, 0);
  });
}

function watchPublicSourceDetails() {
  const sourceIds = ['source-market-date', 'source-dnrpa-date', 'source-rates-date'];

  sourceIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    // We keep the node/ID because app.js depends on it.
    // Dates may remain visible; specific provider/file/page names stay hidden.
    const observer = new MutationObserver(() => {
      const txt = el.textContent || '';
      if (/nuestrosautos|dnrpa|comparatasas|pdf|pág|pagina/i.test(txt)) {
        el.textContent = 'Actualizable';
      }
    });

    observer.observe(el, {childList:true, characterData:true, subtree:true});
  });
}

function watchStatusAndCoverage() {
  const ids = ['data-status', 'catalog-coverage'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;

    new MutationObserver(() => {
      if (id === 'data-status' && /referencias de mercado|registros DNRPA/i.test(el.textContent)) {
        el.textContent = 'Datos oficiales y relevamientos de mercado cargados.';
      }

      if (id === 'catalog-coverage' && /guía|DNRPA|mercado|oficial/i.test(el.textContent)) {
        const original = el.textContent.toLowerCase();
        if (original.includes('combinada')) {
          el.textContent = 'Cobertura combinada con datos oficiales y relevamientos de mercado.';
        } else if (original.includes('estim')) {
          el.textContent = 'Referencia estimada con datos oficiales y vehículos comparables.';
        } else {
          el.textContent = GENERIC_COPY.coverage;
        }
      }
    }).observe(el, {childList:true, characterData:true, subtree:true});
  });
}

function init() {
  if (document.body.dataset.page === 'account') return;
  injectCss();
  renameStaticCopy();
  addResultIcons();
  addSharePanel();
  sanitizeDynamicResult();
  watchResults();
  watchStatusAndCoverage();
  watchPublicSourceDetails();
}

document.readyState === 'loading'
  ? document.addEventListener('DOMContentLoaded', init)
  : init();
