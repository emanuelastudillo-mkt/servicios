const $=s=>document.querySelector(s);
const nowYear=new Date().getFullYear();
let marketData,dnrpaData,ratesData,config,catalogData;
let catalogByBrand=new Map(),catalogById=new Map(),marketById=new Map(),dnrpaById=new Map(),marketByBrandModel=new Map(),dnrpaByBrand=new Map(),dnrpaByBrandYear=new Map();
let ratioByBrandYear=new Map(),ratioByYear=new Map(),allRatios=[];
const fmtARS=n=>Number.isFinite(n)?new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n):'—';
const fmtUSD=n=>Number.isFinite(n)?new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n).replace('$','US$ '):'—';
const fmtPct=n=>Number.isFinite(n)?`${n.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—';
function norm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function tokens(s=''){return norm(s).split(/\s+/).filter(x=>x.length>1&&!['DE','DEL','LA','EL','CON','CV','AT','MT','SEDAN','RURAL','PICK','UP','TODO','TERRENO'].includes(x));}
function uniqueSorted(a){return [...new Set(a)].sort((x,y)=>x.localeCompare(y,'es',{numeric:true}));}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function setOptions(el,items,placeholder){el.innerHTML=`<option value="">${placeholder}</option>`+items.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');el.disabled=!items.length;}
function median(values){const a=values.filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return NaN;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function weightedAverage(items){let n=0,d=0;for(const i of items){if(Number.isFinite(i.value)&&Number.isFinite(i.weight)&&i.weight>0){n+=i.value*i.weight;d+=i.weight;}}return d?n/d:NaN;}
function similarity(a,b){const A=new Set(tokens(a)),B=new Set(tokens(b));if(!A.size||!B.size)return 0;const inter=[...A].filter(x=>B.has(x)).length;return inter/Math.sqrt(A.size*B.size);}
function marketKey(brand,model){return `${brand}|${model}`;}

const DATA_SOURCES=[
  ['data/vehicle_market.json','valores de mercado'],
  ['data/dnrpa.json','valuaciones DNRPA'],
  ['data/rates.json','tasas bancarias'],
  ['data/config.json','configuración'],
  ['data/unified_catalog.json','catálogo unificado']
];

async function fetchJson(path,label){
  let response;
  try{
    response=await fetch(new URL(path,document.baseURI),{cache:'no-store',headers:{'Accept':'application/json'}});
  }catch(err){
    throw new Error(`No se pudo conectar con ${label} (${path}). ${err.message||''}`.trim());
  }
  if(!response.ok)throw new Error(`${label}: ${path} respondió HTTP ${response.status}.`);
  const type=response.headers.get('content-type')||'';
  try{
    const text=await response.text();
    if(!text.trim())throw new Error('archivo vacío');
    return JSON.parse(text);
  }catch(err){
    throw new Error(`${label}: ${path} no contiene JSON válido. ${err.message||''}`.trim());
  }
}

function showLoadError(err){
  console.error(err);
  const brand=$('#brand');
  if(brand){brand.innerHTML='<option value="">Error al cargar marcas</option>';brand.disabled=true;}
  ['#model','#variant','#year'].forEach(id=>{const el=$(id);if(el)el.disabled=true;});
  const status=$('#data-status');
  if(!status)return;
  const local=location.protocol==='file:';
  status.dataset.state='error';
  status.textContent=local
    ? 'FACIL AUTO necesita ejecutarse desde HTTP/HTTPS. Abrí la carpeta con un servidor local o desde tu hosting.'
    : `Error de datos: ${err.message||'no se pudieron cargar las fuentes.'}`;
}

async function loadData(){
  if(location.protocol==='file:')throw new Error('La página fue abierta con file:// y el navegador bloquea los archivos JSON.');
  const [m,d,r,c,u]=await Promise.all(DATA_SOURCES.map(([path,label])=>fetchJson(path,label)));
  marketData=m;dnrpaData=d;ratesData=r;config=c;catalogData=u;
  if(!Array.isArray(marketData.rows))throw new Error('data/vehicle_market.json no contiene rows[].');
  if(!Array.isArray(dnrpaData.rows))throw new Error('data/dnrpa.json no contiene rows[].');
  if(!Array.isArray(ratesData.products))throw new Error('data/rates.json no contiene products[].');
  if(!Array.isArray(catalogData.entries))throw new Error('data/unified_catalog.json no contiene entries[].');

  for(const row of marketData.rows){
    marketById.set(row.id,row);
    const key=marketKey(row.brand,row.model);
    if(!marketByBrandModel.has(key))marketByBrandModel.set(key,[]);
    marketByBrandModel.get(key).push(row);
  }
  for(const row of dnrpaData.rows){
    dnrpaById.set(row.id,row);
    if(!dnrpaByBrand.has(row.brand))dnrpaByBrand.set(row.brand,[]);
    dnrpaByBrand.get(row.brand).push(row);
    for(const year of Object.keys(row.values_ars||{})){
      const key=`${row.brand}|${year}`;
      if(!dnrpaByBrandYear.has(key))dnrpaByBrandYear.set(key,[]);
      dnrpaByBrandYear.get(key).push(row);
    }
  }
  for(const entry of catalogData.entries){
    catalogById.set(entry.id,entry);
    if(!catalogByBrand.has(entry.brand))catalogByBrand.set(entry.brand,[]);
    catalogByBrand.get(entry.brand).push(entry);
  }
  buildMarketDnrpaRatios();

  setOptions($('#brand'),uniqueSorted([...catalogByBrand.keys()]),'Elegí una marca');
  $('#fx-rate').value=config.exchange_rate_ars_per_usd||'';
  $('#data-status').textContent=`${catalogData.stats.entries.toLocaleString('es-AR')} combinaciones seleccionables · ${marketData.rows.length.toLocaleString('es-AR')} referencias de mercado · ${dnrpaData.rows.length.toLocaleString('es-AR')} registros DNRPA`;
  const marketDate=[marketData.report_month,marketData.report_year].filter(Boolean).join(' ')||'PDF mensual';
  $('#source-market-date').textContent=marketDate;$('#hero-market-date').textContent=marketDate;
  $('#source-dnrpa-date').textContent=dnrpaData.valid_from||'Tabla vigente';$('#hero-dnrpa-date').textContent=dnrpaData.valid_from||'DNRPA';
  $('#source-rates-date').textContent=ratesData.updated_at?new Date(ratesData.updated_at+'T12:00:00').toLocaleDateString('es-AR'):'Actualizable';
  $('#hero-rates-count').textContent=`${ratesData.products.length} alternativas`;
}

function buildMarketDnrpaRatios(){
  ratioByBrandYear=new Map();ratioByYear=new Map();allRatios=[];
  for(const entry of catalogData.entries){
    if(!(entry.market_ids||[]).length||!(entry.dnrpa_ids||[]).length)continue;
    for(const mid of entry.market_ids){
      const mr=marketById.get(mid);if(!mr)continue;
      for(const did of entry.dnrpa_ids){
        const dr=dnrpaById.get(did);if(!dr)continue;
        for(const [year,p] of Object.entries(mr.prices||{})){
          if(year==='0km'||p.currency!=='ARS')continue;
          const dv=Number(dr.values_ars?.[year]);
          if(!Number.isFinite(dv)||dv<=0)continue;
          const ratio=Number(p.amount)/dv;
          if(!Number.isFinite(ratio)||ratio<.45||ratio>2.8)continue;
          const bk=`${entry.brand}|${year}`;
          if(!ratioByBrandYear.has(bk))ratioByBrandYear.set(bk,[]);
          ratioByBrandYear.get(bk).push(ratio);
          if(!ratioByYear.has(year))ratioByYear.set(year,[]);
          ratioByYear.get(year).push(ratio);allRatios.push(ratio);
        }
      }
    }
  }
}

$('#brand').addEventListener('change',()=>{
  const rows=catalogByBrand.get($('#brand').value)||[];
  setOptions($('#model'),uniqueSorted(rows.map(r=>r.model).filter(Boolean)),'Elegí un modelo');
  setOptions($('#variant'),[],'Primero elegí modelo');setOptions($('#year'),[],'Elegí versión');updateCoverageNote();
});
$('#model').addEventListener('change',()=>{
  const entries=(catalogByBrand.get($('#brand').value)||[]).filter(r=>r.model===$('#model').value);
  setVariantOptions(entries);setOptions($('#year'),[],'Elegí versión');updateCoverageNote();
});
$('#variant').addEventListener('change',()=>{
  const entry=currentEntry();if(!entry){setOptions($('#year'),[],'Elegí versión');updateCoverageNote();return;}
  const el=$('#year');el.innerHTML='<option value="">Elegí año</option>'+entry.years.map(y=>`<option value="${y}">${y==='0km'?'0 km / actual':y}</option>`).join('');el.disabled=false;updateCoverageNote();
});
$('#year').addEventListener('change',updateCoverageNote);

function setVariantOptions(entries){
  const el=$('#variant');
  if(!entries.length){setOptions(el,[],'Sin versiones');return;}
  const main=entries.filter(e=>e.source!=='dnrpa').sort((a,b)=>a.variant.localeCompare(b.variant,'es',{numeric:true}));
  const extra=entries.filter(e=>e.source==='dnrpa').sort((a,b)=>a.variant.localeCompare(b.variant,'es',{numeric:true}));
  let html='<option value="">Elegí una versión</option>';
  if(main.length)html+=`<optgroup label="Guía mensual + coincidencias">${main.map(e=>`<option value="${e.id}">${escapeHtml(e.variant)}</option>`).join('')}</optgroup>`;
  if(extra.length)html+=`<optgroup label="Versiones adicionales DNRPA">${extra.map(e=>`<option value="${e.id}">${escapeHtml(e.variant)}</option>`).join('')}</optgroup>`;
  el.innerHTML=html;el.disabled=false;
}
function currentEntry(){return catalogById.get($('#variant').value)||null;}
function updateCoverageNote(){
  const el=$('#catalog-coverage');if(!el)return;const e=currentEntry();
  if(!e){el.textContent='El catálogo combina la guía mensual con DNRPA para ampliar marcas, modelos y versiones.';el.dataset.tone='neutral';return;}
  const hasM=(e.market_ids||[]).length>0,hasD=(e.dnrpa_ids||[]).length>0;
  if(hasM&&hasD){el.textContent='Cobertura combinada: referencia de mercado + coincidencia DNRPA.';el.dataset.tone='good';}
  else if(hasM){el.textContent='Disponible en la guía de mercado. DNRPA se buscará automáticamente al calcular.';el.dataset.tone='neutral';}
  else{el.textContent='Versión incorporada desde DNRPA. Si falta precio de mercado exacto, se estimará con referencias cercanas.';el.dataset.tone='estimate';}
}

function mileageFactor(year,km){
  if(!km||year==='0km')return 1;
  const mileage=Math.max(0,Number(km)||0);
  const normal=Math.max(1,Number(config.market.km_curve_normal_km)||100000);
  const maxKm=Math.max(normal+1,Number(config.market.km_curve_max_km)||400000);
  const lowBonus=Math.max(0,Number(config.market.km_curve_low_km_bonus)??0.04);
  const maxPenalty=Math.max(0,Math.min(.6,Number(config.market.km_curve_max_penalty)??0.30));
  const curve=Math.max(.1,Number(config.market.km_curve_exponent)||1.4);

  // 0–100.000 km: conserva el valor normal de usado. Solo reconoce, de forma suave,
  // unidades excepcionalmente poco caminadas (máximo +4% a kilometraje cero).
  if(mileage<=normal){
    const t=1-(mileage/normal);
    return 1+(lowBonus*t*t);
  }

  // 100.000–400.000 km: depreciación progresiva/exponencial hasta un máximo del 30%.
  const t=Math.min(1,(mileage-normal)/(maxKm-normal));
  const expNorm=(Math.exp(curve*t)-1)/(Math.exp(curve)-1);
  return 1-(maxPenalty*expNorm);
}
function marketPriceToARS(price,fx){return price.currency==='USD'?price.amount*fx:price.amount;}
function marketPriceToUSD(price,fx){return price.currency==='USD'?price.amount:price.amount/fx;}
function literalMarketValue(price){return price.currency==='USD'?fmtUSD(price.amount):fmtARS(price.amount);}
function sourceUnitText(price){if(price.currency==='USD'&&price.unit==='thousands')return `Fuente en miles de US$ · ${price.raw.toLocaleString('es-AR')} × 1.000`;if(price.currency==='USD')return 'La guía identifica este valor en US$';return `Fuente en miles de pesos · ${price.raw.toLocaleString('es-AR')} × 1.000`;}

function annualGrowthFromSeries(points){
  const sorted=[...points].sort((a,b)=>a.year-b.year),logs=[];
  for(let i=1;i<sorted.length;i++){
    const a=sorted[i-1],b=sorted[i],dy=b.year-a.year;
    if(dy>0&&a.value>0&&b.value>0)logs.push(Math.log(b.value/a.value)/dy);
  }
  const g=median(logs);return Number.isFinite(g)?Math.max(-.08,Math.min(.32,g)):NaN;
}
function estimateNumericSeries(values,targetYear){
  const target=Number(targetYear);if(!Number.isFinite(target))return null;
  const points=Object.entries(values||{}).filter(([y,v])=>/^\d{4}$/.test(y)&&Number.isFinite(Number(v))&&Number(v)>0).map(([y,v])=>({year:Number(y),value:Number(v)})).sort((a,b)=>a.year-b.year);
  if(!points.length)return null;
  const exact=points.find(p=>p.year===target);if(exact)return {value:exact.value,kind:'exact',years:[target]};
  const below=[...points].reverse().find(p=>p.year<target),above=points.find(p=>p.year>target);
  if(below&&above){
    const t=(target-below.year)/(above.year-below.year),value=Math.exp(Math.log(below.value)+(Math.log(above.value)-Math.log(below.value))*t);
    return {value,kind:'interpolated',years:[below.year,above.year]};
  }
  if(points.length>=2){
    const nearest=points.reduce((best,p)=>Math.abs(p.year-target)<Math.abs(best.year-target)?p:best,points[0]);
    const growth=annualGrowthFromSeries(points);
    if(Number.isFinite(growth))return {value:nearest.value*Math.exp(growth*(target-nearest.year)),kind:'extrapolated',years:[nearest.year],distance:Math.abs(target-nearest.year)};
  }
  return {value:points[0].value,kind:'single-point',years:[points[0].year],distance:Math.abs(target-points[0].year)};
}
function estimateMarketRow(row,year,fx){
  const prices=row.prices||{};
  if(prices[year])return {value:marketPriceToARS(prices[year],fx),kind:'exact',row,price:prices[year],years:[year]};
  if(year==='0km')return null;
  const values={};for(const [y,p] of Object.entries(prices)){if(/^\d{4}$/.test(y))values[y]=marketPriceToARS(p,fx);}
  const est=estimateNumericSeries(values,year);if(!est)return null;
  return {...est,row,price:null};
}
function bestDirectMarketEstimate(entry,year,fx){
  const results=(entry.market_ids||[]).map(id=>marketById.get(id)).filter(Boolean).map(r=>estimateMarketRow(r,year,fx)).filter(Boolean);
  if(!results.length)return null;
  const exact=results.filter(r=>r.kind==='exact');
  if(exact.length){const r=exact[0];return {amountARS:r.value,confidence:'Alta',confidenceClass:'high',method:'Valor exacto de la guía mensual',exactPrice:r.price,sourceRows:[r.row],basisCount:1};}
  const interpolated=results.filter(r=>r.kind==='interpolated');
  if(interpolated.length){const r=interpolated[0];return {amountARS:r.value,confidence:'Media-alta',confidenceClass:'medium-high',method:`Interpolación de la misma versión entre ${r.years.join(' y ')}`,exactPrice:null,sourceRows:[r.row],basisCount:2};}
  const extrapolated=results.filter(r=>r.kind==='extrapolated'&&r.distance<=5);
  if(extrapolated.length){const r=extrapolated.sort((a,b)=>a.distance-b.distance)[0];return {amountARS:r.value,confidence:r.distance<=2?'Media':'Media-baja',confidenceClass:r.distance<=2?'medium':'medium-low',method:`Proyección de la misma versión desde ${r.years[0]}`,exactPrice:null,sourceRows:[r.row],basisCount:Math.max(2,Object.keys(r.row.prices||{}).length)};}
  return null;
}
function sameModelMarketEstimate(entry,year,fx){
  const rows=marketByBrandModel.get(marketKey(entry.brand,entry.model))||[];if(!rows.length)return null;
  const scored=[];
  for(const row of rows){
    const est=estimateMarketRow(row,year,fx);if(!est)continue;
    const sim=similarity(`${entry.model} ${entry.variant}`,`${row.model} ${row.variant}`);
    const kindWeight=est.kind==='exact'?1.25:est.kind==='interpolated'?1.05:.82;
    scored.push({...est,sim,weight:(.3+sim*2.2)*kindWeight});
  }
  if(!scored.length)return null;
  scored.sort((a,b)=>(b.sim-a.sim)||(b.weight-a.weight));
  const selected=scored.slice(0,Math.min(7,scored.length));
  const value=weightedAverage(selected.map(x=>({value:x.value,weight:x.weight})));
  if(!Number.isFinite(value))return null;
  const exactCount=selected.filter(x=>x.kind==='exact').length;
  return {amountARS:value,confidence:exactCount>=3?'Media':'Media-baja',confidenceClass:exactCount>=3?'medium':'medium-low',method:exactCount?`Promedio ponderado de ${selected.length} versiones similares del mismo modelo (${exactCount} con año exacto)`:`Promedio ponderado de ${selected.length} versiones similares y años cercanos`,exactPrice:null,sourceRows:selected.map(x=>x.row),basisCount:selected.length};
}
function ratioFor(brand,year){
  let values=ratioByBrandYear.get(`${brand}|${year}`)||[];
  if(values.length>=3)return {ratio:median(values),count:values.length,scope:`${brand} ${year}`};
  if(/^\d{4}$/.test(year)){
    const y=Number(year),near=[];
    for(let d=1;d<=2;d++)for(const yy of [y-d,y+d])near.push(...(ratioByBrandYear.get(`${brand}|${yy}`)||[]));
    values=[...values,...near];if(values.length>=3)return {ratio:median(values),count:values.length,scope:`${brand}, años cercanos`};
  }
  values=ratioByYear.get(year)||[];if(values.length>=6)return {ratio:median(values),count:values.length,scope:`mercado general ${year}`};
  return {ratio:median(allRatios),count:allRatios.length,scope:'mercado general'};
}
function estimateDnrpaRow(row,year){
  if(year==='0km')return null;
  const exact=Number(row.values_ars?.[year]);if(Number.isFinite(exact))return {value:exact,kind:'exact',years:[year]};
  return estimateNumericSeries(row.values_ars||{},year);
}
function textScoreEntryDnrpa(entry,row){
  const et=tokens(`${entry.model} ${entry.variant}`),rt=new Set(tokens(`${row.model} ${row.body_type}`));if(!et.length)return 0;
  let weighted=0,total=0;for(const t of et){const w=norm(entry.model).includes(t)?2.5:1;total+=w;if(rt.has(t))weighted+=w;}
  return total?weighted/total:0;
}
function findDnrpaForEntry(entry,year){
  if(year==='0km')return null;
  let candidates=(entry.dnrpa_ids||[]).map(id=>dnrpaById.get(id)).filter(Boolean);
  const attached=candidates.length>0;
  if(!candidates.length)candidates=dnrpaByBrandYear.get(`${entry.brand}|${year}`)||dnrpaByBrand.get(entry.brand)||[];
  let best=null;
  for(const row of candidates){
    const val=estimateDnrpaRow(row,year);if(!val)continue;
    let score=textScoreEntryDnrpa(entry,row)+(val.kind==='exact'?.18:0)+(attached?.08:0);
    if(!best||score>best.score)best={row,score,...val,attached};
  }
  if(!best&&!attached){
    for(const row of (dnrpaByBrand.get(entry.brand)||[])){
      const val=estimateDnrpaRow(row,year);if(!val)continue;
      const score=textScoreEntryDnrpa(entry,row)+(val.kind==='exact'?.18:0);
      if(!best||score>best.score)best={row,score,...val,attached:false};
    }
  }
  return best;
}
function dnrpaBasedMarketEstimate(entry,year,dmatch){
  if(!dmatch||!Number.isFinite(dmatch.value))return null;
  const ratio=ratioFor(entry.brand,year);if(!Number.isFinite(ratio.ratio))return null;
  return {amountARS:dmatch.value*ratio.ratio,confidence:'Baja',confidenceClass:'low',method:`Estimación desde valuación DNRPA × relación mercado/registro (${ratio.scope}, ${ratio.count} referencias)`,exactPrice:null,sourceRows:[],basisCount:ratio.count};
}
function marketEstimate(entry,year,fx,dmatch){
  return bestDirectMarketEstimate(entry,year,fx)||sameModelMarketEstimate(entry,year,fx)||dnrpaBasedMarketEstimate(entry,year,dmatch);
}

function monthlyPayment(principal,months,rate){if(principal<=0)return 0;if(rate<=0)return principal/months;const p=Math.pow(1+rate,months);return principal*rate*p/(p-1);}
function financeOffers(principal,months){return ratesData.products.filter(p=>months>=p.min_months&&months<=p.max_months).map(p=>{const cftMonthly=Math.pow(1+p.cft_tea/100,1/12)-1,tnaMonthly=p.tna/100/12,payment=monthlyPayment(principal,months,tnaMonthly),cftReferencePayment=monthlyPayment(principal,months,cftMonthly);return {...p,payment,cftReferencePayment,total:payment*months,cftReferenceTotal:cftReferencePayment*months};}).sort((a,b)=>a.cft_tea-b.cft_tea||a.payment-b.payment);}
function renderBanks(offers,months){const list=$('#bank-list');if(!offers.length){list.innerHTML='<div class="bank-row"><div class="bank-name"><b>Sin alternativas para este plazo</b><span>Actualizá la base de tasas o elegí otro plazo.</span></div></div>';return;}list.innerHTML=offers.slice(0,6).map((o,i)=>`<div class="bank-row"><div class="bank-name"><b>${escapeHtml(o.bank)}${i===0?'<span class="best-tag">MENOR CFT</span>':''}</b><span>${escapeHtml(o.product)}${o.requires_client?' · requiere cliente':''}</span></div><div class="bank-cell"><b>${fmtPct(o.tna)}</b></div><div class="bank-cell"><b>${fmtPct(o.cft_tea)}</b></div><div class="bank-cell bank-total"><b>${fmtARS(o.total)}</b></div><div class="bank-cell bank-payment"><b>${fmtARS(o.payment)}</b></div></div>`).join('');}

function opportunityState(price,guide){
  if(!price||!guide)return null;
  const offset=Number(config.opportunity?.market_offset_percent??15);
  const rawPct=(price-guide)/guide*100;
  // La lectura de oportunidad usa un corrimiento comercial sobre la guía, sin modificar la valuación mostrada.
  // Con offset=15, un precio idéntico al valor guía se presenta como -15% en la lectura.
  const pct=rawPct-offset,abs=Math.abs(pct),commercialReference=guide*(1+offset/100),difference=price-commercialReference;
  const strong=Number(config.opportunity?.strong_below_percent??-15),good=Number(config.opportunity?.good_below_percent??-7),band=Number(config.opportunity?.market_band_percent??7),high=Number(config.opportunity?.high_above_percent??15);
  let rating,klass;
  if(pct<=strong){rating='Oportunidad fuerte';klass='is-good';}
  else if(pct<=good){rating='Buena oportunidad';klass='is-good';}
  else if(pct<band){rating='En precio de mercado';klass='is-neutral';}
  else if(pct<high){rating='Precio exigente';klass='is-bad';}
  else{rating='Muy por encima del mercado';klass='is-bad';}
  return {pct,abs,rawPct,offset,commercialReference,difference,rating,klass};
}
function renderOpportunity(op,hasEnteredPrice){
  const panel=$('#opportunity-panel');panel.classList.remove('is-good','is-bad','is-neutral');
  if(!hasEnteredPrice||!op){
    const offset=Number(config.opportunity?.market_offset_percent??15);
    $('#opportunity-rating').textContent='Ingresá un precio para comparar';$('#opportunity-pct').textContent='—';$('#opportunity-direction').textContent='vs. mercado ajustado';
    $('#opportunity-text').textContent=`La lectura aplica un margen comercial de ${offset.toLocaleString('es-AR')}% sobre la guía sin modificar el valor de valuación.`;
    $('#opportunity-marker').style.left='50%';return;
  }
  panel.classList.add(op.klass);$('#opportunity-rating').textContent=op.rating;$('#opportunity-pct').textContent=`${op.abs.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;
  $('#opportunity-direction').textContent=op.pct<0?'debajo del mercado ajustado':op.pct>0?'arriba del mercado ajustado':'en mercado ajustado';
  $('#opportunity-text').textContent=`Lectura ajustada ${op.offset.toLocaleString('es-AR')} p.p. sobre la guía. La referencia comercial equivale a ${fmtARS(op.commercialReference)} y la diferencia monetaria es ${fmtARS(Math.abs(op.difference))} ${op.difference<=0?'a favor del comprador':'por encima de esa referencia'}.`;
  const clamped=Math.max(-20,Math.min(20,op.pct));$('#opportunity-marker').style.left=`${((clamped+20)/40)*100}%`;
}

