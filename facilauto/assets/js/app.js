const $ = (s) => document.querySelector(s);
const fmtARS = (n) => Number.isFinite(n) ? new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n) : '—';
const fmtUSD = (n) => Number.isFinite(n) ? `USD ${new Intl.NumberFormat('es-AR',{maximumFractionDigits:0}).format(n)}` : '—';
const fmtPct = (n) => Number.isFinite(n) ? `${new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(n)}%` : '—';
const nowYear = new Date().getFullYear();

let marketData, dnrpaData, ratesData, config;
let marketByBrand = new Map();
let dnrpaByBrandYear = new Map();

function normalize(s=''){
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/(\d)[,.](\d)/g,'$1$2').replace(/[^A-Z0-9]+/g,' ').replace(/\s+/g,' ').trim();
}
function tokens(s=''){
  const stop=new Set(['5P','4P','3P','2P','P','PUERTAS','PUERTA','SEDAN','RURAL','TODO','TERRENO','C','S','D','DE','DEL','LA','EL','CON','SIN','CV','CVT','MT','AT']);
  return normalize(s).split(' ').map(t=>t.replace(/^(\d{2})L$/,'$1')).filter(t=>t.length>1 && !stop.has(t));
}
function uniqueSorted(arr){return [...new Set(arr)].sort((a,b)=>a.localeCompare(b,'es',{numeric:true}));}
function setOptions(el, items, placeholder){
  el.innerHTML=`<option value="">${placeholder}</option>`+items.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  el.disabled=!items.length;
}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

async function loadData(){
  const [m,d,r,c]=await Promise.all([
    fetch('data/vehicle_market.json').then(x=>x.json()),
    fetch('data/dnrpa.json').then(x=>x.json()),
    fetch('data/rates.json').then(x=>x.json()),
    fetch('data/config.json').then(x=>x.json())
  ]);
  marketData=m;dnrpaData=d;ratesData=r;config=c;
  for(const row of marketData.rows){
    if(!row.brand) continue;
    if(!marketByBrand.has(row.brand)) marketByBrand.set(row.brand,[]);
    marketByBrand.get(row.brand).push(row);
  }
  for(const row of dnrpaData.rows){
    for(const year of Object.keys(row.values_ars||{})){
      const key=`${row.brand}|${year}`;
      if(!dnrpaByBrandYear.has(key)) dnrpaByBrandYear.set(key,[]);
      dnrpaByBrandYear.get(key).push(row);
    }
  }
  setOptions($('#brand'),uniqueSorted([...marketByBrand.keys()]),'Elegí una marca');
  $('#fx-rate').value=config.exchange_rate_ars_per_usd||'';
  $('#data-status').textContent=`Listo · ${marketData.rows.length.toLocaleString('es-AR')} versiones · ${dnrpaData.rows.length.toLocaleString('es-AR')} registros DNRPA`;
  $('#source-market-date').textContent=[marketData.report_month,marketData.report_year].filter(Boolean).join(' ')||'PDF mensual';
  $('#source-dnrpa-date').textContent=dnrpaData.valid_from||'Tabla DNRPA';
  $('#source-rates-date').textContent=ratesData.updated_at ? new Date(ratesData.updated_at+'T12:00:00').toLocaleDateString('es-AR') : 'Actualizable';
}

$('#brand').addEventListener('change',()=>{
  const rows=marketByBrand.get($('#brand').value)||[];
  setOptions($('#model'),uniqueSorted(rows.map(r=>r.model).filter(Boolean)),'Elegí un modelo');
  setOptions($('#variant'),[],'Primero elegí modelo');setOptions($('#year'),[],'Elegí versión');
});
$('#model').addEventListener('change',()=>{
  const rows=(marketByBrand.get($('#brand').value)||[]).filter(r=>r.model===$('#model').value);
  setOptions($('#variant'),uniqueSorted(rows.map(r=>r.variant)),'Elegí una versión');setOptions($('#year'),[],'Elegí versión');
});
$('#variant').addEventListener('change',()=>{
  const row=currentMarketRow();
  if(!row){setOptions($('#year'),[],'Elegí versión');return;}
  const yrs=Object.keys(row.values_usd||{}).sort((a,b)=>a==='0km'?-1:b==='0km'?1:Number(b)-Number(a));
  const el=$('#year');
  el.innerHTML='<option value="">Elegí año</option>'+yrs.map(y=>`<option value="${y}">${y==='0km'?'0 km / actual':y}</option>`).join('');el.disabled=false;
});
function currentMarketRow(){
  return (marketByBrand.get($('#brand').value)||[]).find(r=>r.model===$('#model').value && r.variant===$('#variant').value);
}

