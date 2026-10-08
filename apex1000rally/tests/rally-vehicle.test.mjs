import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../online/node_modules/three/build/three.module.js';
import {GLTFLoader} from '../online/node_modules/three/examples/jsm/loaders/GLTFLoader.js';

test('the rally GLB is self-contained, fits its draw budget and has one tintable body material',async()=>{
  const raw=await readFile(new URL('../tutorial/assets/vehicles/trail-r4.glb',import.meta.url));
  assert.equal(raw.readUInt32LE(0),0x46546c67);assert.equal(raw.readUInt32LE(4),2);assert.equal(raw.readUInt32LE(8),raw.length);
  const json=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)).toString());
  assert.ok(raw.length<500*1024);
  assert.equal(json.images?.length||0,0);assert.equal(json.textures?.length||0,0);
  assert.ok(json.buffers.every(b=>!b.uri),'Must not fetch outside resources');
  assert.equal(json.materials.filter(m=>m.name==='team_paint').length,1);
  const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
  let triangles=0,meshes=0;const bounds=new THREE.Box3().setFromObject(gltf.scene);
  gltf.scene.traverse(mesh=>{
    if(!mesh.isMesh)return;meshes++;
    const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    assert.ok([...p.array,...n.array].every(Number.isFinite));
    triangles+=(mesh.geometry.index?.count||p.count)/3;
    if(mesh.material.name==='team_paint')assert.equal(mesh.material.color.getHex(),0xffffff,'Instance color must not multiply another paint color');
    mesh.geometry.dispose();mesh.material.dispose();
  });
  assert.equal(meshes,6);assert.ok(triangles<=5000);assert.ok(bounds.min.y>=-.05&&bounds.min.y<.15,'Wheels must sit at ground level');
  assert.ok(bounds.max.z>7&&bounds.min.z<-6,'The spare and nose must be included');
  const meta=JSON.parse(await readFile(new URL('../tutorial/assets/vehicles/trail-r4.json',import.meta.url),'utf8'));
  assert.equal(meta.triangles,triangles);assert.equal(meta.bytes,raw.length);
});
