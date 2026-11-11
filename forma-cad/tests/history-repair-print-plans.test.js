import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {planPrintPlates,printPlacementMatrix} from '../src/print-layout.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));
const source=shape=>({kind:'cadop',id:'block',name:'元の形状',outputs:[{id:'block',...cadMesh(shape),brep:serializeCadShape(shape)}],remove:[]});

test('a broken shell reference returns its new input shape and can be reselected atomically',()=>{
 const box=R.makeBox([0,0,0],[20,20,10]),notch=R.makeBox([15,-1,-1],[21,5,11]),changed=box.cut(notch);
 try{
  const first=source(box),spec={type:'shell',id:'shell',target:'block',thickness:.5,direction:'内側',faces:[{bodyId:'block',point:[5,5,10],normal:[0,0,1]}]};
  const feature={kind:'cadop',id:'shell',name:'上を開くシェル',spec,...runOperation([first],spec)};
  const original=[first,feature],next=[source(changed),feature],snapshot=JSON.stringify(original);
  let error;
  try{runOperation(next,{type:'replay',before:original,start:0});}catch(failure){error=failure;}
  assert.ok(error?.referenceRepair);
  assert.equal(error.featureId,'shell');
  assert.equal(error.referenceRepair.prefix.length,1);
  const repair={id:'shell',spec:{...spec,faces:[{bodyId:'block',point:[6,12,10],normal:[0,0,1]}]}};
  const result=runOperation(next,{type:'replay',before:original,start:0,repairs:[repair]});
  const normal=runOperation([next[0]],repair.spec);
  assert.equal(result.features.length,2);
  assert.deepEqual(result.features[1].spec.faces,repair.spec.faces);
  assert.equal(JSON.stringify(original),snapshot);
  const a=kernelBodies(result.features),b=R.deserializeShape(normal.outputs[0].brep).asShape3D();
  try{assert.ok(Math.abs(R.measureVolume(a.get('block'))-R.measureVolume(b))<1e-5);}
  finally{a.forEach(shape=>shape.delete());b.delete();}
 }finally{box.delete();notch.delete();changed.delete();}
});

test('print plans pack multiple plates, save orientations, and preserve assembly geometry',()=>{
 const items=Array.from({length:5},(_,i)=>({id:'part-'+i,min:[i*250,10,15],max:[i*250+100,110,35]}));
 const original=JSON.stringify(items),options={margin:2,gap:3,allowRotation:true,orientations:{'part-0':'z-','part-1':'x+'}};
 const {plates}=planPrintPlates(items,options);
 assert.ok(plates.length>1);
 assert.equal(plates.flatMap(plate=>plate.placements).length,5);
 assert.equal(new Set(plates.flatMap(plate=>plate.placements.map(part=>part.id))).size,5);
 for(const plate of plates)for(const placement of plate.placements){
  const item=items.find(item=>item.id===placement.id),matrix=printPlacementMatrix(placement),box=new THREE.Box3();
  for(const x of [item.min[0],item.max[0]])for(const y of [item.min[1],item.max[1]])for(const z of [item.min[2],item.max[2]])
   box.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
  assert.ok(Math.abs(box.min.z)<1e-5);
  assert.ok(box.min.x>=-88-1e-5&&box.min.y>=-88-1e-5&&box.max.x<=88+1e-5&&box.max.y<=88+1e-5);
 }
 assert.equal(JSON.stringify(items),original);
 const plan={type:'printLayoutPlan',id:'plan',targets:items.map(item=>item.id),...options};
 assert.deepEqual(runOperation([],plan),{outputs:[],remove:[]});
 assert.throws(()=>planPrintPlates(items,{...options,orientations:{'part-0':'bad'}}),/印刷する/);
 assert.throws(()=>planPrintPlates([{id:'large',min:[0,0,0],max:[190,100,10]}],{}),/超えています/);
 assert.throws(()=>planPrintPlates([{id:'large',min:[0,0,0],max:[190,100,10]}],{orientations:{large:'x+'}}),/高さ180 mm/);
});

test('fillet and chamfer can replace a disappeared edge without changing other settings',()=>{
 const box=R.makeBox([0,0,0],[20,20,10]),notch=R.makeBox([15,-1,-1],[21,5,11]),changed=box.cut(notch);
 try{
  const first=source(box),updated=source(changed);
  for(const type of ['fillet','chamfer']){
   const spec={type,id:type,target:'block',radius:.5,distance:.5,edges:[{bodyId:'block',point:[20,0,5]}]};
   const feature={kind:'cadop',id:type,name:type,spec,...runOperation([first],spec)},original=[first,feature],next=[updated,feature];
   assert.throws(()=>runOperation(next,{type:'replay',before:original,start:0}),error=>error.referenceRepair?.spec.type===type);
   const replacement={...spec,edges:[{bodyId:'block',point:[20,20,5]}]};
   const result=runOperation(next,{type:'replay',before:original,start:0,repairs:[{id:type,spec:replacement}]});
   assert.deepEqual(result.features.at(-1).spec,replacement);
   assert.ok(result.features.at(-1).outputs[0].triangles.length);
  }
 }finally{box.delete();notch.delete();changed.delete();}
});
