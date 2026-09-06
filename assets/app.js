'use strict';

const CONFIG = Object.freeze({version:'v20-estrategia-digital',dataUrl:'./data.json',whatsappPhone:'5491167679509',email:'emanuel.astudillo@gmail.com'});
const STORAGE_KEY = 'emanuel-plan-v20';
const state = {services:[],codes:[],cart:{},discount:null,custom:false,customDescription:'',loadedAt:null,loadError:false};
const els = {};
let toastTimer;

// Editorial copy only. IDs, prices, requirements, promotions and Meta budgets come from data.json.
// Match the original wording before applying a rewrite so future catalog changes take precedence.
const PRESENTATION = {
  'crear-cuenta-publicitaria-y-portfolio-metodo-de-pago-y-verificacion-de-negocio-digital': {
    sourceTitle:'Crear cuenta publicitaria y portfolio + metodo de pago y verificacion de negocio digital.',
    sourceDescription:'Configurar cuenta de meta para publicidad (Plazo de 30 días, al menos 2 llamadas para sincronizar informacion importante)',
    title:'Tu cuenta de Meta, lista para anunciar',
    description:'Configuración de la cuenta publicitaria, portfolio y método de pago, con acompañamiento en la verificación del negocio. Un plazo de 30 días y al menos dos llamadas para coordinar la información.',icon:'setup'
  },
  'campana-de-alcance':{sourceTitle:'Campaña de Alcance',sourceDescription:'Configurar y segmentar contenidos organicos para ampliar el publico.',title:'Llegá a más personas',description:'Configuración y segmentación de una campaña para darle más alcance a tus contenidos orgánicos y presentar tu marca a nuevas audiencias.',icon:'reach'},
  'campana-de-consultas':{sourceTitle:'Campaña de Consultas',sourceDescription:'Configurar y segmentar contenidos para un grupo o producto, orientado a ventas',title:'Convertí el interés en consultas',description:'Configuración y segmentación de contenidos de un producto o grupo de productos, con una campaña orientada a consultas y oportunidades de venta.',icon:'chat'},
  'auditoria-puntos-de-mejora-o-indispensables':{sourceTitle:'Auditoria Puntos de mejora o indispensables',sourceDescription:'Revisar redes, mensaje, campañas activas y resultados',title:'Descubrí qué podés mejorar',description:'Revisión de tus redes, tu mensaje, las campañas activas y sus resultados para detectar puntos de mejora y necesidades indispensables.',icon:'audit'},
  'actividad-diaria-con-contenidos-anteriores':{sourceTitle:'Actividad diaria con contenidos anteriores',sourceDescription:'Compartir historias y reels anteriores',title:'Dale nueva vida a tu contenido',description:'Volvemos a compartir historias y reels que ya tenés para mantener la actividad de tu cuenta y aprovechar el contenido existente.',icon:'content'},
  'pack-de-10-contenidos-edicion-minima-para-emergencia':{sourceTitle:'Pack de 10 contenidos (edición minima para emergencia)',sourceDescription:'Subir reels con contenido de valor (grabado por el cliente), respuestas a preguntas frecuentes, datos importantes de tu sector, informacion importante para tus clientes potenciales. Edicion simple, musica de fondo, logo, solo para adaptar a la identidad de marca, subtitulos si es necesario y copy para redes.',title:'10 contenidos para seguir en movimiento',description:'Edición simple de material grabado por vos: preguntas frecuentes, información útil o temas de tu sector. Incluye música, logo, subtítulos si hacen falta y textos para redes.',icon:'video'},
  'dashboard-con-informacion-clave-de-campanas':{sourceTitle:'Dashboard con información clave de campañas',sourceDescription:'Panel de informacion general de las campañas sin necesidad de ingresar en la plataforma de meta',title:'Tus campañas, más fáciles de entender',description:'Un panel con la información clave de tus campañas para consultar su estado general sin tener que ingresar a la plataforma de Meta.',icon:'chart'}
};
const ICON_PATHS = {setup:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-14 5h5m-5 3h9"/>',reach:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 8-8"/>',chat:'<path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8m-8 4h5"/>',audit:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6m-14-11 2 2 4-4"/>',content:'<path d="M19 7a8 8 0 1 0 1 9M19 3v5h-5m-4 0 5 4-5 4Z"/>',video:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="m10 8 6 4-6 4Zm-7-1h3m12 0h3M3 9h3m12 0h3"/>',chart:'<path d="M3 3v18h18M7 17v-4m5 4V9m5 8V5"/>'};

