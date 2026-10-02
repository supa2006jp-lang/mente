import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,rebuild,volume} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {cylindricalSelection} from '../src/cylindrical-selection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box={...defaults,id:'b',name:'plate',width:60,height:40,depth:10,x:12,y:7};
const hole={...defaults,id:'h',name:'hole',profile:'circle',diameter:16,x:12,y:7,z:10,depth:-10,operation:'cut',target:'b',hole:true};
const meshVolume=m=>{const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(m.vertices,3)).setIndex(m.triangles);return volume(g);};
for(const depth of [-6,-10]){
 const features=[box,{...hole,depth}],mesh=rebuild(features).get('b');mesh.updateMatrixWorld(true);
 const hit=new THREE.Raycaster(new THREE.Vector3(12,7,8),new THREE.Vector3(0,1,0)).intersectObject(mesh,false)[0];
 assert.ok(hit,'Hole wall must be raycastable');
 const selected=cylindricalSelection(features,'b',mesh.geometry,hit.faceIndex,hit.point);
 assert.ok(selected?.internal,'Hole wall should be selected as a cylinder');
 assert.ok(selected.geometry.attributes.position.count>90,'Highlight the whole wall, not one triangle');
 const before=meshVolume(kernelBodies(features).get('b').mesh());
 const result=runOperation(features,{type:'thread',target:'b',id:'thread',surfacePoint:hit.point.toArray(),pitch:2,profile:'metric60',fullLength:true,leftHand:depth===-6});
 assert.equal(result.outputs[0].id,'b');
 const after=meshVolume(result.outputs[0]);
 assert.ok(after>before+1,'Internal thread must add inward material: '+[before,after]);
 assert.ok(after<before*1.05,'Internal thread must preserve the plate');
 console.log('PASS hole wall selection and internal thread',depth,after-before);
}
const cylinder={...defaults,id:'c',name:'cylinder',profile:'circle',diameter:20,depth:20,x:40,y:20,z:5};
const before=meshVolume(kernelBodies([cylinder]).get('c').mesh());
const result=runOperation([cylinder],{type:'thread',target:'c',id:'thread',surfacePoint:[50,20,15],pitch:4,turns:3,wire:1.5});
assert.ok(meshVolume(result.outputs[0])>before+1,'External thread must add material');
console.log('PASS external thread still adds material');
for(const depth of [10,20,30]){
 const f={...cylinder,diameter:10,depth,x:0,y:0,z:0};
 const output=runOperation([f],{type:'thread',target:'c',surfacePoint:[5,0,depth/2],pitch:1.5,profile:'metric60',fullLength:true}).outputs[0];
 const shape=R.deserializeShape(output.brep).asShape3D(),base=kernelBodies([f]).get('c');
 assert.ok(R.measureVolume(shape)>R.measureVolume(base),'Thread must retain cylinder and add ridges at height '+depth);
 assert.ok(Math.abs(R.measureVolume(base.cut(shape)))<.001,'Original cylinder must remain completely inside threaded result');
 console.log('PASS periodic seam thread fusion',depth);
}
for(const fullLength of [true,false]){
 const spec={type:'thread',target:'c',id:'thread',surfacePoint:[50,20,20],pitch:2,profile:'metric60',fullLength,length:7,offset:3,leftHand:!fullLength};
 const result=runOperation([cylinder],spec);
 assert.ok(meshVolume(result.outputs[0])>before+1);
 const z=result.outputs[0].vertices.filter((v,i)=>i%3===2);
 assert.ok(Math.min(...z)>=5-1e-4&&Math.max(...z)<=25+1e-4,'Thread must remain inside cylinder ends');
 console.log('PASS metric external thread',fullLength?'full length':'partial left hand');
}
assert.throws(()=>runOperation([box,hole],{type:'thread',target:'b',surfacePoint:[12,15,8],profile:'metric60',pitch:2,length:9,offset:2}),/範囲/);
