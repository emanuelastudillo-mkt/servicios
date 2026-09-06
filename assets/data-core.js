// Adaptadores originales del catálogo. data.json continúa siendo la fuente de datos.
function normalizeDataset(data){
  const servicesRaw = data.services || data.servicios || data.Servicios_Web || data.SERVICIOS_WEB || [];
  const codesRaw = data.codes || data.codigos || data.códigos || data.Codigos_Web || data.Códigos_Web || data.cupones || data.descuentos || [];
  state.services = mapServiceRows(Array.isArray(servicesRaw) ? servicesRaw : []);
  state.codes = mapCodeRows(Array.isArray(codesRaw) ? codesRaw : []);
}

function mapServiceRows(rows){
  const columns = collectColumns(rows);
  const titleCol = findColumn(columns, [['servicio'], ['nombre'], ['item'], ['producto'], ['titulo'], ['título']]);
  const descCol = findColumn(columns, [['descripcion'], ['descripción'], ['detalle'], ['incluye']]);
  const categoryCol = findColumn(columns, [['categoria'], ['categoría'], ['tipo']]);
  const costCol = findColumn(columns, [['costo'], ['precio'], ['valor']], ['presupuesto','minimo','mínimo','maximo','máximo','meta']);
  const minCol = findColumn(columns, [['presupuesto','minimo'], ['presupuesto','mínimo'], ['inversion','minima'], ['inversión','mínima'], ['meta','min']]);
  const maxCol = findColumn(columns, [['presupuesto','maximo'], ['presupuesto','máximo'], ['inversion','maxima'], ['inversión','máxima'], ['meta','max']]);
  const kindCol = findColumn(columns, [['kind'], ['bonificado'], ['clave']]);

  return rows.map((row, index) => {
    const title = cleanText(getCell(row, 'title') || getCell(row, 'name') || getCell(row, titleCol) || getFirstText(row));
    if (!title) return null;
    const description = cleanDescription(getCell(row, 'description') || getCell(row, descCol), title);
    const category = cleanText(getCell(row, 'category') || getCell(row, categoryCol));
    const costo = parseMoney(getCell(row, 'costo') || getCell(row, 'cost') || getCell(row, 'precio') || getCell(row, costCol));
    const presupuestoMinimo = parseMoney(getCell(row, 'presupuestoMinimo') || getCell(row, 'presupuesto_minimo') || getCell(row, 'metaMin') || getCell(row, minCol));
    const presupuestoMaximo = parseMoney(getCell(row, 'presupuestoMaximo') || getCell(row, 'presupuesto_maximo') || getCell(row, 'metaMax') || getCell(row, maxCol));
    const explicitKind = normalize(getCell(row, 'kind') || getCell(row, kindCol));
    const details = Array.isArray(row.details) ? row.details.map(cleanText).filter(Boolean) : buildDetails(row, [titleCol, descCol, categoryCol, costCol, minCol, maxCol, kindCol, 'title','name','description','costo','cost','precio','presupuestoMinimo','presupuesto_minimo','presupuestoMaximo','presupuesto_maximo','kind']);
    return {
      id: cleanText(row.id) || makeId(title, index),
      title,
      description,
      category,
      costo,
      presupuestoMinimo,
      presupuestoMaximo,
      details,
      kind: explicitKind || detectKind(title)
    };
  }).filter(Boolean);
}

function mapCodeRows(rows){
  const columns = collectColumns(rows);
  const codeCol = findColumn(columns, [['codigo'], ['código'], ['cupon'], ['cupón'], ['promo']]) || columns[0];
  const discountCol = findColumn(columns, [['descuento'], ['valor'], ['monto'], ['porcentaje'], ['off']]);
  const typeCol = findColumn(columns, [['tipo'], ['formato']]);
  const activeCol = findColumn(columns, [['activo'], ['estado'], ['habilitado'], ['vigente']]);
  return rows.map(row => {
    const code = cleanText(row.code || row.codigo || row.código || row.cupon || row.cupón || getCell(row, codeCol));
    if (!code) return null;
    const active = cleanText(row.active ?? row.activo ?? getCell(row, activeCol));
    if (active && /^(no|false|falso|inactivo|vencido|0)$/i.test(normalize(active))) return null;
    const rawValue = row.value ?? row.valor ?? row.descuento ?? getCell(row, discountCol);
    const type = cleanText(row.type || row.tipo || getCell(row, typeCol));
    const parsed = parseDiscount(rawValue, type);
    if (!parsed || !parsed.value) return null;
    return { code, key: codeKey(code), rawValue: cleanText(rawValue), type: parsed.type, value: parsed.value };
  }).filter(Boolean);
}

