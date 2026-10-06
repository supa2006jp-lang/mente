import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {makeSlideLid} from '../src/slide-lid.js';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={wall:4.2,floor:2.4,lidThickness:3.6,railDepth:1.2,cover:1.2,clearance:.25,direction:'long',entry:'negative',pose:'assembled',grip:true};
function valid(shape){const c=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(c.IsValid());assert.equal(solids.length,1);}finally{c.delete();solids.forEach(s=>s.delete());}}
function material(shape,point){const tool=R.makeBox(point.map(v=>v-.01),point.map(v=>v+.01)),hit=shape.intersect(tool);try{return R.measureVolume(hit);}finally{hit.delete();tool.delete();}}
for(const direction of ['long','short'])for(const entry of ['negative','positive'])for(const angle of [0,27]){
 const source=R.makeBox([-40,-25,3],[40,25,33]).rotate(angle,[0,0,0],[0,0,1]).translate([12,-7,0]);
 const result=makeSlideLid(source,{...p,direction,entry});
 try{valid(result.body);valid(result.lid);const q=result.analysis;assert.equal(q.length,direction==='long'?80:50);assert.equal(q.width,direction==='long'?50:80);assert.equal(q.remainingWall,3);assert.ok(q.tipHeight>=1.2);assert.equal(q.overlap,0);assert.equal(q.slidingOverlap,0);assert.ok(R.measureVolume(result.body)<R.measureVolume(source));
  const point=(x,y,z)=>[q.center[0]+Math.cos(q.angle*Math.PI/180)*x-Math.sin(q.angle*Math.PI/180)*y,q.center[1]+Math.sin(q.angle*Math.PI/180)*x+Math.cos(q.angle*Math.PI/180)*y,q.center[2]+z];
  assert.ok(material(result.body,point(0,0,10))<1e-8,'hollow interior');assert.ok(material(result.body,point(0,0,1))>1e-6,'floor retained');assert.ok(material(result.body,point(q.length/2-1,0,q.height-.5))>1e-6,'closed rear end stop retained');assert.ok(material(result.body,point(-q.length/2+1,0,q.height-.5))<1e-8,'entrance roof removed; no bridge');
  const raised=result.lid.clone().translate([0,0,.7]),contact=result.body.intersect(raised);try{assert.ok(R.measureVolume(contact)>1e-6,'rails retain the lid against lifting');}finally{raised.delete();contact.delete();}
  const stopped=result.lid.clone().translate(q.axis.map(v=>v*1)),backHit=result.body.intersect(stopped);try{assert.ok(R.measureVolume(backHit)>1e-6,'rear wall stops further insertion');}finally{stopped.delete();backHit.delete();}
  console.log('PASS auto shell, '+direction+' axis '+entry+' entry '+angle+' degrees, valid separate solids, retention and full sliding path');
 }finally{result.body.delete();result.lid.delete();source.delete();}
}
const box=R.makeBox([-40,-25,0],[40,25,30]);try{
 for(const bad of [{wall:1},{floor:1},{clearance:0},{clearance:2},{railDepth:4},{lidThickness:1.2},{direction:'bad'},{entry:'bad'},{pose:'bad'},{grip:'yes'},{wall:NaN}])assert.throws(()=>makeSlideLid(box,{...p,...bad}));
 const output=makeSlideLid(box,{...p,pose:'print',grip:false});try{for(const part of [output.body,output.lid]){valid(part);const b=part.boundingBox;try{assert.ok(Math.abs(b.bounds[0][2])<1e-6);}finally{b.delete();}}const b=output.body.boundingBox,l=output.lid.boundingBox;try{assert.ok(l.bounds[0][0]-b.bounds[1][0]>=9.99);}finally{b.delete();l.delete();}}finally{output.body.delete();output.lid.delete();}
}finally{box.delete();}
for(const shape of [R.makeCylinder(20,30),R.makeBox([-40,-25,0],[40,25,30]).rotate(15,[0,0,0],[1,0,0]),R.makeBox([-6,-6,0],[6,6,6])])try{assert.throws(()=>makeSlideLid(shape,p));}finally{shape.delete();}
const base={...defaults,id:'box',kind:'extrusion',name:'元の直方体',width:80,height:50,depth:30,z:3},spec={...p,type:'slideLid',id:'slide',target:'box',pose:'print'},result=runOperation([base],spec);assert.deepEqual(result.outputs.map(o=>o.id),['box','slide-lid']);const op={kind:'cadop',id:'slide',name:'スライド蓋',spec,...result},layoutSpec={type:'printLayout',id:'plate',targets:['box','slide-lid'],margin:2,gap:3,allowRotation:true},layout=runOperation([base,op],layoutSpec),before=[base,op,{kind:'cadop',id:'plate',name:'印刷配置',spec:layoutSpec,...layout}];
const next=structuredClone(before);next[1].spec.clearance=.35;const replay=runOperation(next,{type:'replay',before,start:1});assert.equal(replay.features[1].analysis.clearance,.35);assert.equal(replay.features[2].outputs.length,2);validateProject({format:'forma-cad',version:1,features:replay.features});
console.log('PASS invalid shape/dimensions, print placement, save metadata and history replay through print layout');
