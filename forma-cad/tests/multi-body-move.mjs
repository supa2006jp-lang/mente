import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {defaults,validateProject,rebuild} from '../src/geometry.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const features=[{...defaults,id:'a',name:'左のボディ',kind:'extrusion',width:10,height:20,depth:8,x:-20},{...defaults,id:'b',name:'右のボディ',kind:'extrusion',width:16,height:10,depth:12,x:20},{...defaults,id:'stay',name:'動かさないボディ',kind:'extrusion',width:12,height:12,depth:6,y:45}];
const original=kernelBodies(features),meshes=rebuild(features),bounds=new THREE.Box3();for(const id of ['a','b'])bounds.union(new THREE.Box3().setFromObject(meshes.get(id)));const pivot=bounds.getCenter(new THREE.Vector3()).toArray();
const vertexSet=o=>Array.from({length:o.vertices.length/3},(_,i)=>o.vertices.slice(i*3,i*3+3));
for(const copy of [false,true])for(const reverseCopy of copy?[false,true]:[false]){
 const spec={type:'move',target:'a',targets:['a','b'],id:'group-move',copy,reverseCopy,x:13,y:-9,z:7,rotation:[25,-15,90],pivot},result=runOperation(features,spec);
 assert.deepEqual(result.outputs.map(o=>o.id),copy?['group-move','group-move-copy-1']:['a','b']);assert.deepEqual(result.remove,[]);
 const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...spec.rotation.map(v=>v*Math.PI/180),'ZYX')),n=new THREE.Vector3(spec.x,spec.y,spec.z).normalize();
 for(const [index,id]of ['a','b'].entries()){
  const output=result.outputs[index],points=vertexSet(output),shape=R.deserializeShape(output.brep).asShape3D();assert.ok(Math.abs(R.measureVolume(shape)-R.measureVolume(original.get(id)))<1e-5);shape.delete();
  for(const source of vertexSet(original.get(id).mesh())){const expected=new THREE.Vector3(...source).sub(new THREE.Vector3(...pivot)).applyQuaternion(q);if(reverseCopy)expected.addScaledVector(n,-2*expected.dot(n));expected.add(new THREE.Vector3(...pivot)).add(new THREE.Vector3(spec.x,spec.y,spec.z));assert.ok(points.some(point=>expected.distanceTo(new THREE.Vector3(...point))<1e-5),'every vertex uses the same pivot and rigid transform');}
 }
 const history=[...features,{kind:'cadop',id:spec.id,name:'まとめて移動',spec,...result}],saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:history}))),bodies=kernelBodies(saved);
 assert.equal(bodies.size,copy?5:3);assert.deepEqual(bodies.get('stay').mesh().vertices,original.get('stay').mesh().vertices,'unselected body stays unchanged');
 if(copy)for(const id of ['a','b'])assert.deepEqual(bodies.get(id).mesh().vertices,original.get(id).mesh().vertices,'copy preserves both originals');
 const replay=runOperation(history,{type:'replay',before:history,start:3});assert.deepEqual(replay.features.at(-1).outputs.map(o=>o.id),result.outputs.map(o=>o.id),'replay retains all body IDs');
 for(const body of bodies.values())body.delete();
}
assert.throws(()=>runOperation(features,{type:'move',target:'a',targets:['a','missing'],x:1,y:0,z:0,rotation:[0,0,0],pivot}),/見つかりません/);
assert.throws(()=>runOperation(features,{type:'move',target:'a',targets:[],x:1,y:0,z:0,rotation:[0,0,0],pivot}),/選択/);
for(const body of original.values())body.delete();for(const mesh of meshes.values())mesh.geometry.dispose();
await fs.mkdir('outputs/multi-body-move',{recursive:true});await fs.writeFile('outputs/multi-body-move/fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features}));
console.log('PASS grouped translation/rotation/common pivot, separate bodies, copy/reflection, untouched bodies, save/reload/replay and missing-target guards');
