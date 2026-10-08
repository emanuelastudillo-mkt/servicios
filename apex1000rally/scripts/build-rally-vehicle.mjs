import * as THREE from '../online/node_modules/three/build/three.module.js';
import {mergeGeometries} from '../online/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js';
import {GLTFExporter} from '../online/node_modules/three/examples/jsm/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

// Original, editable low-poly rally model. +Y up, -Z forward, tyres at ground Y=0.
// Materials are merged into six meshes; only team_paint is tinted at runtime.
const materials={
  team_paint:new THREE.MeshStandardMaterial({color:0xffffff,roughness:.4,metalness:.18}),
  rubber:new THREE.MeshStandardMaterial({color:0x171d20,roughness:.9}),
  glass:new THREE.MeshStandardMaterial({color:0x233d49,roughness:.2,metalness:.45}),
  alloy:new THREE.MeshStandardMaterial({color:0x929fa5,roughness:.34,metalness:.7}),
  ivory:new THREE.MeshStandardMaterial({color:0xf2e5c8,roughness:.38,emissive:0x211c11,emissiveIntensity:.18}),
  red:new THREE.MeshStandardMaterial({color:0xc63829,roughness:.45}),
};
const batches=Object.fromEntries(Object.keys(materials).map(k=>[k,[]]));
const object=new THREE.Object3D();
function add(g,key,p=[0,0,0],r=[0,0,0]){
  if(g.index){const non=g.toNonIndexed();g.dispose();g=non;}
  g.deleteAttribute('uv');
  object.position.set(...p);object.rotation.set(...r);object.scale.set(1,1,1);object.updateMatrix();g.applyMatrix4(object.matrix);
  batches[key].push(g);
}
function box(w,h,d,key,p,r){add(new THREE.BoxGeometry(w,h,d),key,p,r);}
function cylinder(radius,length,key,p,r=[0,0,Math.PI/2],segments=16){add(new THREE.CylinderGeometry(radius,radius,length,segments),key,p,r);}
function panel(points,key){const g=new THREE.BufferGeometry();const verts=[];for(let i=1;i<points.length-1;i++)verts.push(...points[0],...points[i],...points[i+1]);g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();add(g,key);}
function tube(a,b,r,key){const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r,r,start.distanceTo(end),8);const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(start).normalize());g.applyQuaternion(q);g.translate(...start.add(end).multiplyScalar(.5).toArray());add(g,key);}
function profile(points,width,key,bevel=.08){
  const shape=new THREE.Shape();points.forEach(([z,y],i)=>shape[i?'lineTo':'moveTo'](-z,y));shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});
  g.translate(0,0,-width/2);g.rotateY(Math.PI/2);add(g,key);
}

// Body sides include real wheel-arch openings rather than wheels sunk into a box.
profile([[-6.55,2.45],[-6.65,3.7],[-5.7,4.25],[-2.7,4.45],[6.2,4.45],[6.55,4.05],[6.55,2.45],
 [6.25,2.45],[6.15,3.25],[5.4,4.05],[4.25,4.4],[3.1,4.05],[2.45,3.25],[2.25,2.45],
 [-2.15,2.45],[-2.35,3.25],[-3.05,4.05],[-4.2,4.4],[-5.35,4.05],[-6.1,3.25],[-6.2,2.45]],6.45,'team_paint');