document.addEventListener('DOMContentLoaded', () => {
  ['servicesGrid','serviceCount','cartList','cartCount','emptyCart','bonusSection','bonusList','couponInput','couponMsg','discountLine','serviceSubtotal','discountAmount','serviceTotal','metaInvestment','minReference','totalsBox','customBrief','customDescription','customTotalNote','customOnlyNote','whatsappCart','copyBtn','printBtnCart','customCardButton','mobilePlan','mobilePlanLabel','mobilePlanTotal','toast','copyDialog','summaryText'].forEach(id => els[id] = document.getElementById(id));
  restorePlan();
  els.customDescription.value = state.customDescription;
  document.getElementById('currentYear').textContent = new Date().getFullYear();
  document.querySelectorAll('[data-contact]').forEach(link => link.href = whatsappURL('Hola Emanuel, me gustaría conversar sobre mi negocio y ver cómo podemos trabajar juntos.'));
  wireEvents();
  initializeMotion();
  loadData();
});

function wireEvents(){
  document.querySelectorAll('[data-custom]').forEach(button => button.addEventListener('click', () => selectCustom(button.dataset.interest)));
  document.getElementById('removeCustom').addEventListener('click', () => { state.custom=false; renderAll(); els.customCardButton.focus({preventScroll:true}); notify('Se quitó el plan personalizado.'); });
  els.customDescription.addEventListener('input', () => { state.customDescription=els.customDescription.value; savePlan(); updateWhatsapp(); });
  els.servicesGrid.addEventListener('click', event => {
    const retry = event.target.closest('[data-retry]'); if (retry) { loadData(); return; }
    const button = event.target.closest('[data-add]'); if (button) addToCart(button.dataset.add);
  });
  els.cartList.addEventListener('click', event => {
    const button=event.target.closest('button[data-id]'); if (!button) return;
    if (button.dataset.action==='remove') removeFromCart(button.dataset.id);
    else changeQty(button.dataset.id, Number(button.dataset.delta));
  });
  document.getElementById('applyCouponBtn').addEventListener('click',applyCoupon);
  els.couponInput.addEventListener('keydown',event=>{if(event.key==='Enter')applyCoupon();});
  els.copyBtn.addEventListener('click',copySummary);
  els.printBtnCart.addEventListener('click',printBudget);
  document.getElementById('closeCopyDialog').addEventListener('click',()=>els.copyDialog.close());
  document.getElementById('selectSummary').addEventListener('click',()=>{els.summaryText.focus();els.summaryText.select();});
  const menuToggle=document.getElementById('menuToggle'), menu=document.getElementById('mobileNav');
  function closeMenu(){ menu.hidden=true;menuToggle.setAttribute('aria-expanded','false');menuToggle.setAttribute('aria-label','Abrir menú'); }
  menuToggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;menuToggle.setAttribute('aria-expanded',String(!menu.hidden));menuToggle.setAttribute('aria-label',menu.hidden?'Abrir menú':'Cerrar menú');});
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){closeMenu();menuToggle.focus();}});
}

