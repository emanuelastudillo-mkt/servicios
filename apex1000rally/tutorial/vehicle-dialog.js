import {TEAMS} from './viewer-model.js?v=1.7.1';

export function createVehicleDialog(root) {
  const dialog=document.createElement('dialog');dialog.className='vehicle-dialog';
  dialog.setAttribute('aria-labelledby','vehicle-title');
  dialog.innerHTML='<div class="vehicle-dialog-head"><div><span class="eyebrow">4×4 DE RALLY</span><h2 id="vehicle-title">Apex Trail R4</h2></div><button type="button" class="vehicle-close" aria-label="Cerrar vista del vehículo">Cerrar ✕</button></div><div class="vehicle-stage" role="region" aria-label="Vista del vehículo"></div><div class="vehicle-dialog-bottom"><label>Color de la escudería<select class="vehicle-color">'+TEAMS.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')+'</select></label><p>Arrastrá para girar · rueda o pinza para acercar<br><small>Un mismo modelo, los colores de cada equipo.</small></p></div>';
  root.append(dialog);
  const stage=dialog.querySelector('.vehicle-stage'),select=dialog.querySelector('.vehicle-color');
  let viewer=null,controller=null,ticket=0,returnFocus=null;
  function close(){ticket++;controller?.abort();controller=null;viewer?.dispose();viewer=null;stage.replaceChildren();delete stage.dataset.ready;returnFocus?.focus();}
  dialog.querySelector('.vehicle-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',close);
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.x||e.clientX>b.right||e.clientY<b.y||e.clientY>b.bottom)dialog.close();}});
  select.onchange=()=>viewer?.setColor(TEAMS.find(t=>t.id===select.value).color);
  window.addEventListener('pagehide',()=>{if(dialog.open)dialog.close();});
  return {async open(teamId){
    if(dialog.open)return;
    returnFocus=document.activeElement;select.value=TEAMS.some(t=>t.id===teamId)?teamId:'player';
    dialog.showModal();stage.innerHTML='<p class="vehicle-loading" role="status">Preparando el 4×4…</p>';
    controller=new AbortController();const signal=controller.signal,id=++ticket;
    try{
      const mod=await import('./assets/terrain3d/viewer.js?v=1.7.1');if(id!==ticket)return;
      const created=await mod.createVehiclePreview(stage,{url:new URL('./assets/vehicles/trail-r4.glb',import.meta.url).href,color:TEAMS.find(t=>t.id===select.value).color,signal});
      if(id!==ticket){created.dispose();return;}viewer=created;
    }catch(error){if(id===ticket){stage.replaceChildren();const p=document.createElement('p');p.className='vehicle-loading';p.textContent='No se pudo abrir el vehículo 3D. Podés seguir usando el tutorial.';stage.append(p);}}
  }};
}
