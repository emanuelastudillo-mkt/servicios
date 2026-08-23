const $=s=>document.querySelector(s);
const nowYear=new Date().getFullYear();
let marketData,dnrpaData,ratesData,config;
let marketByBrand=new Map(),dnrpaByBrandYear=new Map();
const fmtARS=n=>Number.isFinite(n)?new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n):'—';
const fmtUSD=n=>Number.isFinite(n)?new Intl.NumberFormat('es-AR',{style:'currency',currency:'USD',currencyDisplay:'narrowSymbol',maximumFractionDigits:0}).format(n).replace('$','US$ '):'—';
const fmtPct=n=>Number.isFinite(n)?`${n.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—';
function norm(s=''){return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();}
function tokens(s=''){return norm(s).split(/\s+/).filter(x=>x.length>1&&!['DE','DEL','LA','EL','CON','CV','AT','MT'].includes(x));}
function uniqueSorted(a){return [...new Set(a)].sort((x,y)=>x.localeCompare(y,'es',{numeric:true}));}
function escapeHtml(s=''){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function setOptions(el,items,placeholder){el.innerHTML=`<option value="">${placeholder}</option>`+items.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');el.disabled=!items.length;}

async function loadData(){
  const [m,d,r,c]=await Promise.all([
    fetch('data/vehicle_market.json').then(x=>x.json()),fetch('data/dnrpa.json').then(x=>x.json()),fetch('data/rates.json').then(x=>x.json()),fetch('data/config.json').then(x=>x.json())
  ]);
  marketData=m;dnrpaData=d;ratesData=r;config=c;
  for(const row of marketData.rows){if(!row.brand)continue;if(!marketByBrand.has(row.brand))marketByBrand.set(row.brand,[]);marketByBrand.get(row.brand).push(row);}
  for(const row of dnrpaData.rows){for(const year of Object.keys(row.values_ars||{})){const key=`${row.brand}|${year}`;if(!dnrpaByBrandYear.has(key))dnrpaByBrandYear.set(key,[]);dnrpaByBrandYear.get(key).push(row);}}
  setOptions($('#brand'),uniqueSorted([...marketByBrand.keys()]),'Elegí una marca');
  $('#fx-rate').value=config.exchange_rate_ars_per_usd||'';
  $('#data-status').textContent=`${marketData.rows.length.toLocaleString('es-AR')} versiones de mercado · ${dnrpaData.rows.length.toLocaleString('es-AR')} registros DNRPA · ${ratesData.products.length} tasas`;
  const marketDate=[marketData.report_month,marketData.report_year].filter(Boolean).join(' ')||'PDF mensual';
  $('#source-market-date').textContent=marketDate;$('#hero-market-date').textContent=marketDate;
  $('#source-dnrpa-date').textContent=dnrpaData.valid_from||'Tabla vigente';$('#hero-dnrpa-date').textContent=dnrpaData.valid_from||'DNRPA';
  $('#source-rates-date').textContent=ratesData.updated_at?new Date(ratesData.updated_at+'T12:00:00').toLocaleDateString('es-AR'):'Actualizable';
  $('#hero-rates-count').textContent=`${ratesData.products.length} alternativas`;
}

$('#brand').addEventListener('change',()=>{const rows=marketByBrand.get($('#brand').value)||[];setOptions($('#model'),uniqueSorted(rows.map(r=>r.model).filter(Boolean)),'Elegí un modelo');setOptions($('#variant'),[],'Primero elegí modelo');setOptions($('#year'),[],'Elegí versión');});
$('#model').addEventListener('change',()=>{const rows=(marketByBrand.get($('#brand').value)||[]).filter(r=>r.model===$('#model').value);setOptions($('#variant'),uniqueSorted(rows.map(r=>r.variant)),'Elegí una versión');setOptions($('#year'),[],'Elegí versión');});
$('#variant').addEventListener('change',()=>{const row=currentMarketRow();if(!row){setOptions($('#year'),[],'Elegí versión');return;}const yrs=Object.keys(row.prices||{}).sort((a,b)=>a==='0km'?-1:b==='0km'?1:Number(b)-Number(a));const el=$('#year');el.innerHTML='<option value="">Elegí año</option>'+yrs.map(y=>`<option value="${y}">${y==='0km'?'0 km / actual':y}</option>`).join('');el.disabled=false;});
function currentMarketRow(){return (marketByBrand.get($('#brand').value)||[]).find(r=>r.model===$('#model').value&&r.variant===$('#variant').value);}

function mileageFactor(year,km){if(!km||year==='0km')return 1;const y=Number(year);if(!y)return 1;const age=Math.max(1,nowYear-y),expected=age*config.market.expected_km_per_year,diff=km-expected;if(diff>0)return 1-Math.min(config.market.max_km_penalty,(diff/10000)*config.market.km_penalty_per_10000_over);return 1+Math.min(config.market.max_km_bonus,(Math.abs(diff)/10000)*config.market.km_bonus_per_10000_under);}
function marketPriceToARS(price,fx){return price.currency==='USD'?price.amount*fx:price.amount;}
function marketPriceToUSD(price,fx){return price.currency==='USD'?price.amount:price.amount/fx;}
function literalMarketValue(price){return price.currency==='USD'?fmtUSD(price.amount):fmtARS(price.amount);}
function sourceUnitText(price){if(price.currency==='USD'&&price.unit==='thousands')return `Fuente en miles de US$ · ${price.raw.toLocaleString('es-AR')} × 1.000`;if(price.currency==='USD')return 'La guía identifica este valor en US$';return `Fuente en miles de pesos · ${price.raw.toLocaleString('es-AR')} × 1.000`;}

function findDnrpa(marketRow,year){const candidates=dnrpaByBrandYear.get(`${marketRow.brand}|${year}`)||[];if(!candidates.length)return null;const modelT=tokens(marketRow.model),variantT=tokens(marketRow.variant),weighted=[];modelT.forEach(t=>weighted.push([t,3]));variantT.forEach(t=>weighted.push([t,1]));const denom=weighted.reduce((a,[,w])=>a+w,0)||1;let best=null;for(const c of candidates){const ct=new Set(tokens(`${c.model} ${c.body_type}`));let score=weighted.reduce((a,[t,w])=>a+(ct.has(t)?w:0),0)/denom;if(modelT[0]&&ct.has(modelT[0]))score+=.18;const eng=variantT.find(t=>/^\d{2,3}$/.test(t));if(eng&&ct.has(eng))score+=.07;if(!best||score>best.score)best={row:c,score};}return best;}
function monthlyPayment(principal,months,rate){if(principal<=0)return 0;if(rate<=0)return principal/months;const p=Math.pow(1+rate,months);return principal*rate*p/(p-1);}
function financeOffers(principal,months){return ratesData.products.filter(p=>months>=p.min_months&&months<=p.max_months).map(p=>{const cftMonthly=Math.pow(1+p.cft_tea/100,1/12)-1,tnaMonthly=p.tna/100/12,payment=monthlyPayment(principal,months,tnaMonthly),cftReferencePayment=monthlyPayment(principal,months,cftMonthly);return {...p,payment,cftReferencePayment,total:payment*months,cftReferenceTotal:cftReferencePayment*months};}).sort((a,b)=>a.cft_tea-b.cft_tea||a.payment-b.payment);}
function renderBanks(offers,months){const list=$('#bank-list');if(!offers.length){list.innerHTML='<div class="bank-row"><div class="bank-name"><b>Sin alternativas para este plazo</b><span>Actualizá la base de tasas o elegí otro plazo.</span></div></div>';return;}list.innerHTML=offers.slice(0,6).map((o,i)=>`<div class="bank-row"><div class="bank-name"><b>${escapeHtml(o.bank)}${i===0?'<span class="best-tag">MENOR CFT</span>':''}</b><span>${escapeHtml(o.product)}${o.requires_client?' · requiere cliente':''}</span></div><div class="bank-cell"><b>${fmtPct(o.tna)}</b></div><div class="bank-cell"><b>${fmtPct(o.cft_tea)}</b></div><div class="bank-cell bank-total"><b>${fmtARS(o.total)}</b></div><div class="bank-cell bank-payment"><b>${fmtARS(o.payment)}</b></div></div>`).join('');}

function opportunityState(price,market){if(!price||!market)return null;const pct=(price-market)/market*100,abs=Math.abs(pct),difference=price-market;let rating,klass;if(pct<=-15){rating='Oportunidad fuerte';klass='is-good';}else if(pct<=-7){rating='Buena oportunidad';klass='is-good';}else if(pct<7){rating='En precio de mercado';klass='is-neutral';}else if(pct<15){rating='Precio exigente';klass='is-bad';}else{rating='Muy por encima del mercado';klass='is-bad';}return {pct,abs,difference,rating,klass};}
function renderOpportunity(op,hasEnteredPrice){const panel=$('#opportunity-panel');panel.classList.remove('is-good','is-bad','is-neutral');if(!hasEnteredPrice||!op){$('#opportunity-rating').textContent='Ingresá un precio para comparar';$('#opportunity-pct').textContent='—';$('#opportunity-direction').textContent='vs. mercado';$('#opportunity-text').textContent='La referencia se calcula contra la valuación mensual ajustada por kilometraje.';$('#opportunity-marker').style.left='50%';return;}panel.classList.add(op.klass);$('#opportunity-rating').textContent=op.rating;$('#opportunity-pct').textContent=`${op.abs.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})}%`;$('#opportunity-direction').textContent=op.pct<0?'debajo del mercado':op.pct>0?'arriba del mercado':'en mercado';$('#opportunity-text').textContent=`La diferencia estimada es ${fmtARS(Math.abs(op.difference))} ${op.pct<0?'a favor del comprador':'por encima de la referencia'}.`;const clamped=Math.max(-20,Math.min(20,op.pct));$('#opportunity-marker').style.left=`${((clamped+20)/40)*100}%`;}

$('#vehicle-form').addEventListener('submit',e=>{
  e.preventDefault();const mrow=currentMarketRow(),year=$('#year').value;if(!mrow||!year)return;const priceInfo=mrow.prices[year];if(!priceInfo)return;
  const km=Number($('#km').value)||0,fx=Number($('#fx-rate').value)||config.exchange_rate_ars_per_usd||1,factor=mileageFactor(year,km);
  const guideARS=marketPriceToARS(priceInfo,fx),guideUSD=marketPriceToUSD(priceInfo,fx),adjustedARS=guideARS*factor,adjustedUSD=guideUSD*factor;
  const buyARS=adjustedARS*config.market.purchase_factor,saleARS=adjustedARS*config.market.sale_factor;
  const typedPrice=Number($('#operation-price').value)||0,hasEnteredPrice=typedPrice>0,operationPrice=hasEnteredPrice?typedPrice:adjustedARS;
  const defaultDown=operationPrice*config.financing.default_down_payment_percent,down=Math.min(operationPrice,Number($('#down-payment').value)||defaultDown),months=Number($('#term').value),principal=Math.max(0,operationPrice-down),offers=financeOffers(principal,months),bestOffer=offers[0]||null;
  const opp=opportunityState(hasEnteredPrice?typedPrice:null,adjustedARS);renderOpportunity(opp,hasEnteredPrice);

  const match=year==='0km'?null:findDnrpa(mrow,year),drow=match?.row,dval=drow?Number(drow.values_ars[year]):NaN,registryFee=Number.isFinite(dval)?dval*config.transfer.registry_percent:0,juris=$('#jurisdiction').value,buyer=$('#buyer-type').value,stampRate=juris==='pba'?(buyer==='habitualist'?config.transfer.pba_stamp_habitualist_percent:config.transfer.pba_stamp_particular_percent):0,stampBase=Number.isFinite(dval)?Math.max(dval,operationPrice):operationPrice,stampFee=stampBase*stampRate,fixed=Number(config.transfer.fixed_fees_ars)||0,transferTotal=registryFee+stampFee+fixed,cashClose=operationPrice+transferTotal,financeClose=down+(bestOffer?bestOffer.total:principal)+transferTotal;

  $('#result-unit').textContent=`${mrow.brand} ${mrow.model} · ${mrow.variant} · ${year==='0km'?'0 km':year}${km?` · ${km.toLocaleString('es-AR')} km`:''}`;
  $('#market-value').textContent=fmtARS(adjustedARS);const factorPct=(factor-1)*100;$('#market-adjustment').textContent=factor===1?`Equivale a ${fmtUSD(adjustedUSD)} al dólar configurado`:`${factorPct>0?'+':''}${factorPct.toLocaleString('es-AR',{minimumFractionDigits:1,maximumFractionDigits:1})}% por kilometraje · ${fmtUSD(adjustedUSD)}`;
  $('#market-pdf-value').textContent=literalMarketValue(priceInfo);$('#market-pdf-unit').textContent=sourceUnitText(priceInfo);$('#buy-value').textContent=fmtARS(buyARS);$('#sale-value').textContent=fmtARS(saleARS);$('#market-source').textContent=`${marketData.source} · ${marketData.report_month||''} ${marketData.report_year||''} · pág. ${mrow.page} · ${priceInfo.source_note}`;

  $('#dnrpa-value').textContent=Number.isFinite(dval)?fmtARS(dval):year==='0km'?'No aplica a 0 km':'Sin coincidencia';$('#dnrpa-match').textContent=drow?`${drow.model} · coincidencia ${Math.max(0,Math.min(99,Math.round(match.score*100)))}%`:year==='0km'?'Consultar alta / patentamiento':'No se encontró versión oficial equivalente';$('#registry-fee').textContent=Number.isFinite(dval)?fmtARS(registryFee):'—';$('#stamp-fee').textContent=stampRate?fmtARS(stampFee):'No modelado';$('#fixed-fees').textContent=fmtARS(fixed);$('#transfer-total').textContent=fmtARS(transferTotal);$('#dnrpa-source').textContent=`DNRPA · vigencia ${dnrpaData.valid_from||'sin fecha'}${drow?` · pág. ${drow.page}`:''}`;

  $('#loan-amount').textContent=fmtARS(principal);renderBanks(offers,months);$('#finance-source').textContent=`${ratesData.source} · actualización ${ratesData.updated_at}. ${ratesData.calculation_note}`;$('#cash-close').textContent=fmtARS(cashClose);$('#finance-close').textContent=fmtARS(financeClose);$('#finance-close-bank').textContent=bestOffer?`${bestOffer.bank} · ${months} cuotas de ${fmtARS(bestOffer.payment)}`:'Sin financiación seleccionable';$('#operation-used').textContent=hasEnteredPrice?fmtARS(operationPrice):`${fmtARS(operationPrice)} · valor guía`;

  $('#resultados').hidden=false;$('#resultados').scrollIntoView({behavior:'smooth',block:'start'});
});

loadData().catch(err=>{console.error(err);$('#data-status').textContent='No se pudieron cargar las fuentes. Abrí la web desde un servidor local (no file://).';});
