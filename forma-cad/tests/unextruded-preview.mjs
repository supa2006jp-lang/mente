import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,volume} from '../src/geometry.js';
import {featureSolid,kernelBodies,runOperation} from '../src/kernel.js';
import {basisFor} from '../src/frames.js';
import {createUnextrudedPreview,reusableUnextrudedPreview} from '../src/unextruded-preview.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const cache=createUnextrudedPreview(),close=(a,b)=>assert(Math.abs(a-b)<.02,`${a} != ${b}`);
const dispose=group=>group.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});
const geometry=mesh=>new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(mesh.vertices,3)).setIndex(mesh.triangles);
let samples=0;
for(const orientation of [{plane:'XY'},{plane:'XZ'},{plane:'YZ'},
 {plane:'CUSTOM',frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}])for(const symmetric of [false,true])for(const sourceDepth of [4,-4]){
 const {u,n}=basisFor(orientation),body={...defaults,...orientation,id:'base',kind:'extrusion',width:30,height:40,depth:14,x:u.x*15,y:u.y*15,z:u.z*15};
 const model=[body],region={...orientation,id:'region',offset:7,outer:[[-30,-20],[30,-20],[30,20],[-30,20]],holes:[[[-24,-4],[-24,4],[-20,4],[-20,-4]]],area:2368,sourceIds:[]};
 const feature={...defaults,...orientation,id:'tool',kind:'extrusion',profile:'region',region,depth:sourceDepth,symmetric,
  x:n.x*7,y:n.y*7,z:n.z*7,overlapOnly:true,unextrudedOnly:true,overlapTargets:['base']};
 const exact=runOperation(model,{type:'exactExtrusionPreview',features:[feature]});cache.storeExact(model,[feature],exact);
 assert.equal(cache.size,1);
 const bodies=kernelBodies(model);
 try{for(const depth of [3,-3,12]){
  const changed={...feature,id:'another-id',name:'距離だけ変更',depth},group=cache.create(model,[changed]);assert(group);
  group.updateMatrixWorld(true);let sum=0;const bounds=new THREE.Box3();
  for(const part of group.children){const g=part.geometry.clone().applyMatrix4(part.matrixWorld);sum+=volume(g);bounds.union(new THREE.Box3().setFromBufferAttribute(g.attributes.position));g.dispose();}
  const shape=featureSolid({...changed,depth:symmetric?Math.abs(depth):depth},bodies),expected=geometry(shape.mesh({tolerance:.08,angularTolerance:.15}));
  const box=new THREE.Box3().setFromBufferAttribute(expected.attributes.position);
  close(sum,Math.abs(R.measureVolume(shape)));assert(bounds.min.distanceTo(box.min)<.001);assert(bounds.max.distanceTo(box.max)<.001);
  assert.equal(group.userData.fastExtrusion,true);dispose(group);shape.delete();expected.dispose();samples++;
 }}finally{for(const b of bodies.values())b.delete();}
 for(const changed of [{capHoles:true},{symmetric:!symmetric},{region:{...region,offset:8}},{overlapTargets:['other']}])assert.equal(cache.create(model,[{...feature,...changed}]),null);
 assert.equal(cache.create(model,[feature],'editing'),null,'editing scope never reuses a new-command mesh');
 assert.equal(cache.create([...model],[feature]),null,'model changes invalidate tool sections');
}
const body={...defaults,id:'base',kind:'extrusion',width:30,height:40,x:15,depth:10},model=[body];
const region={id:'region',plane:'XY',offset:0,outer:[[-30,-20],[30,-20],[30,20],[-30,20]],holes:[],sourceIds:[],area:2400};
const feature={...defaults,id:'tool',kind:'extrusion',profile:'region',region,depth:4,operation:'join',target:'base',unextrudedOnly:true,overlapOnly:true,overlapTargets:['base']};
const joined=runOperation(model,{type:'exactExtrusionPreview',features:[feature]});cache.storeExact(model,[feature],joined);
assert.equal(cache.create(model,[feature]),null,'a merged body is never cached as the extrusion tool');
const tool=runOperation(model,{type:'extrusionToolPreview',feature});cache.store(model,[feature],[tool]);const shown=cache.create(model,[feature]);assert(shown);dispose(shown);
for(const changed of [{taperAngle:5},{barrier:true},{untilSolid:true},{gridExtentPlane:'XY'},{endPlane:{}},{operation:'cut'}])assert(!reusableUnextrudedPreview([{...feature,...changed}]));
const tiny=createUnextrudedPreview({maxBytes:1});tiny.store(model,[feature],[tool]);assert.equal(tiny.size,0);assert.equal(tiny.create(model,[feature]),null);
const limited=createUnextrudedPreview({maxEntries:1});limited.store(model,[feature],[tool]);limited.store(model,[{...feature,capHoles:true}],[tool]);assert.equal(limited.size,1);assert.equal(limited.create(model,[feature]),null);
cache.clear();assert.equal(cache.size,0);assert.equal(cache.bytes,0);limited.clear();tiny.clear();
console.log(JSON.stringify({pass:true,samples,signedAndSymmetric:true,axesAndOffsets:true,holes:true,modelAndScopeInvalidation:true,mergedBodyExcluded:true,boundedCache:true}));