function mileageFactor(year,km){
  if(!km || year==='0km') return 1;
  const y=Number(year); if(!y) return 1;
  const age=Math.max(1,nowYear-y); const expected=age*config.market.expected_km_per_year; const diff=km-expected;
  if(diff>0){return 1-Math.min(config.market.max_km_penalty,(diff/10000)*config.market.km_penalty_per_10000_over);}
  return 1+Math.min(config.market.max_km_bonus,(Math.abs(diff)/10000)*config.market.km_bonus_per_10000_under);
}

function findDnrpa(marketRow,year){
  const candidates=dnrpaByBrandYear.get(`${marketRow.brand}|${year}`)||[];
  if(!candidates.length) return null;
  const modelT=tokens(marketRow.model);const variantT=tokens(marketRow.variant);
  const weighted=[];modelT.forEach(t=>weighted.push([t,3]));variantT.forEach(t=>weighted.push([t,1]));
  const denom=weighted.reduce((a,[,w])=>a+w,0)||1;
  let best=null;
  for(const c of candidates){
    const ct=new Set(tokens(`${c.model} ${c.body_type}`));
    let score=weighted.reduce((a,[t,w])=>a+(ct.has(t)?w:0),0)/denom;
    if(modelT[0] && ct.has(modelT[0])) score+=.18;
    const eng=variantT.find(t=>/^\d{2,3}$/.test(t)); if(eng && ct.has(eng)) score+=.07;
    if(!best||score>best.score) best={row:c,score};
  }
  return best;
}

function monthlyPayment(principal,months,rate){
  if(principal<=0) return 0;if(rate<=0) return principal/months;
  const p=Math.pow(1+rate,months);return principal*rate*p/(p-1);
}
function financeOffers(principal,months){
  return ratesData.products.filter(p=>months>=p.min_months&&months<=p.max_months).map(p=>{
    const cftMonthly=Math.pow(1+p.cft_tea/100,1/12)-1;
    const tnaMonthly=p.tna/100/12;
    const payment=monthlyPayment(principal,months,tnaMonthly);
    const cftReferencePayment=monthlyPayment(principal,months,cftMonthly);
    return {...p,payment,cftReferencePayment,total:payment*months,cftReferenceTotal:cftReferencePayment*months};
  }).sort((a,b)=>a.cft_tea-b.cft_tea || a.payment-b.payment);
}

function renderBanks(offers,months){
  const list=$('#bank-list');
  if(!offers.length){list.innerHTML='<div class="bank-row"><div class="bank-name"><b>Sin alternativas para este plazo</b><span>Actualizá la base de tasas o elegí otro plazo.</span></div></div>';return;}
  list.innerHTML=offers.slice(0,6).map((o,i)=>`<div class="bank-row">
    <div class="bank-name"><b>${escapeHtml(o.bank)}${i===0?'<span class="best-tag">MENOR CFT</span>':''}</b><span>${escapeHtml(o.product)}${o.requires_client?' · requiere cliente':''}</span></div>
    <div class="bank-cell"><small>TNA</small><b>${fmtPct(o.tna)}</b></div>
    <div class="bank-cell bank-cft"><small>CFT TEA</small><b>${fmtPct(o.cft_tea)}</b></div>
    <div class="bank-cell bank-total"><small>Total ${months} cuotas</small><b>${fmtARS(o.total)}</b></div>
    <div class="bank-cell bank-payment"><small>Cuota aprox.</small><b>${fmtARS(o.payment)}</b></div>
  </div>`).join('');
}

