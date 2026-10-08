import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadRallyVehicle,tintRallyVehicle} from './vehicle-asset.js';

export async function createVehiclePreview(host,{url,color,signal}) {
  const parts=await loadRallyVehicle(url,signal);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});}
  catch(error){parts.forEach(p=>{p.geometry.dispose();p.material.dispose();});throw error;}
  let disposed=false,raf=0,frames=0;
  renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  host.replaceChildren(renderer.domElement);renderer.domElement.className='vehicle-canvas';
  renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label','Modelo 3D del 4×4. Arrastrá para girar. Flechas para cambiar la vista y cero para restablecer.');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,200);
  camera.position.set(21,15,-26);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,3.6,0);
  controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.dampingFactor=.13;
  controls.enablePan=false;controls.minDistance=20;controls.maxDistance=65;controls.maxPolarAngle=Math.PI*.48;
  scene.add(new THREE.HemisphereLight(0xe0efff,0x384145,3));
  for(const [c,intensity,pos] of [[0xffe6c4,3.2,[-15,25,-12]],[0xc4dfff,2,[18,12,18]]]){const light=new THREE.DirectionalLight(c,intensity);light.position.set(...pos);scene.add(light);}
  const group=new THREE.Group();parts.forEach(p=>group.add(new THREE.Mesh(p.geometry,p.material)));scene.add(group);tintRallyVehicle(parts,color);
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(12.5,13,.35,64),new THREE.MeshStandardMaterial({color:0x26343a,roughness:.88}));platform.position.y=-.2;scene.add(platform);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(12.45,.035,4,64),new THREE.MeshBasicMaterial({color:0x85948f}));ring.rotation.x=Math.PI/2;ring.position.y=.015;scene.add(ring);
  // Soft contact shadow costs one transparent plane, no real-time shadow pass.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(32,32,5,32,32,32);g.addColorStop(0,'#000b');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,64,64);
  const texture=new THREE.CanvasTexture(canvas),shadow=new THREE.Mesh(new THREE.PlaneGeometry(15,22),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;scene.add(shadow);
  function frame(){raf=0;if(disposed||document.hidden)return;const changed=controls.update();renderer.render(scene,camera);host.dataset.frames=String(++frames);host.dataset.drawCalls=String(renderer.info.render.calls);if(changed&&controls.enableDamping)request();}
  function request(){if(!raf&&!disposed&&!document.hidden)raf=requestAnimationFrame(frame);}
  function resize(){if(!host.clientWidth||!host.clientHeight)return;renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(host.clientWidth,host.clientHeight,false);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();request();}
  const observer=new ResizeObserver(resize);observer.observe(host);controls.addEventListener('change',request);
  function visibility(){if(document.hidden&&raf){cancelAnimationFrame(raf);raf=0;}else request();}
  document.addEventListener('visibilitychange',visibility);
  renderer.domElement.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','0'].includes(e.key))return;e.preventDefault();if(e.key==='0')camera.position.set(21,15,-26);else{const v=camera.position.clone().sub(controls.target),s=new THREE.Spherical().setFromVector3(v);s.theta+=e.key==='ArrowLeft'?.15:e.key==='ArrowRight'?-.15:0;s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0),.1,Math.PI*.48);camera.position.copy(controls.target).add(v.setFromSpherical(s));}controls.update();request();};
  controls.update();resize();host.dataset.ready='true';
  return {setColor(color){tintRallyVehicle(parts,color);request();},dispose(){if(disposed)return;disposed=true;if(raf)cancelAnimationFrame(raf);observer.disconnect();document.removeEventListener('visibilitychange',visibility);controls.dispose();parts.forEach(p=>{p.geometry.dispose();p.material.dispose();});for(const mesh of [platform,ring,shadow]){mesh.geometry.dispose();mesh.material.dispose();}texture.dispose();renderer.dispose();renderer.forceContextLoss();host.replaceChildren();}};
}
