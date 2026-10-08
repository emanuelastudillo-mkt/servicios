import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export async function loadRallyVehicle(url,signal) {
  const response=await fetch(url,{signal});
  if(!response.ok)throw Error('No se pudo cargar el vehículo.');
  const gltf=await new GLTFLoader().parseAsync(await response.arrayBuffer(),new URL('.',url).href);
  const parts=[];gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry.clone().applyMatrix4(node.matrixWorld);
    const material=node.material.clone();
    parts.push({geometry,material,teamColor:material.name==='team_paint'});
    node.geometry.dispose();node.material.dispose();
  });
  if(signal?.aborted){parts.forEach(p=>{p.geometry.dispose();p.material.dispose();});throw new DOMException('Vista cerrada','AbortError');}
  if(!parts.some(p=>p.teamColor)){parts.forEach(p=>{p.geometry.dispose();p.material.dispose();});throw Error('El modelo no tiene carrocería personalizable.');}
  return parts;
}

export function tintRallyVehicle(parts,color) {
  for(const part of parts)if(part.teamColor)part.material.color.set(color);
}
