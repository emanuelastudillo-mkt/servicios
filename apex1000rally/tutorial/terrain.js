import { TRAINING_TERRAIN, trainingTerrainPacket } from './terrain-model.js?v=1.7.1';

export function createTrainingTerrain(root, callbacks) {
  const box=root.querySelector('.viewer-map-box'),toggle=root.querySelector('[data-viewer="depth"]');
  let enabled=true,viewer=null,host=null,controller=null,ticket=0,loading=null,last=null,zoom=1,followKey=null,pose=null;
  try{enabled=localStorage.getItem('apex-tutorial-terrain-v1')!=='flat';}catch{}
  const hint=root.querySelector('.viewer-legend span');
  function presentation(message) {
    box.dataset.terrain3d=String(enabled);
    toggle.textContent=enabled?'Satélite 3D':'Mapa plano';toggle.setAttribute('aria-pressed',String(enabled));
    hint.textContent=message||(enabled?'Salta · paisaje real, circuito de práctica ficticio. Arrastrá para girar; rueda o pinza para acercar.':'Mapa ilustrado · arrastrá para mover y usá la rueda para acercar.');
    if(!enabled){const image=box.querySelector('.map-terrain-image');image.setAttribute('href',image.dataset.src);}
  }
  function dispose() {
    ticket++;controller?.abort();controller=null;
    if(viewer){pose=viewer.pose();viewer.dispose();viewer=null;}
    host?.remove();host=null;followKey=null;
  }
  function fail(error,currentTicket) {
    if(currentTicket!==ticket)return;
    console.warn('Relieve del tutorial no disponible:',error?.message||'WebGL');
    setEnabled(false,'La vista 3D no está disponible. Podés continuar con el mapa plano y volver a intentar con el botón.');
  }
  function apply() {
    if(!viewer||!last)return;
    viewer.update(trainingTerrainPacket(last.field,last.selected));
    const key=last.follow?last.selected:null;
    if(key!==followKey){viewer.command(key?'follow':'unfollow',key);followKey=key;}
  }
  function sync(field,selected,follow,visible) {
    last={field,selected,follow,visible};
    if(!visible){if(host)dispose();return;}
    if(!enabled)return;
    if(viewer){apply();return;}
    if(host)return;
    host=document.createElement('div');host.className='terrain-host';
    host.innerHTML='<div class="terrain-loading" role="status"><strong>Preparando el paisaje 3D</strong><span>Salta · entrenamiento virtual</span></div>';
    box.prepend(host);controller=new AbortController();
    const currentTicket=++ticket,currentHost=host,signal=controller.signal;
    const timeout=setTimeout(()=>fail(Error('La carga tardó demasiado.'),currentTicket),20000);
    loading ||= import('./assets/terrain3d/viewer.js?v=1.7.1');
    loading.then(async mod=>{
      if(currentTicket!==ticket)return;
      const created=await mod.createTerrainViewer(currentHost,TRAINING_TERRAIN,{
        base:new URL('./assets/terrain3d/',import.meta.url).href,signal,pose,followDistance:650,
        vehicleUrl:new URL('./assets/vehicles/trail-r4.glb',import.meta.url).href,
        onFatal:()=>fail(null,currentTicket),
        onCameraChange:camera=>{zoom=camera.zoom;callbacks.onZoom();},
        onFreeCamera:()=>{followKey=null;callbacks.onFreeCamera();},
      });
      if(currentTicket!==ticket){created.dispose();return;}
      viewer=created;apply();
    }).catch(error=>{loading=null;fail(error,currentTicket);}).finally(()=>clearTimeout(timeout));
  }
  function setEnabled(value,message) {
    enabled=value;try{localStorage.setItem('apex-tutorial-terrain-v1',value?'3d':'flat');}catch{}
    if(!value)dispose();presentation(message);
    callbacks.onZoom();if(last)sync(last.field,last.selected,last.follow,last.visible);
  }
  root.addEventListener('click',e=>{
    const target=e.target.closest('.terrain-host [data-action]');
    if(target?.dataset.action==='follow')callbacks.onSelect(target.dataset.id);
    if(target?.dataset.action==='map-stage'){callbacks.onFreeCamera();viewer?.command('stage',target.dataset.index);}
  });
  window.addEventListener('pagehide',dispose);
  presentation();
  return {sync,setEnabled,get enabled(){return enabled;},get zoom(){return zoom;},
    command(action,value){viewer?.command(action,value);},
  };
}
