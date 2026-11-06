import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SHEETS = Object.freeze({id:'1W57cUM6iFoMkjhzJeTsCp3AKWBc46k7Xesxh5mUihZs',servicesGid:0,codesGid:1926385980});
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
const key=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const slug=value=>key(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const kindFor=title=>/auditoria|auditar/.test(key(title))?'auditoria':/dashboard|tablero/.test(key(title))?'dashboard':'normal';

export function parseCSV(input){
  const text=input.replace(/^\uFEFF/,'');
  if(/^\s*</.test(text))throw new Error('Google devolvió HTML en lugar de CSV. No se actualizó el catálogo.');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++;}else if(c==='"')quoted=false;else cell+=c;}
    else if(c==='"'){if(cell)throw new Error('CSV inválido: comilla fuera de campo.');quoted=true;}
    else if(c===','){row.push(cell);cell='';}
    else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value.trim()))rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(quoted)throw new Error('CSV incompleto: faltan comillas de cierre.');
  row.push(cell);if(row.some(value=>value.trim()))rows.push(row);
  return rows;
}

function table(csv,required){
  const [headers,...rows]=parseCSV(csv);if(!headers)throw new Error('La pestaña está vacía.');
  const names=headers.map(key);
  for(const header of required){if(names.filter(name=>name===header).length!==1)throw new Error('Falta o está duplicada la columna: '+header);}
  return rows.map((row,index)=>({row:index+2,values:Object.fromEntries(names.map((name,i)=>[name,row[i]??'']).filter(([name])=>name))})).filter(record=>Object.values(record.values).some(value=>clean(value)));
}

export function parseAmount(value,{optional=false,label='Importe'}={}){
  let text=clean(value);
  if(text===''||text==='-'){if(optional)return 0;throw new Error(label+': falta un valor.');}
  text=text.replace(/^(?:ARS\s*)?\$?\s*/i,'').replace(/\s/g,'');
  if(!/^\d+(?:[.,]\d+)*$/.test(text))throw new Error(label+': importe inválido.');
  if(text.includes(',')){
    if(!/^\d{1,3}(?:\.\d{3})*,\d{1,2}$/.test(text)&&!/^\d+,\d{1,2}$/.test(text))throw new Error(label+': formato decimal inválido.');
    text=text.replace(/\./g,'').replace(',','.');
  }else if(/^\d{1,3}(?:\.\d{3})+$/.test(text))text=text.replace(/\./g,'');
  else if(!/^\d+(?:\.\d{1,2})?$/.test(text))throw new Error(label+': formato numérico inválido.');
  const number=Number(text);if(!Number.isFinite(number)||number<0||number>Number.MAX_SAFE_INTEGER/100)throw new Error(label+': valor fuera de rango.');
  return number;
}

export function createDataset(servicesCsv,codesCsv,previous={},now=new Date()){
  const serviceRows=table(servicesCsv,['nombre','acciones','costo','requisitos','presupuesto minimo mensual','presupuesto maximo mensual','estado']);
  if(!serviceRows.length)throw new Error('No hay filas de servicios. Se conserva el catálogo anterior.');
  const oldServices=[...(previous.services||[]),...(previous.inactiveServices||[])];
  const oldByName=new Map(oldServices.map(service=>[key(service.title),service]));
  const seen=new Set(),services=[],inactiveServices=[];
  for(const {values:r,row} of serviceRows){
    const title=clean(r.nombre);if(!title)throw new Error('Servicios_Web fila '+row+': falta Nombre.');
    const explicitId=clean(r.id);
    const previousService=oldByName.get(key(title));
    const id=explicitId||previousService?.id||slug(title);
    if(!id||seen.has(id))throw new Error('Servicios_Web: ID o nombre duplicado en fila '+row+'.');seen.add(id);
    const status=key(r.estado);
    if(!['disponible','no disponible'].includes(status))throw new Error('Servicios_Web fila '+row+': Estado debe ser Disponible o No disponible.');
    const costo=parseAmount(r.costo,{label:'Costo fila '+row});
    const presupuestoMinimo=parseAmount(r['presupuesto minimo mensual'],{optional:true,label:'Presupuesto mínimo fila '+row});
    const presupuestoMaximo=parseAmount(r['presupuesto maximo mensual'],{optional:true,label:'Presupuesto máximo fila '+row});
    if(presupuestoMaximo&&presupuestoMaximo<presupuestoMinimo)throw new Error('Presupuesto máximo menor al mínimo en fila '+row+'.');
    const category=clean(r.categoria)||previousService?.category||'Meta Ads';
    const service={id,title,description:clean(r.acciones),category,costo,presupuestoMinimo,presupuestoMaximo,details:clean(r.requisitos)&&clean(r.requisitos)!=='-'?['Requisitos: '+clean(r.requisitos)]:[],kind:previousService?.kind||kindFor(title)};
    (status==='disponible'?services:inactiveServices).push(service);
  }
  const codeRows=table(codesCsv,['codigo','descuento aplicado']);
  const codeKeys=new Set();
  const codes=codeRows.map(({values:r,row})=>{
    const code=clean(r.codigo),normalized=key(code).replace(/[^a-z0-9]/g,'');
    if(!normalized||codeKeys.has(normalized))throw new Error('Codigos_Web: código vacío o duplicado en fila '+row+'.');codeKeys.add(normalized);
    const raw=clean(r['descuento aplicado']);
    if(!raw)throw new Error('Codigos_Web fila '+row+': falta el descuento.');
    const fixed=/\$|ARS/i.test(raw);
    let amount=parseAmount(raw.replace(/%$/,''),{label:'Descuento fila '+row});
    const percentage=raw.endsWith('%')||!fixed&&amount<=100;
    if(percentage&&!raw.endsWith('%')&&amount>0&&amount<1)amount*=100;
    if(percentage&&amount>100)throw new Error('Descuento mayor al 100% en fila '+row+'.');
    return {code,type:percentage?'percent':'fixed',value:amount,active:true};
  });
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  const contentChanged=!same(services,previous.services)||!same(codes,previous.codes)||!same(inactiveServices,previous.inactiveServices||[]);
  const visibleChanged=!same(services,previous.services);
  const dataset={updatedAt:contentChanged?now.toISOString():previous.updatedAt||now.toISOString(),checkedAt:now.toISOString(),source:{spreadsheetId:SHEETS.id,servicesSheet:'Servicios_Web',codesSheet:'Codigos_Web'},services,inactiveServices,codes};
  return {dataset,contentChanged,visibleChanged};
}