box(5.4,.55,11.4,'rubber',[0,2.55,0]);
// Sloped cabin, narrowed roof and beveled bonnet.
const rings=[[-2.72,4.38,3.22,4.55,3.15],[-1.25,4.38,3.22,7.05,2.7],[4.45,4.38,3.22,7.05,2.7],[6.27,4.38,3.22,5.65,3.0]];
const cross=r=>{const[z,y,x,top,roof]=r;return[[-x,y,z],[x,y,z],[roof,top,z],[-roof,top,z]];};
for(let n=0;n<rings.length-1;n++){const a=cross(rings[n]),b=cross(rings[n+1]);for(let i=0;i<4;i++)panel([a[i],b[i],b[(i+1)%4],a[(i+1)%4]].reverse(),'team_paint');}
panel(cross(rings[0]).reverse(),'team_paint');panel(cross(rings.at(-1)),'team_paint');
// Slightly raised glass panels. Dark opaque glass avoids expensive transparency.
panel([[-2.96,4.74,-2.64],[2.96,4.74,-2.64],[2.5,6.85,-1.37],[-2.5,6.85,-1.37]].reverse(),'glass');
panel([[2.77,5.78,6.14],[-2.77,5.78,6.14],[-2.5,6.86,4.57],[2.5,6.86,4.57]].reverse(),'glass');
for(const side of [-1,1]){
  const p=(z,y)=>[side*(3.235-(y-4.38)*.195),y,z];
  for(const [front,back] of [[-1.1,1.15],[1.48,4.19]]){
    const pts=[p(front,4.95),p(back,4.95),p(back,6.8),p(front,6.8)];
    panel(side===1?pts.reverse():pts,'glass');
  }
  // Door seams, handle, side step, mirror and snorkel on one side.
  tube([side*3.27,2.9,1.3],[side*3.27,4.55,1.3],.026,'rubber');
  box(.1,.16,.52,'rubber',[side*3.31,4.68,.76]);
  box(.68,.24,3.95,'alloy',[side*3.6,1.88,.1]);
  tube([side*3.15,4.95,-1.4],[side*3.95,5.2,-1.65],.09,'rubber');
  box(.55,.58,.8,'rubber',[side*4.02,5.3,-1.65]);
  box(.04,.43,.6,'alloy',[side*4.31,5.3,-1.65]);
  // Small white rally identification panels, deliberately without shared numbers.
  box(.055,.72,1.3,'ivory',[side*3.305,3.73,.1]);
  for(const z of [-4.2,4.25]){
    const arc=new THREE.TorusGeometry(2.13,.22,4,12,Math.PI);arc.rotateY(Math.PI/2);
    add(arc,'rubber',[side*3.45,2.14,z]);
  }
}
tube([3.3,4.25,-2.75],[3.04,7.15,-1.3],.15,'rubber');box(.56,.3,.48,'rubber',[3.02,7.29,-1.32]);
// Grille, bumper, skid plate, towing eyes and recessed lamps.
box(6.7,.64,.66,'rubber',[0,2.45,-6.72]);box(6.7,.57,.58,'rubber',[0,2.6,6.7]);
box(3.05,.75,.12,'rubber',[0,3.45,-6.72]);
for(const x of [-1,-.5,0,.5,1])box(.13,.56,.05,'alloy',[x,3.45,-6.8]);
for(const x of [-2.35,2.35]){box(1.13,.64,.2,'ivory',[x,3.55,-6.72]);box(.43,.55,.18,'red',[x,3.63,6.67]);}
box(3.85,.26,1.24,'alloy',[0,1.94,-6.47],[.3,0,0]);
for(const x of [-1.45,1.45])add(new THREE.TorusGeometry(.23,.065,4,8),'red',[x,2.32,-7.1]);
tube([-2.4,2.8,-7.13],[-2.4,3.6,-7.13],.13,'rubber');tube([2.4,2.8,-7.13],[2.4,3.6,-7.13],.13,'rubber');tube([-2.4,3.6,-7.13],[2.4,3.6,-7.13],.13,'rubber');
box(2.2,.14,1.2,'rubber',[0,4.51,-4.1]);
for(const x of [-.72,-.24,.24,.72])box(.075,.04,.95,'alloy',[x,4.6,-4.1]);
// Roof rack, crossbars, roof lamps, antenna and rear-mounted spare.
for(const x of [-2.35,2.35])tube([x,7.36,-.7],[x,7.36,4.0],.105,'rubber');
for(const z of [-.7,1.7,4.0])tube([-2.35,7.36,z],[2.35,7.36,z],.105,'rubber');
for(const x of [-2.2,2.2])for(const z of [0,3.35])box(.16,.38,.24,'alloy',[x,7.2,z]);
for(const x of [-1.62,-.54,.54,1.62]){box(.84,.52,.58,'rubber',[x,7.45,-.94]);box(.67,.36,.06,'ivory',[x,7.45,-1.25]);}
tube([-2.3,7.17,3.85],[-2.45,8.4,4.12],.033,'rubber');
function wheel(cx,cy,cz,spare=false){
  const transformGeo=g=>{if(!spare)g.rotateY(Math.PI/2);g.translate(cx,cy,cz);return g;};
  const core=new THREE.CylinderGeometry(1.88,1.88,1.24,12);core.rotateX(Math.PI/2);add(transformGeo(core),'rubber');
  for(const offset of [-.57,.57]){
    const shoulder=new THREE.TorusGeometry(1.62,.46,4,12);shoulder.translate(0,0,offset);add(transformGeo(shoulder),'rubber');
    const rim=new THREE.CylinderGeometry(1.02,1.02,.06,10);rim.rotateX(Math.PI/2);rim.translate(0,0,offset*1.75);add(transformGeo(rim),'alloy');
    const hub=new THREE.CylinderGeometry(.32,.32,.08,8);hub.rotateX(Math.PI/2);hub.translate(0,0,offset*1.86);add(transformGeo(hub),'rubber');
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;const g=new THREE.BoxGeometry(.16,.55,.08);g.translate(0,.64,0);g.rotateZ(a);g.translate(0,0,offset*1.84);add(transformGeo(g),'rubber');}
  }
  for(let i=0;i<12;i++){const a=i*Math.PI/6;const tread=new THREE.BoxGeometry(.56,.2,1.12);tread.translate(0,2.0,0);tread.rotateZ(a);add(transformGeo(tread),'rubber');}
}
for(const x of [-3.55,3.55])for(const z of [-4.2,4.25])wheel(x,2.11,z);
wheel(0,4.65,7.05,true);

const group=new THREE.Group();group.name='Apex Trail R4';group.userData={author:'Apex Rally',frontAxis:'-Z',paintMaterial:'team_paint',version:1};
let triangles=0;
for(const [name,geometries] of Object.entries(batches)){
  const geometry=mergeGeometries(geometries,false);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=materials[name];material.name=name;
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;group.add(mesh);triangles+=geometry.attributes.position.count/3;
  geometries.forEach(g=>g.dispose());
}
// GLTFExporter's browser FileReader adapter; no textures or external resources.
globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}};
const glb=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true});
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'tutorial/assets/vehicles');await mkdir(out,{recursive:true});
await writeFile(path.join(out,'trail-r4.glb'),new Uint8Array(glb));
const stats={name:group.name,version:1,triangles,meshes:group.children.length,materials:Object.keys(materials),bytes:glb.byteLength,frontAxis:'-Z',textures:0,teamColorMaterial:'team_paint',originalDesign:true};
await writeFile(path.join(out,'trail-r4.json'),JSON.stringify(stats,null,2)+'\n');
console.log(JSON.stringify(stats));