$('#vehicle-form').addEventListener('submit',e=>{
  e.preventDefault();const entry=currentEntry(),year=$('#year').value;if(!entry||!year)return;
  const km=Number($('#km').value)||0,fx=Number($('#fx-rate').value)||config.exchange_rate_ars_per_usd||1;
  const dmatch=findDnrpaForEntry(entry,year),mestimate=marketEstimate(entry,year,fx,dmatch);
  if(!mestimate||!Number.isFinite(mestimate.amountARS)){
    $('#data-status').textContent='No fue posible construir una referencia para esta combinación. Revisá la versión o actualizá las fuentes.';return;
  }
  const factor=mileageFactor(year,km),guideARS=mestimate.amountARS,adjustedARS=guideARS*factor,adjustedUSD=adjustedARS/fx;
  const buyARS=adjustedARS*config.market.purchase_factor,saleARS=adjustedARS*config.market.sale_factor;
  const typedPrice=Number($('#operation-price').value)||0,hasEnteredPrice=typedPrice>0,operationPrice=hasEnteredPrice?typedPrice:adjustedARS;
  const defaultDown=operationPrice*config.financing.default_down_payment_percent,down=Math.min(operationPrice,Number($('#down-payment').value)||defaultDown),months=Number($('#term').value),principal=Math.max(0,operationPrice-down),offers=financeOffers(principal,months),bestOffer=offers[0]||null;
  const opp=opportunityState(hasEnteredPrice?typedPrice:null,adjustedARS);renderOpportunity(opp,hasEnteredPrice);

  const drow=dmatch?.row,dval=dmatch?.value,registryFee=Number.isFinite(dval)?dval*config.transfer.registry_percent:0,juris=$('#jurisdiction').value,buyer=$('#buyer-type').value,stampRate=juris==='pba'?(buyer==='habitualist'?config.transfer.pba_stamp_habitualist_percent:config.transfer.pba_stamp_particular_percent):0,stampBase=Number.isFinite(dval)?Math.max(dval,operationPrice):operationPrice,stampFee=stampBase*stampRate,fixed=Number(config.transfer.fixed_fees_ars)||0,transferTotal=registryFee+stampFee+fixed,cashClose=operationPrice+transferTotal,financeClose=down+(bestOffer?bestOffer.total:principal)+transferTotal;

  $('#result-unit').textContent=`${entry.brand} ${entry.model} · ${entry.variant} · ${year==='0km'?'0 km':year}${km?` · ${km.toLocaleString('es-AR')} km`:''}`;
  $('#market-value').textContent=fmtARS(adjustedARS);const factorPct=(factor-1)*100;$('#market-adjustment').textContent=factor===1?`Equivale a ${fmtUSD(adjustedUSD)} al dólar configurado`:`${factorPct>0?'+':''}${factorPct.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})}% por kilometraje · ${fmtUSD(adjustedUSD)}`;
  if(mestimate.exactPrice){$('#market-pdf-value').textContent=literalMarketValue(mestimate.exactPrice);$('#market-pdf-unit').textContent=sourceUnitText(mestimate.exactPrice);}else{$('#market-pdf-value').textContent='Sin valor exacto';$('#market-pdf-unit').textContent='Se usa una estimación, no una cifra literal del PDF';}
  $('#market-confidence').textContent=mestimate.confidence;$('#market-method').textContent=mestimate.method;$('#buy-value').textContent=fmtARS(buyARS);$('#sale-value').textContent=fmtARS(saleARS);
  const pages=uniqueSorted((mestimate.sourceRows||[]).map(r=>r.page).filter(Boolean));$('#market-source').textContent=`${marketData.source} · ${marketData.report_month||''} ${marketData.report_year||''}${pages.length?` · pág. ${pages.slice(0,4).join(', ')}${pages.length>4?'…':''}`:''} · Confianza ${mestimate.confidence.toLowerCase()}`;

  $('#dnrpa-value').textContent=Number.isFinite(dval)?fmtARS(dval):year==='0km'?'No aplica a 0 km':'Sin referencia';
  const dstate=dmatch?(dmatch.kind==='exact'?'Exacta':dmatch.kind==='interpolated'?'Estimada entre años':dmatch.kind==='extrapolated'?'Proyectada desde año cercano':'Aproximada'):'Sin coincidencia';
  $('#dnrpa-status').textContent=dstate;
  $('#dnrpa-match').textContent=drow?`${drow.model} · coincidencia ${Math.max(0,Math.min(99,Math.round(dmatch.score*100)))}%${dmatch.kind!=='exact'?' · valor estimado':''}`:year==='0km'?'Consultar alta / patentamiento':'No se encontró versión oficial equivalente';
  $('#registry-fee').textContent=Number.isFinite(dval)?fmtARS(registryFee):'—';$('#stamp-fee').textContent=stampRate?fmtARS(stampFee):'No modelado';$('#fixed-fees').textContent=fmtARS(fixed);$('#transfer-total').textContent=fmtARS(transferTotal);$('#dnrpa-source').textContent=`DNRPA · vigencia ${dnrpaData.valid_from||'sin fecha'}${drow?` · pág. ${drow.page}`:''}${dmatch&&dmatch.kind!=='exact'?` · ${dstate.toLowerCase()}`:''}`;

  $('#loan-amount').textContent=fmtARS(principal);renderBanks(offers,months);$('#finance-source').textContent=`${ratesData.source} · actualización ${ratesData.updated_at}. ${ratesData.calculation_note}`;$('#cash-close').textContent=fmtARS(cashClose);$('#finance-close').textContent=fmtARS(financeClose);$('#finance-close-bank').textContent=bestOffer?`${bestOffer.bank} · ${months} cuotas de ${fmtARS(bestOffer.payment)}`:'Sin financiación seleccionable';$('#operation-used').textContent=hasEnteredPrice?fmtARS(operationPrice):`${fmtARS(operationPrice)} · referencia estimada`;

  $('#resultados').hidden=false;$('#resultados').scrollIntoView({behavior:'smooth',block:'start'});
});

loadData().catch(showLoadError);