export function updateSitemap(xml,isoDate){
  const rootEntry=/<url>\s*<loc>https:\/\/emanuelmkt\.com\.ar\/<\/loc>[\s\S]*?<\/url>/;
  if(!rootEntry.test(xml))throw new Error('No se encontró la portada en sitemap.xml.');
  return xml.replace(rootEntry,entry=>/<lastmod>[^<]*<\/lastmod>/.test(entry)?entry.replace(/<lastmod>[^<]*<\/lastmod>/,`<lastmod>${isoDate}</lastmod>`):entry.replace('</loc>',`</loc>\n    <lastmod>${isoDate}</lastmod>`));
}

export async function fetchSheet(gid,fetchFn=fetch){
  const url=`https://docs.google.com/spreadsheets/d/${SHEETS.id}/gviz/tq?tqx=out:csv&gid=${gid}`;
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const response=await fetchFn(url,{signal:AbortSignal.timeout(30000),headers:{Accept:'text/csv'}});
      if(!response.ok)throw new Error('Google Sheets respondió HTTP '+response.status+'.');
      if(!/\b(?:text\/csv|application\/csv)\b/i.test(response.headers.get('content-type')||''))throw new Error('La planilla no devolvió CSV. Revisar su acceso de lectura.');
      const body=await response.text();if(body.length>5_000_000)throw new Error('La pestaña excede el tamaño previsto.');
      return body;
    }catch(error){lastError=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}
  }
  throw lastError;
}

export async function sync({directory=path.resolve(fileURLToPath(new URL('../',import.meta.url))),dryRun=false,fetchFn=fetch,now=new Date()}={}){
  const dataPath=path.join(directory,'data.json'),sitemapPath=path.join(directory,'sitemap.xml');
  const previous=JSON.parse((await fs.readFile(dataPath,'utf8')).replace(/^\uFEFF/,''));
  const originalSitemap=await fs.readFile(sitemapPath,'utf8');
  const [serviceCsv,codesCsv]=await Promise.all([fetchSheet(SHEETS.servicesGid,fetchFn),fetchSheet(SHEETS.codesGid,fetchFn)]);
  const result=createDataset(serviceCsv,codesCsv,previous,now);
  const sitemap=result.visibleChanged?updateSitemap(originalSitemap,now.toISOString().slice(0,10)):originalSitemap;
  // Fetch and validate both sheets and the sitemap before either output is changed.
  if(!dryRun){
    await fs.writeFile(dataPath,JSON.stringify(result.dataset,null,2)+'\n');
    if(sitemap!==originalSitemap)await fs.writeFile(sitemapPath,sitemap);
  }
  const summary={dryRun,services:result.dataset.services.length,inactive:result.dataset.inactiveServices.length,codes:result.dataset.codes.length,contentChanged:result.contentChanged,visibleChanged:result.visibleChanged,updatedAt:result.dataset.updatedAt,checkedAt:result.dataset.checkedAt};
  console.log(JSON.stringify(summary,null,2));return {...result,summary};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--dry-run')){console.error('Uso: node scripts/sync-google-sheets.mjs [--dry-run]');process.exitCode=1;}
  else sync({dryRun:args.includes('--dry-run')}).catch(error=>{console.error('Sincronización cancelada: '+error.message);process.exitCode=1;});
}