async function loadData(){
  els.servicesGrid.setAttribute('aria-busy','true');
  els.servicesGrid.innerHTML='<div class="loading-card"><span class="loading-dot"></span> Preparando tus opciones…</div>';
  try{
    const response=await fetch(CONFIG.dataUrl+'?v='+encodeURIComponent(CONFIG.version),{cache:'no-store'});
    if(!response.ok)throw new Error('No se pudo cargar el catálogo.');
    const data=await response.json();normalizeDataset(data);
    state.loadedAt=data.updatedAt||null;state.loadError=false;
    Object.keys(state.cart).forEach(id=>{if(!getService(id)||!Number.isSafeInteger(state.cart[id])||state.cart[id]<1)delete state.cart[id];});
    state.discount=state.codes.find(code=>code.key===state.savedCoupon)||null;
    if(state.discount){els.couponInput.value=state.discount.code;setCouponMsg('Código aplicado: '+state.discount.code,false);}
  }catch(error){state.loadError=true;state.services=[];state.codes=[];state.discount=null;}
  renderAll();els.servicesGrid.setAttribute('aria-busy','false');
}

function getService(id){return state.services.find(service=>service.id===id);}
function presentation(service){
  const copy=PRESENTATION[service.id];
  return {title:copy&&service.title===copy.sourceTitle?copy.title:service.title,description:copy&&service.description===copy.sourceDescription?copy.description:service.description,icon:copy?.icon||'setup'};
}
function getCartItems(){return Object.entries(state.cart).map(([id,qty])=>({service:getService(id),qty})).filter(item=>item.service&&item.qty>0);}
function getQualifyingCount(){return getCartItems().filter(item=>item.service.kind!=='auditoria'&&item.service.kind!=='dashboard').length;}
function getBonusKinds(){const count=getQualifyingCount(),kinds=new Set();if(count>=1)kinds.add('auditoria');if(count>=2)kinds.add('dashboard');return kinds;}
function getBonusItems(){return Array.from(getBonusKinds()).map(kind=>state.services.find(service=>service.kind===kind)).filter(Boolean);}
function getPaidCartItems(){const bonusKinds=getBonusKinds();Object.keys(state.cart).forEach(id=>{const service=getService(id);if(service&&bonusKinds.has(service.kind))delete state.cart[id];});return getCartItems();}
function getTotals(){
  const items=getPaidCartItems();
  const subtotal=items.reduce((sum,item)=>sum+item.service.costo*item.qty,0);
  const metaInvestment=items.reduce((sum,item)=>sum+item.service.presupuestoMinimo*item.qty,0);
  const discountAmount=state.discount?Math.min(subtotal,computeDiscountAmount(state.discount,subtotal)):0;
  const serviceTotal=Math.max(0,subtotal-discountAmount);
  return {items,subtotal,discountAmount,serviceTotal,metaInvestment,minReference:serviceTotal+metaInvestment,bonuses:getBonusItems()};
}
function addToCart(id){const service=getService(id);if(!service||getBonusKinds().has(service.kind))return;state.cart[id]=(state.cart[id]||0)+1;renderAll();notify('Se agregó a tu plan: '+presentation(service).title+'.');}
function removeFromCart(id){delete state.cart[id];renderAll();notify('Se quitó la tarea de tu plan.');}
function changeQty(id,delta){if(!getService(id))return;const next=(state.cart[id]||0)+delta;if(next<=0)delete state.cart[id];else if(Number.isSafeInteger(next))state.cart[id]=next;renderAll();}
function selectCustom(interest){
  state.custom=true;
  if(interest&&!state.customDescription.includes(interest))state.customDescription=(state.customDescription?state.customDescription+'\n':'')+'Me interesa: '+interest+'.';
  state.customDescription=state.customDescription.slice(0,1500);els.customDescription.value=state.customDescription;
  renderAll();document.getElementById('customBrief').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});els.customDescription.focus({preventScroll:true});
}