$('#vehicle-form').addEventListener('submit',(e)=>{
  e.preventDefault();
  const mrow=currentMarketRow(),year=$('#year').value;
  if(!mrow||!year) return;
  const baseUSD=Number(mrow.values_usd[year]);
  const km=Number($('#km').value)||0;const fx=Number($('#fx-rate').value)||config.exchange_rate_ars_per_usd||1;
  const factor=mileageFactor(year,km);const adjustedUSD=baseUSD*factor;
  const buyUSD=adjustedUSD*config.market.purchase_factor;const saleUSD=adjustedUSD*config.market.sale_factor;
  const baseARS=adjustedUSD*fx,buyARS=buyUSD*fx,saleARS=saleUSD*fx;
  const operationPrice=Number($('#operation-price').value)||saleARS;
  const defaultDown=operationPrice*config.financing.default_down_payment_percent;
  const down=Math.min(operationPrice,Number($('#down-payment').value)||defaultDown);
  const months=Number($('#term').value);const principal=Math.max(0,operationPrice-down);
  const offers=financeOffers(principal,months);const bestOffer=offers[0]||null;

  const match=findDnrpa(mrow,year);
  const drow=match?.row;const dval=drow?Number(drow.values_ars[year]):NaN;
  const registryFee=Number.isFinite(dval)?dval*config.transfer.registry_percent:0;
  const juris=$('#jurisdiction').value;const buyer=$('#buyer-type').value;
  const stampRate=juris==='pba'?(buyer==='habitualist'?config.transfer.pba_stamp_habitualist_percent:config.transfer.pba_stamp_particular_percent):0;
  const stampBase=Number.isFinite(dval)?Math.max(dval,operationPrice):operationPrice;
  const stampFee=stampBase*stampRate;const fixed=Number(config.transfer.fixed_fees_ars)||0;
  const transferTotal=registryFee+stampFee+fixed;
  const cashClose=operationPrice+transferTotal;
  const financeClose=down+(bestOffer?bestOffer.total:principal)+transferTotal;

  $('#result-unit').textContent=`${mrow.brand} · ${mrow.model} · ${mrow.variant} · ${year==='0km'?'0 km':year}${km?` · ${km.toLocaleString('es-AR')} km`:''}`;
  $('#market-value').textContent=fmtARS(baseARS);$('#market-usd').textContent=`${fmtUSD(adjustedUSD)} · guía ${fmtUSD(baseUSD)}${factor!==1?' ajustada por km':''}`;
  $('#buy-value').textContent=fmtARS(buyARS);$('#buy-usd').textContent=fmtUSD(buyUSD);$('#sale-value').textContent=fmtARS(saleARS);$('#sale-usd').textContent=fmtUSD(saleUSD);
  $('#market-source').textContent=`${marketData.source} · ${marketData.report_month||''} ${marketData.report_year||''} · página ${mrow.page}`;

  $('#dnrpa-value').textContent=Number.isFinite(dval)?fmtARS(dval):'Sin coincidencia';
  $('#dnrpa-match').textContent=drow?`${drow.model} · ${drow.body_type} · coincidencia ${Math.max(0,Math.min(99,Math.round(match.score*100)))}%`:'No se encontró una versión oficial equivalente para este año';
  $('#registry-fee').textContent=Number.isFinite(dval)?fmtARS(registryFee):'—';$('#stamp-fee').textContent=stampRate?fmtARS(stampFee):'No modelado';$('#fixed-fees').textContent=fmtARS(fixed);$('#transfer-total').textContent=fmtARS(transferTotal);
  $('#dnrpa-source').textContent=`DNRPA · vigencia ${dnrpaData.valid_from||'sin fecha'}${drow?` · pág. ${drow.page}`:''}`;

  $('#loan-amount').textContent=fmtARS(principal);renderBanks(offers,months);$('#finance-source').textContent=`${ratesData.source} · actualización ${ratesData.updated_at}. ${ratesData.calculation_note}`;
  $('#cash-close').textContent=fmtARS(cashClose);$('#finance-close').textContent=fmtARS(financeClose);$('#finance-close-bank').textContent=bestOffer?`${bestOffer.bank} · ${months} cuotas de ${fmtARS(bestOffer.payment)}`:'Sin financiación seleccionable';

  $('#sum-market').textContent=fmtARS(baseARS);$('#sum-market-usd').textContent=fmtUSD(adjustedUSD);$('#sum-transfer').textContent=fmtARS(transferTotal);
  $('#sum-financed').textContent=principal>0&&bestOffer?fmtARS(bestOffer.payment):'Sin saldo';$('#sum-financed-detail').textContent=principal>0&&bestOffer?`${months} cuotas · ${bestOffer.bank}`:'Pago contado';
  $('#sum-total').textContent=fmtARS(principal>0&&bestOffer?financeClose:cashClose);$('#sum-total-detail').textContent=principal>0&&bestOffer?'incluye financiación estimada':'contado + transferencia';

  $('#resultados').hidden=false;$('#resultados').scrollIntoView({behavior:'smooth',block:'start'});
});

loadData().catch(err=>{
  console.error(err);$('#data-status').textContent='No se pudieron cargar las fuentes. Abrí la web desde un servidor local (no file://).';
});
