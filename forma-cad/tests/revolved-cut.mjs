import fs from 'node:fs/promises';import assert from 'node:assert/strict';import * as R from 'replicad';import * as THREE from 'three';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';import {bodyRevolution} from '../src/body-revolution.js';import {cutRevolvedSolid} from '../src/revolved-cut.js';import {cadMesh} from '../src/cad-mesh.js';import {serializeCadShape} from '../src/cad-serialization.js';import {inspectCadStl} from '../src/stl-cad-inspection.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const out='.sites-runtime/revolved-cut',rows=[];await fs.mkdir(out,{recursive:true});
const base=R.drawRoundedRectangle(40,40,3).sketchOnPlane('XY').extrude(10).translate([10,10,0]);
const output=(shape,id)=>({id,...cadMesh(shape),brep:serializeCadShape(shape),cadCoordinatePrecision:true});
function valid(s){const a=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false),parts=s.solids;try{assert(a.IsValid());assert(parts.length>0);}finally{a.delete();parts.forEach(p=>p.delete());}}
function distance(s,point){const p=R.makeVertex(point);try{return R.measureDistanceBetween(p,s);}finally{p.delete();}}
const center=(angle,z)=>[20*Math.cos(angle*Math.PI/180),20*Math.sin(angle*Math.PI/180),z];
function capAreas(s){const faces=s.faces;try{return faces.filter(f=>f.geomType==='PLANE').flatMap(f=>{const n=f.normalAt();try{return Math.abs(n.toTuple()[2])>.999?[R.measureArea(f)]:[];}finally{n.delete();}});}finally{faces.forEach(f=>f.delete());}}
const sweepSpec={type:'revolve',sourceBody:'cutter',bodySweep:true,target:'base',origin:[0,0,0],axisVector:[0,0,1],angle:90,direction:'片側',operation:'cut'};
const cutter=R.makeCylinder(4,10,[20,0,-5e-7],[0,0,1]),sweep=bodyRevolution(cutter,sweepSpec),old=base.cut(sweep);
try{
 assert(distance(old,center(45,10))<1e-6,'prior cut covers the intended opening with a wafer');
 assert.equal(capAreas(old).length,3,'wafer introduces an extra cap');
 const oldAudit=inspectCadStl(output(old,'old')).report;
 rows.push({case:'old-behavior-reproduced',waferAtTop:true,oldStlCounts:oldAudit.counts});
}finally{old.delete();sweep.delete();cutter.delete();}
const initialBase=serializeCadShape(base),baseVolume=R.measureVolume(base),expected=baseVolume-96*Math.PI*10;
for(const delta of [0,-5e-7,5e-7])for(const direction of ['片側','逆方向','対称']){
 // The test plate contains the complete positive-quadrant path. Restrict
 // volume/cap-area assertions to that path; the other directions cross its edge.
 const tool=R.makeCylinder(4,10,[20,0,delta],[0,0,1]),features=[{kind:'cadop',id:'parts',name:'同一高さの板と円柱',outputs:[output(base,'base'),output(tool,'cutter')],remove:[]}],snapshot=JSON.stringify(features),spec={...sweepSpec,id:'cut',direction},events=[],result=runOperation(features,spec,e=>events.push(e)),shape=R.deserializeShape(result.outputs[0].brep).asShape3D();
 try{
  valid(shape);assert.equal(result.outputs[0].id,'base');assert.deepEqual(result.remove,[]);assert(events.some(e=>e.stage.includes('一致する境界面')));
  if(direction==='片側'){assert(Math.abs(R.measureVolume(shape)-expected)<1e-6);for(const area of capAreas(shape))assert(Math.abs(area-expected/10)<1e-6);}
  const mid=direction==='片側'?45:direction==='逆方向'?-22.5:22.5;
  for(const z of [0,5,10])assert(distance(shape,center(mid,z))>3.9,'opening remains clear at '+direction+'/'+delta+'/'+z);
  const audit=inspectCadStl(result.outputs[0]).report;assert(audit.ok,JSON.stringify(audit.counts));assert.equal(JSON.stringify(features),snapshot);
  rows.push({case:'body-sweep',direction,delta,throughOpening:true,closedStl:true});
  if(delta===-5e-7&&direction==='片側'){
   const doc={format:'forma-cad',version:1,units:'mm',features};await fs.writeFile(out+'/before.forma.json',JSON.stringify(doc));
   await fs.writeFile(out+'/after.forma.json',JSON.stringify({...doc,features:[...features,{kind:'cadop',id:spec.id,name:'回転切り取り',spec,...result}]}));
   const after=[...features,{kind:'cadop',id:spec.id,name:'回転切り取り',spec,...result}],replay=runOperation(after,{type:'replay',before:after,start:1,forceFull:true});const r=R.deserializeShape(replay.features.at(-1).outputs[0].brep).asShape3D();try{assert(Math.abs(R.measureVolume(r)-expected)<1e-6);assert(distance(r,center(45,10))>3.9);}finally{r.delete();}
  }
 }finally{shape.delete();tool.delete();}
}
// Keep deliberate blind floors above the common 1e-6 mm contact tolerance.
for(const gap of [.0001,.2]){const tool=R.makeCylinder(4,10,[20,0,gap],[0,0,1]),s=bodyRevolution(tool,sweepSpec),cut=cutRevolvedSolid(base,s);try{valid(cut);assert(distance(cut,center(45,0))<1e-8);assert(distance(cut,center(45,gap))<1e-8);assert(R.measureVolume(cut)>expected+96*Math.PI*gap*.99);rows.push({case:'intentional-blind-floor',gap,preserved:true});}finally{cut.delete();s.delete();tool.delete();}}
// The same cap policy is independent of the world's XY plane.
const rotationAxis=[1,2,3],angle=31,q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...rotationAxis).normalize(),angle*Math.PI/180),shift=[137,-42,29],transform=p=>new THREE.Vector3(...p).applyQuaternion(q).add(new THREE.Vector3(...shift)).toArray(),obliqueBase=base.clone().rotate(angle,[0,0,0],rotationAxis).translate(shift),tool=R.makeCylinder(4,10,[20,0,-5e-7],[0,0,1]),s=bodyRevolution(tool,sweepSpec),obliqueTool=s.clone().rotate(angle,[0,0,0],rotationAxis).translate(shift),before=[obliqueBase.serialize(),obliqueTool.serialize()],cut=cutRevolvedSolid(obliqueBase,obliqueTool);
try{valid(cut);assert(Math.abs(R.measureVolume(cut)-expected)<1e-5);assert(distance(cut,transform(center(45,10)))>3.9);assert.deepEqual([obliqueBase.serialize(),obliqueTool.serialize()],before);assert(inspectCadStl(output(cut,'tilted')).report.ok);rows.push({case:'oblique-transformed',throughOpening:true,sourceUnchanged:true,closedStl:true});}finally{cut.delete();obliqueTool.delete();s.delete();tool.delete();obliqueBase.delete();}
// A revolved sketch/profile uses the same cut path as a swept solid.
for(const delta of [0,-5e-7]){const region={plane:'CUSTOM',frame:{u:[1,0,0],v:[0,0,1],n:[0,-1,0]},offset:0,outer:[[16,delta],[24,delta],[24,10+delta],[16,10+delta]],holes:[]},features=[{kind:'cadop',id:'plate',outputs:[output(base,'base')],remove:[]}],result=runOperation(features,{...sweepSpec,bodySweep:undefined,sourceBody:undefined,id:'profile-cut',region}),shape=R.deserializeShape(result.outputs[0].brep).asShape3D();try{valid(shape);assert(Math.abs(R.measureVolume(shape)-(baseVolume-80*Math.PI*10))<1e-6);assert(distance(shape,center(45,10))>3.9);assert(inspectCadStl(result.outputs[0]).report.ok);rows.push({case:'profile-sweep',delta,throughOpening:true,closedStl:true});}finally{shape.delete();}}
assert(serializeCadShape(base)===initialBase,'native source geometry is untouched');base.delete();
const proof={pass:true,syntheticFixturesOnly:true,oldWaferReproduced:true,sameHeight:true,topAndBottomRoundoff:true,allDirections:true,profileAndBody:true,oblique:true,intentionalBlindFloorPreserved:true,sourceUnchanged:true,historyReplay:true,closedStl:true,rows};await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