function collectColumns(rows){ const set = new Set(); rows.forEach(row => Object.keys(row || {}).forEach(k => set.add(k))); return Array.from(set); }
function findColumn(columns, patterns, excludeWords = []){
  const normalizedExcludes = excludeWords.map(normalize);
  for (const pattern of patterns) {
    const normalizedPattern = pattern.map(normalize);
    const found = columns.find(col => {
      const n = normalize(col);
      if (normalizedExcludes.some(ex => n.includes(ex))) return false;
      return normalizedPattern.every(word => n.includes(word));
    });
    if (found) return found;
  }
  return '';
}
function getCell(row, col){ if (!row || !col) return ''; return row[col] ?? ''; }
function getFirstText(row){ return Object.values(row || {}).find(v => cleanText(v)) || ''; }
function buildDetails(row, usedCols){
  const used = new Set(usedCols.filter(Boolean));
  const out = [];
  for (const [key, value] of Object.entries(row || {})) {
    if (used.has(key)) continue;
    const text = cleanText(value);
    if (!text || typeof value === 'object') continue;
    const label = cleanText(key);
    if (!label || /^columna\s+\d+$/i.test(label)) continue;
    const combined = label + ': ' + text;
    if (!out.some(existing => normalize(existing) === normalize(combined))) out.push(combined);
  }
  return out.slice(0, 4);
}
function cleanDescription(value, title){
  const text = cleanText(value);
  if (!text) return '';
  const parts = text.split(/\s*(?:\n|\||•|·)\s*/).map(cleanText).filter(Boolean);
  const unique = [];
  parts.forEach(part => {
    if (normalize(part) === normalize(title)) return;
    if (!unique.some(existing => normalize(existing) === normalize(part))) unique.push(part);
  });
  return unique.join(' · ');
}
function detectKind(title){ const n = normalize(title); if (n.includes('auditoria') || n.includes('auditar')) return 'auditoria'; if (n.includes('dashboard') || n.includes('tablero')) return 'dashboard'; return 'normal'; }

function parseDiscount(value, type){
  const raw = cleanText(value); if (!raw) return null;
  const typeN = normalize(type);
  const isPercent = raw.includes('%') || typeN.includes('porcentaje') || typeN.includes('percent') || typeN.includes('%');
  const isFixed = typeN.includes('monto') || typeN.includes('fijo') || typeN.includes('pesos') || typeN.includes('ars') || raw.includes('$');
  const amount = parseMoney(raw); if (!amount) return null;
  if (isPercent || (!isFixed && amount <= 100)) return { type: 'percent', value: amount };
  return { type: 'fixed', value: amount };
}
function computeDiscountAmount(discount, subtotal){ if (!discount || !subtotal) return 0; if (discount.type === 'percent') return subtotal * discount.value / 100; return discount.value; }


function makeId(title, index){ return normalize(title).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + index; }
function codeKey(value){ return normalize(value).replace(/[^a-z0-9]/g, ''); }
function normalize(value){ return String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
function cleanText(value){ return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function parseMoney(value){
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let s = cleanText(value); if (!s) return 0;
  s = s.replace(/[^0-9,.-]/g, ''); if (!s || s === '-' || s === ',' || s === '.') return 0;
  const lastComma = s.lastIndexOf(','); const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const number = parseFloat(s); return Number.isFinite(number) ? number : 0;
}
function formatMoney(value){ const number = Math.round(Number(value) || 0); return '$' + number.toLocaleString('es-AR'); }
function formatDateTime(value){ try { return new Date(value).toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' }); } catch (err) { return ''; } }
function escapeHtml(value){ return String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char])); }
