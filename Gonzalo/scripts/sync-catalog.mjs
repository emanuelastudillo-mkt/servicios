/**
 * Sincroniza el catálogo desde una hoja Google Sheets publicada como CSV.
 * - Lee filas del CSV.
 * - Descarga imágenes de Google Drive al sitio (assets/products/).
 * - Genera data/catalog.json para que la web nunca consulte Sheets/Drive al navegar.
 *
 * Columnas sugeridas:
 * id | nombre | variedad | presentacion | precio | foto | activo | destacado | orden
 *
 * Variables de entorno:
 * SHEET_CSV_URL = URL CSV publicada de la pestaña "Catalogo"
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(new URL('..', import.meta.url).pathname, '..');
const outputDir = path.join(root, 'assets', 'products');
const outputJson = path.join(root, 'data', 'catalog.json');
const sheetUrl = process.env.SHEET_CSV_URL;

if (!sheetUrl) {
  console.error('Falta la variable SHEET_CSV_URL.');
  process.exit(1);
}

await fs.mkdir(outputDir, { recursive: true });

function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', quote = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i], n=text[i+1];
    if (c==='"' && quote && n==='"') { cell+='"'; i++; continue; }
    if (c==='"') { quote=!quote; continue; }
    if (c===',' && !quote) { row.push(cell); cell=''; continue; }
    if ((c==='\n' || c==='\r') && !quote) {
      if (c==='\r' && n==='\n') i++;
      row.push(cell); cell='';
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row=[]; continue;
    }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const headers = rows.shift().map(h => h.trim().toLowerCase());
  return rows.map(values => Object.fromEntries(headers.map((h,i)=>[h,(values[i]??'').trim()])));
}

function truthy(value, fallback=true) {
  if (value === '' || value == null) return fallback;
  return ['1','true','si','sí','yes','x'].includes(String(value).toLowerCase());
}

function numberOrNull(value) {
  if (!value) return null;
  const normalized = String(value).replace(/\$/g,'').replace(/\./g,'').replace(',','.').replace(/[^0-9.-]/g,'');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function driveId(url='') {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/
  ];
  for (const p of patterns) { const m=String(url).match(p); if (m) return m[1]; }
  return null;
}

function extensionFromType(type='') {
  if (type.includes('png')) return '.png';
  if (type.includes('webp')) return '.webp';
  if (type.includes('gif')) return '.gif';
  return '.jpg';
}

async function downloadImage(url, id, index) {
  if (!url) return 'assets/product-placeholder.svg';
  let fetchUrl = url;
  const fileId = driveId(url);
  if (fileId) fetchUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  try {
    const res = await fetch(fetchUrl, { redirect:'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) throw new Error(`El enlace no devolvió una imagen (${type || 'sin content-type'})`);
    const buffer = Buffer.from(await res.arrayBuffer());
    const hash = crypto.createHash('sha1').update(buffer).digest('hex').slice(0,8);
    const safeId = (id || `producto-${index+1}`).toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'');
    const filename = `${safeId}-${hash}${extensionFromType(type)}`;
    await fs.writeFile(path.join(outputDir, filename), buffer);
    return `assets/products/${filename}`;
  } catch (err) {
    console.warn(`Imagen no descargada para ${id || index+1}: ${err.message}`);
    return 'assets/product-placeholder.svg';
  }
}

const response = await fetch(sheetUrl, { headers: { 'user-agent':'AbuelaFlorentinaCatalogSync/1.0' } });
if (!response.ok) throw new Error(`No se pudo leer Sheets: HTTP ${response.status}`);
const rows = parseCSV(await response.text());
const products = [];

for (let i=0;i<rows.length;i++) {
  const row=rows[i];
  const active=truthy(row.activo, true);
  const id=row.id || `producto-${i+1}`;
  const image=await downloadImage(row.foto || row.imagen || '', id, i);
  products.push({
    id,
    name: row.nombre || 'Tapas para empanadas',
    variety: row.variedad || '',
    presentation: row.presentacion || '',
    price: numberOrNull(row.precio),
    priceLabel: row.precio_texto || null,
    image,
    active,
    featured: truthy(row.destacado, false),
    order: Number(row.orden || i+1)
  });
}

const payload={updatedAt:new Date().toISOString(),products};
await fs.writeFile(outputJson, JSON.stringify(payload,null,2)+'\n','utf8');
console.log(`Catálogo actualizado: ${products.length} productos.`);