function renderAll(){
  const focus=document.activeElement;
  const focusKey=focus?.dataset.add?{add:focus.dataset.add}:focus?.dataset.id?{id:focus.dataset.id,action:focus.dataset.action,delta:focus.dataset.delta}:null;
  const totals=getTotals();renderServices();renderCart(totals);renderTotals(totals);savePlan();updateWhatsapp();
  if(focusKey){
    const replacement=focusKey.add?Array.from(els.servicesGrid.querySelectorAll('[data-add]')).find(button=>button.dataset.add===focusKey.add):Array.from(els.cartList.querySelectorAll('button[data-id]')).find(button=>button.dataset.id===focusKey.id&&button.dataset.action===focusKey.action&&button.dataset.delta===focusKey.delta);
    if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});
    else document.getElementById('presupuesto').focus({preventScroll:true});
  }
}
function renderServices(){
  const opened=new Set(Array.from(els.servicesGrid.querySelectorAll('details[open]')).map(details=>details.dataset.service));
  els.serviceCount.textContent=state.loadError?'Catálogo no disponible':state.services.length+' servicios';
  if(!state.services.length){els.servicesGrid.innerHTML=state.loadError?'<div class="loading-card"><strong>No pudimos cargar los servicios.</strong>Podés volver a intentarlo o armar una consulta personalizada.<br><button class="button button-dark" data-retry>Volver a cargar</button></div>':'<div class="loading-card"><strong>Estamos preparando nuevas opciones.</strong>Mientras tanto, podés contarme tu idea en el plan personalizado.</div>';return;}
  const bonusKinds=getBonusKinds();
  els.servicesGrid.innerHTML=state.services.map(service=>{
    const view=presentation(service),bonus=bonusKinds.has(service.kind),qty=state.cart[service.id]||0;
    const details=service.details.flatMap(detail=>detail.split(/\s*\/\/\s*/)).map(detail=>detail.replace(/^Requisitos:\s*/i,'')).filter(Boolean);
    const descriptionChanged=view.description!==service.description;
    const requirements=`<details class="service-details" data-service="${escapeHtml(service.id)}" ${opened.has(service.id)?'open':''}><summary>Ver alcance y requisitos</summary><p class="source-description"><b>Tarea del catálogo:</b> ${escapeHtml(service.title)}</p>${descriptionChanged?'<p class="source-description">'+escapeHtml(service.description)+'</p>':''}${details.length?'<ul>'+details.map(detail=>'<li>'+escapeHtml(detail)+'</li>').join('')+'</ul>':''}</details>`;
    const budget=service.presupuestoMinimo?'Meta: mínimo <b>'+formatMoney(service.presupuestoMinimo)+'</b>'+(service.presupuestoMaximo?' · máximo '+formatMoney(service.presupuestoMaximo):''):'Sin inversión mínima en Meta para esta tarea.';
    return `<article class="service-card ${bonus?'is-bonus':qty?'is-selected':''}" data-service-id="${escapeHtml(service.id)}"><div class="service-top"><span class="service-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${ICON_PATHS[view.icon]}</svg></span><span class="service-category">${escapeHtml(service.category||'Estrategia digital')}</span></div><h3>${escapeHtml(view.title)}</h3><p class="service-description">${escapeHtml(view.description)}</p>${requirements}<div class="service-price">${bonus?'<s>'+formatMoney(service.costo)+'</s><strong>$0</strong><span class="bonus-label">Bonificado</span>':'<strong>'+formatMoney(service.costo)+'</strong><small>honorarios</small>'}</div><p class="service-meta">${bonus?'Incluido sin costo en tu selección actual.':budget}</p><button class="add-service" data-add="${escapeHtml(service.id)}" ${bonus?'disabled':''} aria-label="${escapeHtml((bonus?'Bonificado: ':qty?'Agregar otra unidad de ': 'Agregar a mi plan: ')+view.title)}">${bonus?'Incluido en tu plan':qty?'Agregar otra unidad · '+qty+' en tu plan':'Agregar a mi plan'}<span aria-hidden="true">${bonus?'✓':qty?'+':'↗'}</span></button></article>`;
  }).join('');
}
function renderCart(totals){
  const count=totals.items.reduce((sum,item)=>sum+item.qty,0)+(state.custom?1:0);
  els.cartCount.textContent=String(count);els.emptyCart.hidden=Boolean(count);
  els.cartList.innerHTML=totals.items.map(({service,qty})=>{
    const title=escapeHtml(presentation(service).title),id=escapeHtml(service.id);
    return `<div class="cart-item"><div class="cart-item-head"><b>${title}</b><strong>${formatMoney(service.costo*qty)}</strong></div><div class="cart-item-controls"><div class="qty-control"><button data-id="${id}" data-action="qty" data-delta="-1" aria-label="Restar una unidad de ${title}">−</button><span aria-label="Cantidad: ${qty}">${qty}</span><button data-id="${id}" data-action="qty" data-delta="1" aria-label="Sumar una unidad de ${title}">+</button></div><button class="remove-task" data-id="${id}" data-action="remove" aria-label="Quitar ${title}">Quitar</button></div></div>`;
  }).join('');
  els.bonusSection.hidden=!totals.bonuses.length;
  els.bonusList.innerHTML=totals.bonuses.map(service=>`<div class="bonus-item"><span aria-hidden="true">✓</span><div><b>${escapeHtml(presentation(service).title)}</b><small><s>${formatMoney(service.costo)}</s> · Incluido</small></div><strong>Sin costo</strong></div>`).join('');
  els.customBrief.hidden=!state.custom;
  els.customCardButton.innerHTML=state.custom?'Personalizado agregado <span aria-hidden="true">✓</span>':'Armemos algo a medida <span aria-hidden="true">↗</span>';
  els.customCardButton.setAttribute('aria-pressed',String(state.custom));
  els.copyBtn.disabled=!count;els.printBtnCart.disabled=!count;
  els.mobilePlan.hidden=!count;document.body.classList.toggle('has-plan',Boolean(count));
  els.mobilePlanLabel.textContent='Tu plan · '+count+(count===1?' selección':' selecciones');
  els.mobilePlanTotal.textContent=state.custom&&!totals.items.length?'A cotizar':formatMoney(totals.minReference)+(state.custom?' + a cotizar':'');
}
function renderTotals(totals){
  ['serviceSubtotal','serviceTotal','metaInvestment','minReference'].forEach(id=>els[id].textContent=formatMoney(id==='serviceSubtotal'?totals.subtotal:totals[id]));
  els.discountLine.hidden=!totals.discountAmount;els.discountAmount.textContent='−'+formatMoney(totals.discountAmount);
  els.totalsBox.hidden=state.custom&&!totals.items.length;
  els.customTotalNote.hidden=!state.custom||!totals.items.length;els.customOnlyNote.hidden=!state.custom||Boolean(totals.items.length);
}
function applyCoupon(){
  const input=cleanText(els.couponInput.value);
  if(!input){state.discount=null;state.savedCoupon=null;setCouponMsg('',false);renderAll();return;}
  const found=state.codes.find(code=>code.key===codeKey(input));
  if(!found){state.discount=null;state.savedCoupon=null;setCouponMsg('El código no es válido.',true);renderAll();return;}
  state.discount=found;state.savedCoupon=found.key;setCouponMsg('Código aplicado: '+found.code+'. Solo sobre honorarios.',false);renderAll();
}
function setCouponMsg(message,isError){els.couponMsg.textContent=message;els.couponMsg.className=isError?'error':'ok';}
function whatsappURL(message){return 'https://wa.me/'+CONFIG.whatsappPhone+'?text='+encodeURIComponent(message);}
function updateWhatsapp(){const hasPlan=getCartItems().length||state.custom;els.whatsappCart.href=whatsappURL(hasPlan?'Hola Emanuel, quiero conversar sobre este plan.\n\n'+buildSummary():'Hola Emanuel, necesito ayuda para encontrar un plan para mi negocio.');}
function buildSummary(){
  const totals=getTotals(),lines=['MI PLAN · EMANUEL ASTUDILLO',''];
  totals.items.forEach(({service,qty})=>lines.push('• '+service.title+' ×'+qty+': '+formatMoney(service.costo*qty)));
  totals.bonuses.forEach(service=>lines.push('• '+service.title+': bonificado ('+formatMoney(service.costo)+' → $0)'));
  if(state.custom){lines.push('','PLAN PERSONALIZADO · A COTIZAR');if(state.customDescription.trim())lines.push(state.customDescription.trim());lines.push('Sin precio asignado. Alcance y presupuesto a definir.');}
  if(totals.items.length){
    lines.push('','Subtotal de tareas: '+formatMoney(totals.subtotal));
    if(totals.discountAmount)lines.push('Descuento ('+state.discount.code+'): −'+formatMoney(totals.discountAmount));
    lines.push('Honorarios: '+formatMoney(totals.serviceTotal),'Inversión mínima en Meta, sin impuestos: '+formatMoney(totals.metaInvestment),'INVERSIÓN DE REFERENCIA: '+formatMoney(totals.minReference));
    if(state.custom)lines.push('El plan personalizado se cotiza por separado y no está incluido en este total.');
  }
  lines.push('','Valores de referencia en ARS. Coordinamos alcance, periodicidad, plazos y requisitos antes de comenzar.');
  return lines.join('\n');
}
async function copySummary(){
  const summary=buildSummary();
  try{await navigator.clipboard.writeText(summary);notify('Resumen copiado. Ya podés compartir tu plan.');}
  catch{els.summaryText.value=summary;els.copyDialog.showModal();els.summaryText.focus();els.summaryText.select();}
}
function buildPrintHtml(){
  const totals=getTotals(),today=escapeHtml(formatDateTime(new Date()));
  const rows=totals.items.map(({service,qty})=>`<tr><td>${escapeHtml(service.title)}</td><td>${qty}</td><td class="num">${formatMoney(service.costo)}</td><td class="num">${formatMoney(service.costo*qty)}</td></tr>`).join('');
  const bonusRows=totals.bonuses.map(service=>`<tr><td>${escapeHtml(service.title)}<small>Bonificado · Valor original ${formatMoney(service.costo)}</small></td><td>1</td><td class="num">$0</td><td class="num">$0</td></tr>`).join('');
  const custom=state.custom?`<section class="custom"><h2>Plan personalizado <span>A cotizar</span></h2><p>${escapeHtml(state.customDescription.trim()||'Definimos juntos qué necesita tu negocio.').replace(/\n/g,'<br>')}</p><small>Sin precio asignado. El presupuesto se define después de conversar.${totals.items.length?' Su valor no está incluido en los totales.':''}</small></section>`:'';
  const breakdown=totals.items.length?`<table><thead><tr><th>Tarea</th><th>Cant.</th><th class="num">Unitario</th><th class="num">Subtotal</th></tr></thead><tbody>${rows}${bonusRows}</tbody></table><section class="totals"><div><span>Subtotal de tareas</span><b>${formatMoney(totals.subtotal)}</b></div>${totals.discountAmount?'<div><span>Descuento ('+escapeHtml(state.discount.code)+')</span><b>−'+formatMoney(totals.discountAmount)+'</b></div>':''}<div><span>Honorarios</span><b>${formatMoney(totals.serviceTotal)}</b></div><div><span>Inversión mínima en Meta<small>Se paga a Meta. No incluye impuestos.</small></span><b>${formatMoney(totals.metaInvestment)}</b></div><div class="grand"><span>Inversión de referencia</span><b>${formatMoney(totals.minReference)}</b></div></section>`:'';
  return `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mi plan — Emanuel Astudillo</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#252720;max-width:900px;margin:30px auto;padding:0 20px;font-size:12px;line-height:1.6}.head{border-bottom:3px solid #eb663a;padding-bottom:22px;display:flex;justify-content:space-between;gap:20px}h1{font-size:34px;letter-spacing:-1.5px;margin:5px 0}h2{font-size:17px;margin:0 0 12px}p{margin:8px 0}small{font-size:10px;color:#606652;display:block}table{width:100%;border-collapse:collapse;margin-top:26px}th{text-align:left;background:#eef0e7;font-size:10px}td,th{padding:12px 9px;border-bottom:1px solid #dcded3}tr{break-inside:avoid}td:first-child{width:58%}.num{text-align:right;white-space:nowrap}.custom{background:#f1e8dc;border:1px solid #ded0bb;padding:20px;margin-top:26px;break-inside:avoid}.custom h2 span{float:right;font-size:13px}.custom p{overflow-wrap:anywhere}.totals{max-width:430px;margin:28px 0 28px auto;break-inside:avoid}.totals div{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #dcded3;padding:10px 0}.totals b{white-space:nowrap}.grand{font-size:17px}.foot{border-top:1px solid #dcded3;padding-top:18px;margin-top:30px;color:#606652;font-size:11px}button{background:#252720;color:white;padding:12px 18px;border:0;border-radius:5px;cursor:pointer;margin-bottom:20px}@media print{body{margin:0;padding:0}button{display:none}.custom,th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body><button id="printNow" type="button">Imprimir / Guardar como PDF</button><div class="head"><div><small>ESTRATEGIA + DISEÑO + MARKETING</small><h1>Tu plan a medida.</h1><span>Emanuel Astudillo</span></div><div><small>Generado el ${today}</small><small>WhatsApp +${CONFIG.whatsappPhone}</small><small>${escapeHtml(CONFIG.email)}</small></div></div>${breakdown}${custom}<div class="foot">Valores de referencia en pesos argentinos. El alcance, la periodicidad, los plazos y los requisitos se coordinan antes de confirmar el trabajo. Los descuentos se aplican a los honorarios; la inversión en Meta no incluye impuestos.</div></body></html>`;
}
function printBudget(){
  const printWindow=window.open('','_blank');
  if(!printWindow){notify('Habilitá las ventanas emergentes para guardar tu presupuesto como PDF.');return;}
  printWindow.opener=null;
  printWindow.document.open();printWindow.document.write(buildPrintHtml());printWindow.document.close();
  printWindow.document.getElementById('printNow').addEventListener('click',()=>printWindow.print());
  printWindow.setTimeout(()=>{if(!printWindow.closed){printWindow.focus();printWindow.print();}},300);
}
function savePlan(){
  // Preserve the last known selection if the network is temporarily unavailable.
  if(state.loadError)return;
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({cart:state.cart,coupon:state.discount?.key||null,custom:state.custom,description:state.customDescription}));}catch{/* Plan continues to work when browser storage is unavailable. */}
}
function restorePlan(){
  try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!saved||typeof saved!=='object')return;
    if(saved.cart&&typeof saved.cart==='object'&&!Array.isArray(saved.cart))state.cart=Object.fromEntries(Object.entries(saved.cart).filter(([id,qty])=>typeof id==='string'&&Number.isSafeInteger(qty)&&qty>0));
    state.custom=saved.custom===true;state.customDescription=typeof saved.description==='string'?saved.description.slice(0,1500):'';state.savedCoupon=typeof saved.coupon==='string'?saved.coupon:null;
  }catch{/* Ignore inaccessible or invalid saved plans. */}
}
function notify(message){clearTimeout(toastTimer);els.toast.textContent=message;els.toast.classList.add('is-visible');toastTimer=setTimeout(()=>els.toast.classList.remove('is-visible'),3600);}
function initializeMotion(){
  if(!('IntersectionObserver' in window)||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
  document.documentElement.classList.add('motion-ready');document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));
}
