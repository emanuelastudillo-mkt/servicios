import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { geoToTerrain, decodeHeights, sampleElevation, terrainScale } from "./terrain-model.js";
import { loadRallyVehicle } from './vehicle-asset.js';
export { createVehiclePreview } from './vehicle-preview.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const vec=new THREE.Vector3(), transform=new THREE.Object3D();

export async function createTerrainViewer(host,route,options) {
  const base=options.base;
  const response=await fetch(`${base}${route.id}.json`,{signal:options.signal});
  if(!response.ok)throw Error("No se pudo cargar este relieve.");
  const meta=await response.json();
  const [heightResponse,textureResponse]=await Promise.all([
    fetch(base+meta.heightmap,{signal:options.signal}),fetch(base+meta.texture,{signal:options.signal}),
  ]);
  if(!heightResponse.ok||!textureResponse.ok)throw Error("Faltan datos de este terreno.");
  const heights=decodeHeights(await heightResponse.arrayBuffer(),meta.grid);
  const bitmap=await createImageBitmap(await textureResponse.blob(),{imageOrientation:'flipY'});
  if(!host.isConnected||options.signal?.aborted){bitmap.close();throw Error("Vista cerrada durante la carga.");}
  const texture=new THREE.Texture(bitmap);texture.needsUpdate=true;
  let vehicleParts=[];
  if(options.vehicleUrl){
    try{vehicleParts=await loadRallyVehicle(options.vehicleUrl,options.signal);}
    catch(error){if(options.signal?.aborted){texture.dispose();bitmap.close();throw error;}console.warn('Modelo detallado no disponible; se usa el vehículo básico.',error.message);}
  }
  let disposed=false,raf=0,visible=true,frames=0,follow=null,lastPacket=null,lastSignature="";
  let quality="auto",relief=1,terrain,skirt,roadGroup,segments,baseDistance=1600;
  let savedQuality;try{savedQuality=localStorage.getItem("apex-terrain-quality");}catch{}
  if(["auto","high","low"].includes(savedQuality))quality=savedQuality;
  const resources=new Set(),labels=[],cars=[];
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});}
  catch(error){texture.dispose();bitmap.close();vehicleParts.forEach(p=>{p.geometry.dispose();p.material.dispose();});throw error;}
  renderer.setClearColor(0x000000,0);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
  const scene=new THREE.Scene();scene.fog=new THREE.Fog(0x12202a,2200,4200);
  const camera=new THREE.PerspectiveCamera(42,1,.5,7000);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=!matchMedia("(prefers-reduced-motion: reduce)").matches;
  controls.dampingFactor=.12;controls.minDistance=65;controls.maxDistance=3400;
  controls.minPolarAngle=.05;controls.maxPolarAngle=Math.PI*.46;
  controls.zoomToCursor=true;controls.screenSpacePanning=true;
  controls.mouseButtons={LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
  scene.add(new THREE.HemisphereLight(0xd8eaff,0x39442e,2));
  const sunlight=new THREE.DirectionalLight(0xffe3b0,2.4);sunlight.position.set(-500,1000,-400);scene.add(sunlight);
  const fill=new THREE.DirectionalLight(0x87b4dc,.4);fill.position.set(500,300,600);scene.add(fill);
  host.innerHTML='<div class="terrain-labels"></div><div class="terrain-tools"><button class="terrain-north" title="Orientar al norte" aria-label="Orientar al norte"><span>↑</span>N</button><label>Relieve<input class="terrain-relief" aria-label="Intensidad visual del relieve" type="range" min="0.5" max="1.8" step="0.1" value="1"></label><label>Detalle<select class="terrain-quality" aria-label="Calidad gráfica"><option value="auto">Auto</option><option value="high">Alto</option><option value="low">Bajo</option></select></label></div><div class="terrain-caption"><span class="terrain-view-label">Vista general</span><small>Elevación real · escala vertical ampliada</small></div><details class="terrain-credits"><summary>Datos del mapa</summary><p><a href="https://s2maps.eu" target="_blank" rel="noopener">Sentinel-2 cloudless</a> por <a href="https://maps.eox.at/" target="_blank" rel="noopener">EOX</a> · Copernicus Sentinel 2016–2017, <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>. Recorte y reproyección para el juego.</p><p>Elevación: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen Terrain Tiles</a> · <a href="'+base+'ATTRIBUTION.md" target="_blank" rel="noopener">fuentes y licencias</a>. El recorrido deportivo es ilustrativo.</p></details>';
  host.prepend(renderer.domElement);renderer.domElement.className="terrain-canvas";
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute("aria-label","Mapa satelital 3D. Arrastrar para girar, rueda para acercar. Flechas para girar, cero para vista general.");
  const labelLayer=host.querySelector('.terrain-labels'),viewLabel=host.querySelector('.terrain-view-label');
  const qualitySelect=host.querySelector('.terrain-quality');qualitySelect.value=quality;
  const surface=()=>new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0});
  const terrainMaterial=surface();resources.add(terrainMaterial);resources.add(texture);
  const sideMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1});resources.add(sideMaterial);
  const metersToY=()=>terrainScale(meta,relief);
  const detailSegments=()=>quality==='high'?256:quality==='low'?64:(host.clientWidth<650||navigator.deviceMemory<=4?128:256);
  const heightAt=(x,z)=>sampleElevation(heights,meta.grid,segments,x,z)*metersToY();
  const mapPoint=(lon,lat,lift=1.8)=>{const [x,z]=geoToTerrain(lon,lat,meta.bounds);return new THREE.Vector3(x,heightAt(x,z)+lift,z);};

  function disposeObject(object) {
    if(!object)return;
    object.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==terrainMaterial&&o.material!==sideMaterial)o.material.dispose();});
    scene.remove(object);
  }
  function buildTerrain() {
    disposeObject(terrain);disposeObject(skirt);disposeObject(roadGroup);
    segments=detailSegments();
    const positions=[],uv=[],indices=[];
    for(let j=0;j<=segments;j++)for(let i=0;i<=segments;i++){
      const x=(i/segments-.5)*1000,z=(j/segments-.5)*950;
      positions.push(x,heightAt(x,z),z);uv.push(i/segments,1-j/segments);
      if(i<segments&&j<segments){const a=j*(segments+1)+i,b=a+1,c=a+segments+1,d=c+1;indices.push(a,c,b,b,c,d);}
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
    terrain=new THREE.Mesh(geometry,terrainMaterial);scene.add(terrain);
    const edge=[];
    for(let i=0;i<=segments;i++)edge.push([-500+i/segments*1000,-475]);
    for(let j=1;j<=segments;j++)edge.push([500,-475+j/segments*950]);
    for(let i=segments-1;i>=0;i--)edge.push([-500+i/segments*1000,475]);
    for(let j=segments-1;j>=0;j--)edge.push([-500,-475+j/segments*950]);
    const wall=[],colors=[],wallIndices=[];
    edge.forEach(([x,z],i)=>{wall.push(x,heightAt(x,z),z,x,-22,z);colors.push(.22,.26,.23,.055,.075,.078);const next=(i+1)%edge.length;wallIndices.push(i*2,next*2,i*2+1,next*2,next*2+1,i*2+1);});
    const wallGeo=new THREE.BufferGeometry();wallGeo.setAttribute('position',new THREE.Float32BufferAttribute(wall,3));wallGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));wallGeo.setIndex(wallIndices);wallGeo.computeVertexNormals();
    skirt=new THREE.Mesh(wallGeo,sideMaterial);scene.add(skirt);
    roadGroup=new THREE.Group();scene.add(roadGroup);
    for(const stage of route.stages){
      const pts=[];
      // Densify along the DEM as well as route bends to keep the road above ridges.
      const stride=segments===256?2:segments===128?4:8;
      for(let i=0;i<stage.path.length;i+=stride){const p=mapPoint(...stage.path[i]);pts.push(p.x,p.y,p.z);}
      const end=mapPoint(...stage.path.at(-1));pts.push(end.x,end.y,end.z);
      for(const [color,width,order] of [[0x102222,6,1],[0xffc978,3,2]]) {
        const line=new Line2(new LineGeometry().setPositions(pts),new LineMaterial({color,linewidth:width,depthTest:true,depthWrite:false}));
        line.renderOrder=order;line.userData.stage=stage.index;line.computeLineDistances();roadGroup.add(line);
      }
    }
    for(const label of labels)if(label.city)label.point=mapPoint(label.city.lon,label.city.lat,5);
    if(lastPacket)placeTeams(lastPacket);
    resize();requestFrame();
  }

  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;
  const shadowCtx=shadowCanvas.getContext('2d'),gradient=shadowCtx.createRadialGradient(64,64,28,64,64,64);
  gradient.addColorStop(0,'rgba(0,0,0,.6)');gradient.addColorStop(1,'rgba(0,0,0,0)');shadowCtx.fillStyle=gradient;shadowCtx.fillRect(0,0,128,128);
  const shadowTexture=new THREE.CanvasTexture(shadowCanvas);resources.add(shadowTexture);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(1450,1350),new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false}));
  shadow.rotation.x=-Math.PI/2;shadow.position.y=-24;scene.add(shadow);
  resources.add(shadow.geometry);resources.add(shadow.material);

  // All rally cars share instanced geometry: draw calls stay constant as teams grow.
  const carParts=[];
  function part(geometry,color,offsets,teamColor=false,sourceMaterial=null){
    const material=sourceMaterial||new THREE.MeshStandardMaterial({color,roughness:.72});
    const mesh=new THREE.InstancedMesh(geometry,material,32*offsets.length);mesh.count=0;mesh.frustumCulled=false;
    const p={mesh,offsets,teamColor};carParts.push(p);scene.add(mesh);resources.add(geometry);resources.add(material);return p;
  }
  if(vehicleParts.length){
    vehicleParts.forEach(p=>part(p.geometry,0xffffff,[[0,0,0]],p.teamColor,p.material));
    host.dataset.vehicleModel='trail-r4';
  }else{
  host.dataset.vehicleModel='basic';
  part(new THREE.BoxGeometry(7,2.4,13),0xffffff,[[0,3,0]],true);
  part(new THREE.BoxGeometry(5.5,2.8,6.2),0x1d303a,[[0,5.4,1]]);
  part(new THREE.BoxGeometry(5.6,.45,6.4),0xffffff,[[0,7,1]],true);
  const tireGeo=new THREE.CylinderGeometry(2,2,1.6,10);tireGeo.rotateZ(Math.PI/2);
  part(tireGeo,0x13181b,[[-3.8,2,-4.1],[3.8,2,-4.1],[-3.8,2,4.1],[3.8,2,4.1]]);
  part(new THREE.BoxGeometry(1.5,.7,.35),0xffedc3,[[-2.2,3.4,-6.7],[2.2,3.4,-6.7]]);
  }
  const markerRing=new THREE.Mesh(new THREE.RingGeometry(8.5,10,32),new THREE.MeshBasicMaterial({color:0xffcd75,side:THREE.DoubleSide,transparent:true,opacity:.7,depthWrite:false}));
  markerRing.rotation.x=-Math.PI/2;scene.add(markerRing);resources.add(markerRing.geometry);resources.add(markerRing.material);markerRing.visible=false;

  function makeLabel(text,kind,action,id){
    const el=document.createElement('button');el.type='button';el.className=`terrain-label ${kind}`;el.textContent=text;
    el.dataset.action=action;if(action==='follow')el.dataset.id=id;else el.dataset.index=id;
    labelLayer.append(el);return el;
  }
  for(const [i,city] of route.cities.entries()){
    labels.push({el:makeLabel(city.name,'terrain-city','map-stage',Math.max(0,i-1)),city,point:null,priority:i===0?3:1,width:city.name.length*6.3+18,height:20});
  }

  function placeTeams(packet){
    const ids=new Set(packet.teams.map(t=>t.id));
    for(let i=cars.length-1;i>=0;i--)if(!ids.has(cars[i].team.id)){cars[i].label.el.remove();labels.splice(labels.indexOf(cars[i].label),1);cars.splice(i,1);}
    for(const team of packet.teams.slice(0,32)){
      let car=cars.find(c=>c.team.id===team.id);
      if(!car){const label={el:makeLabel('','terrain-team','follow',team.id),priority:4,width:40,height:24};labels.push(label);car={label};cars.push(car);}
      car.team=team;car.point=mapPoint(team.lon,team.lat,1);
      const ahead=mapPoint(...team.ahead,1);car.angle=Math.atan2(car.point.x-ahead.x,car.point.z-ahead.z);
      const selected=team.id===packet.selectedId;
      car.label.el.classList.toggle('selected',selected);
      car.label.el.textContent=selected?`P${team.rank} · ${team.name}`:`P${team.rank}`;
      car.label.el.title=team.name;car.label.width=selected?Math.min(210,team.name.length*6+45):36;
      car.label.priority=selected?10:4;car.label.point=car.point.clone();car.label.point.y+=14;
    }
    if(follow){const car=cars.find(c=>c.team.id===follow);if(car){const delta=car.point.clone().sub(controls.target);camera.position.add(delta);controls.target.copy(car.point);}}
    updateCarInstances();
  }

  function updateCarInstances(){
    for(const car of cars){
      const {x,z}=car.point,step=3;
      const up=new THREE.Vector3(-(heightAt(x+step,z)-heightAt(x-step,z))/(2*step),1,-(heightAt(x,z+step)-heightAt(x,z-step))/(2*step)).normalize();
      const backward=new THREE.Vector3(Math.sin(car.angle),0,Math.cos(car.angle));
      const right=new THREE.Vector3().crossVectors(up,backward).normalize();backward.crossVectors(right,up).normalize();
      car.rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,backward));
    }
    for(const part of carParts){
      part.mesh.count=cars.length*part.offsets.length;
      cars.forEach((car,i)=>{
        const size=clamp(camera.position.distanceTo(car.point)*.0011,.32,2.8);
        part.offsets.forEach(([x,y,z],j)=>{
          const local=new THREE.Vector3(x,y,z).multiplyScalar(size).applyQuaternion(car.rotation);
          transform.position.copy(car.point).add(local);transform.quaternion.copy(car.rotation);transform.scale.setScalar(size);transform.updateMatrix();
          part.mesh.setMatrixAt(i*part.offsets.length+j,transform.matrix);
          if(part.teamColor)part.mesh.setColorAt(i*part.offsets.length+j,new THREE.Color(car.team.color||'#e5bb76'));
        });
        if(car.team.id===lastPacket?.selectedId){markerRing.visible=true;markerRing.position.copy(car.point);markerRing.position.y+=.4;markerRing.scale.setScalar(size);}
      });
      part.mesh.instanceMatrix.needsUpdate=true;if(part.mesh.instanceColor)part.mesh.instanceColor.needsUpdate=true;
    }
    if(!cars.some(c=>c.team.id===lastPacket?.selectedId))markerRing.visible=false;
  }

  function updateLabels(){
    const w=host.clientWidth,h=host.clientHeight,occupied=[];
    const blocked=[...host.querySelectorAll('.terrain-tools,.terrain-caption'),...host.parentElement.querySelectorAll('.map-actions,.map-zoom')].map(el=>{const b=el.getBoundingClientRect(),r=host.getBoundingClientRect();return{x:b.x-r.x,y:b.y-r.y,w:b.width,h:b.height};});
    for(const label of [...labels].sort((a,b)=>b.priority-a.priority)){
      if(!label.point)continue;
      vec.copy(label.point).project(camera);
      const x=(vec.x+1)*w/2,y=(1-vec.y)*h/2;
      let chosen=null;
      if(vec.z>=-1&&vec.z<=1&&x>6&&x<w-6&&y>6&&y<h-6){
        for(const [dx,dy] of [[10,-24],[10,6],[-label.width-10,-24],[-label.width-10,6],[10,-46]]){
          const box={x:x+dx,y:y+dy,w:label.width,h:label.height};
          if(box.x<3||box.x+box.w>w-3||box.y<3||box.y+box.h>h-3)continue;
          if([...occupied,...blocked].some(b=>box.x<b.x+b.w+3&&box.x+box.w>b.x-3&&box.y<b.y+b.h+3&&box.y+box.h>b.y-3))continue;
          chosen=box;break;
        }
      }
      label.el.hidden=!chosen;
      if(chosen){label.el.style.transform=`translate(${Math.round(chosen.x)}px,${Math.round(chosen.y)}px)`;occupied.push(chosen);}
    }
    host.querySelector('.terrain-north span').style.transform=`rotate(${-controls.getAzimuthalAngle()*180/Math.PI}deg)`;
    const zoom=baseDistance/camera.position.distanceTo(controls.target),label=host.parentElement.querySelector('#zoom-level'),slider=host.parentElement.querySelector('#map-zoom-range');
    options.onCameraChange?.({zoom});
    if(label)label.textContent=`${zoom.toFixed(1)}×`;
    if(slider){slider.min='.5';slider.max='24';slider.step='.1';slider.value=zoom;slider.title='Acercamiento de la vista 3D';}
  }

  function render(){
    raf=0;if(disposed||!visible||document.hidden)return;
    const moved=controls.update();updateCarInstances();updateLabels();renderer.render(scene,camera);frames++;
    host.dataset.frames=String(frames);host.dataset.triangles=String(renderer.info.render.triangles);host.dataset.drawCalls=String(renderer.info.render.calls);
    if(moved&&controls.enableDamping)requestFrame();
  }
  function requestFrame(){if(!raf&&!disposed&&visible&&!document.hidden)raf=requestAnimationFrame(render);}
  function resize(){
    if(disposed||!host.clientWidth||!host.clientHeight)return;
    if(segments!==detailSegments()){buildTerrain();return;}
    renderer.setPixelRatio(quality==='low'?1:Math.min(devicePixelRatio,host.clientWidth<650?1.25:1.5));
    renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();
    roadGroup?.children.forEach(l=>l.material.resolution.set(host.clientWidth,host.clientHeight));requestFrame();
  }
  function focus(point,distance){
    const direction=camera.position.clone().sub(controls.target).normalize();
    if(!direction.length())direction.set(-.35,.95,1).normalize();
    controls.target.copy(point);camera.position.copy(point).addScaledVector(direction,distance);controls.update();requestFrame();
  }
  function fit(){
    follow=null;viewLabel.textContent='Vista general';
    const aspect=host.clientWidth/Math.max(1,host.clientHeight);
    baseDistance=Math.max(1650,1450/Math.max(.55,aspect));
    controls.target.set(0,Math.max(45,meta.maximum*metersToY()*.3),0);
    const direction=new THREE.Vector3(-.35,.95,1).normalize();
    // Fit the whole relief, including its tallest corner, into narrow viewports.
    const corners=[];
    for(const x of [-500,500])for(const z of [-475,475])for(const y of [-22,meta.maximum*metersToY()])corners.push(new THREE.Vector3(x,y,z));
    for(let i=0;i<24;i++){
      camera.position.copy(controls.target).addScaledVector(direction,baseDistance);
      camera.lookAt(controls.target);camera.updateMatrixWorld();
      if(corners.every(p=>{const q=p.clone().project(camera);return Math.abs(q.x)<.94&&Math.abs(q.y)<.86;}))break;
      baseDistance*=1.06;
    }
    controls.maxDistance=Math.max(3400,baseDistance*1.5);
    controls.update();requestFrame();
  }
  controls.addEventListener('change',requestFrame);
  controls.addEventListener('start',()=>{follow=null;viewLabel.textContent='Cámara libre';options.onFreeCamera?.();});
  const observer=new ResizeObserver(resize);observer.observe(host);
  const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestFrame();else if(raf){cancelAnimationFrame(raf);raf=0;}});intersection.observe(host);
  const visibility=()=>{if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else requestFrame();};document.addEventListener('visibilitychange',visibility);
  host.querySelector('.terrain-north').onclick=()=>{const distance=camera.position.distanceTo(controls.target);camera.position.copy(controls.target).add(new THREE.Vector3(0,.95,1).normalize().multiplyScalar(distance));controls.update();requestFrame();};
  host.querySelector('.terrain-relief').onchange=e=>{relief=Number(e.target.value);buildTerrain();};
  qualitySelect.onchange=()=>{quality=qualitySelect.value;try{localStorage.setItem('apex-terrain-quality',quality);}catch{}buildTerrain();};
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(!disposed)options.onFatal();});
  let down=null;
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{
    if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5){down=null;return;}down=null;
    const b=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-b.x)/b.width*2-1,1-(e.clientY-b.y)/b.height*2),camera);
    const hit=ray.intersectObjects(carParts.map(p=>p.mesh),false)[0];
    if(hit){const part=carParts.find(p=>p.mesh===hit.object),car=cars[Math.floor(hit.instanceId/part.offsets.length)];car?.label.el.click();return;}
    ray.params.Line2={threshold:3};const road=ray.intersectObjects(roadGroup.children,false)[0];
    if(road){const button=document.createElement('button');button.dataset.action='map-stage';button.dataset.index=road.object.userData.stage;host.append(button);button.click();button.remove();}
  });
  renderer.domElement.onkeydown=e=>{
    if(['0','+','=','-','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
      e.preventDefault();
      if(e.key==='0')fit();else if(['+','=','-'].includes(e.key))command('zoom',e.key==='-'?1.25:.8);
      else{const offset=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(offset);s.theta+=e.key==='ArrowLeft'?.12:e.key==='ArrowRight'?-.12:0;s.phi=clamp(s.phi+(e.key==='ArrowUp'?-.08:e.key==='ArrowDown'?.08:0),.05,Math.PI*.46);camera.position.copy(controls.target).add(offset.setFromSpherical(s));controls.update();requestFrame();}
    }
  };
  function command(action,value){
    if(action==='fit')fit();
    else if(action==='unfollow'){follow=null;viewLabel.textContent='Cámara libre';}
    else if(action==='zoom')focus(controls.target,camera.position.distanceTo(controls.target)*value);
    else if(action==='zoomTo')focus(controls.target,baseDistance/value);
    else if(action==='follow'){
      const car=cars.find(c=>c.team.id===value);if(car){follow=value;viewLabel.textContent=`Siguiendo a ${car.team.name}`;focus(car.point,Math.min(camera.position.distanceTo(controls.target),options.followDistance||380));}
    }else if(action==='stage'){
      const stage=route.stages[Number(value)];if(stage){follow=null;const points=stage.path.map(p=>mapPoint(...p)),box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());viewLabel.textContent=stage.title||`Etapa ${Number(value)+1}`;focus(center,clamp(Math.max(size.x,size.z)*2,180,baseDistance));}
    }
    requestFrame();
  }
  buildTerrain();fit();
  if(options.pose){camera.position.fromArray(options.pose.position);controls.target.fromArray(options.pose.target);controls.update();}
  host.dataset.ready='true';requestFrame();
  return {
    routeId:route.id,command,
    update(packet){
      const signature=JSON.stringify(packet);
      if(signature===lastSignature)return;
      lastSignature=signature;lastPacket=packet;placeTeams(packet);requestFrame();
    },
    pose:()=>({position:camera.position.toArray(),target:controls.target.toArray()}),
    dispose(){
      if(disposed)return;disposed=true;if(raf)cancelAnimationFrame(raf);
      observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();
      disposeObject(terrain);disposeObject(skirt);disposeObject(roadGroup);
      resources.forEach(r=>r.dispose());bitmap.close();carParts.forEach(p=>p.mesh.dispose());
      renderer.dispose();renderer.forceContextLoss();host.replaceChildren();
    },
  };
}
