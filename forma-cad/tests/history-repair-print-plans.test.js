import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {movePrintPlacement,planPrintPlates,printPlacementMatrix} from '../src/print-layout.js';
import {comparePrintOrientations,inspectPrintLayoutPlate} from '../src/print-layout-inspection.js';
import {nearbyRepairEdges,nearbyRepairFaces} from '../src/history-reference-candidates.js';

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
   const intact={bodyId:'block',point:[0,20,5]};
   const spec={type,id:type,target:'block',radius:.5,distance:.5,edges:[{bodyId:'block',point:[20,0,5]},intact]};
   const feature={kind:'cadop',id:type,name:type,spec,...runOperation([first],spec)},original=[first,feature],next=[updated,feature];
   let retained;
   assert.throws(()=>runOperation(next,{type:'replay',before:original,start:0}),error=>{
    retained=error.referenceRepair?.retained;
    return error.referenceRepair?.spec.type===type;
   });
   assert.equal(retained[0],null);
   assert.deepEqual(retained[1][0].point,intact.point);
   const replacement={...spec,edges:[{bodyId:'block',point:[20,20,5]},...retained[1]]};
   const result=runOperation(next,{type:'replay',before:original,start:0,repairs:[{id:type,spec:replacement}]});
   assert.deepEqual(result.features.at(-1).spec,replacement);
   assert.ok(result.features.at(-1).outputs[0].triangles.length);
  }
 }finally{box.delete();notch.delete();changed.delete();}
});

test('an unchanged shell opening survives beside a changed opening',()=>{
 const box=R.makeBox([0,0,0],[20,20,10]),notch=R.makeBox([15,-1,7],[21,5,11]),changed=box.cut(notch);
 try{
  const first=source(box),bottom={bodyId:'block',point:[5,5,0],normal:[0,0,-1]};
  const spec={type:'shell',id:'shell',target:'block',thickness:.5,direction:'内側',faces:[{bodyId:'block',point:[5,5,10],normal:[0,0,1]},bottom]};
  const feature={kind:'cadop',id:'shell',spec,...runOperation([first],spec)};
  assert.throws(()=>runOperation([source(changed),feature],{type:'replay',before:[first,feature],start:0}),error=>{
   assert.deepEqual(error.referenceRepair?.retained,[null,[bottom]]);return true;
  });
 }finally{box.delete();notch.delete();changed.delete();}
});

test('saved positions reserve their original plate, center and rotation during repacking',()=>{
 const items=[{id:'fixed',min:[0,0,0],max:[32,21,10]},{id:'loose',min:[0,0,0],max:[32,21,10]}];
 const record={id:'fixed',plate:1,x:22,y:14,rotation:90,locked:true};
 const {plates}=planPrintPlates(items,{orientations:{fixed:'z-'},placementOverrides:[record],allowRotation:false});
 const fixed=plates[1].placements.find(p=>p.id==='fixed');
 assert.deepEqual({center:fixed.min.map((v,i)=>(v+fixed.max[i])/2).slice(0,2),rotation:fixed.rotation,orientation:fixed.orientation,locked:fixed.locked},
  {center:[22,14],rotation:90,orientation:'z-',locked:true});
 assert.equal(movePrintPlacement(plates[1],'fixed',1,1),null);
 const loose=plates[0].placements[0],moved=movePrintPlacement(plates[0],'loose',20,15);
 assert.deepEqual(moved.placements[0].min,[loose.min[0]+20,loose.min[1]+15,0]);
 assert.equal(movePrintPlacement(plates[0],'loose',100,0),null);
 assert.throws(()=>planPrintPlates(items,{placementOverrides:[{...record,x:85}]}),/保存位置/);
});

test('plate inspection respects print orientation and reports detached floating geometry',async()=>{
 const lower=new THREE.BoxGeometry(12,12,4).translate(0,0,2),upper=new THREE.BoxGeometry(4,4,4).translate(0,0,12);
 const positions=[...lower.toNonIndexed().attributes.position.array,...upper.toNonIndexed().attributes.position.array];
 const combined=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 const items=[{id:'part',min:[-6,-6,0],max:[6,6,14]}];
 try{
  const [plate]=planPrintPlates(items,{}).plates;
  const report=await inspectPrintLayoutPlate(plate,new Map([['part',combined]]));
  assert.equal(report.floating.length,1);
  assert.equal(report.floating[0].bounds.min[2],10);
  assert.equal(report.overhang.length,1);
  const [rotated]=planPrintPlates(items,{orientations:{part:'x+'}}).plates;
  const sideways=await inspectPrintLayoutPlate(rotated,new Map([['part',combined]]));
  assert.equal(sideways.floating[0].bounds.min[2],4);
  const comparison=await comparePrintOrientations([
   {orientation:'z+',placement:plate.placements[0]},
   {orientation:'x+',placement:rotated.placements[0]},
   {orientation:'y+'},
  ],combined,'z+');
  assert.equal(comparison.rows[0].area,16);
  assert.equal(comparison.rows[2].placement,undefined);
  assert.equal(comparison.recommended,'z+');
 }finally{lower.dispose();upper.dispose();combined.dispose();}
});

test('replacement suggestions prefer nearby matching geometry and group planar triangles',()=>{
 const box=new THREE.BoxGeometry(10,10,10),edges=new THREE.EdgesGeometry(box);
 try{
  const faces=nearbyRepairFaces(box,{point:[0,0,6],normal:[0,0,1]});
  assert.equal(faces[0].distance,1);
  assert.deepEqual(faces[0].normal,[0,0,1]);
  assert.equal(faces[0].points.length,18);
  const candidates=nearbyRepairEdges(edges,{point:[5,5,0]},[5,5,-5,5,5,5]);
  assert.deepEqual(candidates[0].point,[5,5,0]);
  assert.equal(candidates[0].distance,0);
 }finally{box.dispose();edges.dispose();}
});
