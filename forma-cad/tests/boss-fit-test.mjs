import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {solidMeshComplete} from '../src/solid-mesh.js';import {bossFitPresets,bossFitPreset,bossFitTestSettings} from '../src/boss-fit.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
assert.deepEqual(bossFitPresets.map(p=>p.clearance),[.25,.15,.1]);for(const p of bossFitPresets)assert.equal(bossFitPreset(p.clearance),p.id);assert.equal(bossFitPreset(.2),'custom');
for(const settings of [{diameter:3,length:4,bossWall:1.6,bossHeight:8},{diameter:6,length:7,bossWall:1.2,bossHeight:9}]){
 const result=runOperation([],{type:'bossFitTest',id:'test',...settings}),a=result.analysis;assert.equal(result.outputs.length,8);assert.deepEqual(a.samples.map(s=>s.clearance),[.1,.15,.2,.25]);assert.ok(a.width<=180&&a.depth<=180);const shapes=new Map();
 try{
  for(const output of result.outputs){const shape=R.deserializeShape(output.brep).asShape3D();shapes.set(output.id,shape);const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{check.delete();solids.forEach(s=>s.delete());}const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-5);assert.ok(box.bounds[0][0]>=-1e-5&&box.bounds[1][0]<=180);assert.ok(box.bounds[0][1]>=-1e-5&&box.bounds[1][1]<=180);}finally{box.delete();}}
  function amount(shape,point,r=.02){const probe=R.makeCylinder(r,.05,point),hit=shape.intersect(probe);try{return R.measureVolume(hit)/R.measureVolume(probe);}finally{probe.delete();hit.delete();}}
  for(const sample of a.samples){const suffix=Math.round(sample.clearance*100),boss=shapes.get('test-boss-'+suffix),pin=shapes.get('test-pin-'+suffix),[x,y]=sample.bossCenter,[px,py]=sample.pinCenter,r=sample.diameter/2;
   assert.ok(amount(boss,[x+r+sample.clearance-.04,y,sample.rootZ-.5])<1e-5,'hole has the specified diametral clearance');assert.ok(amount(boss,[x+r+sample.clearance+.04,y,sample.rootZ-.5])>.999);
   assert.ok(amount(pin,[px+r-.04,py,a.baseThickness+.4])>.999);assert.ok(amount(pin,[px+r+.04,py,a.baseThickness+.4])<1e-5,'all four pins have the same nominal diameter');
   assert.ok(amount(boss,[x,y,a.baseThickness+.5])>.999,'receiver retains its bottom');
   const assembled=pin.clone().rotate(180,[0,0,0],[1,0,0]).translate([x-px,y+py,2*a.baseThickness+a.bossHeight]),common=boss.intersect(assembled);try{assert.ok(Math.abs(R.measureVolume(common))<1e-5,'labelled pins insert without touching the hole walls or bottom');}finally{common.delete();assembled.delete();}
   const labelX=x-11.1/2;assert.ok(amount(boss,[labelX+1.4,1.2+5.6-.325,a.baseThickness+.2],.1)>.999,'numeric clearance label is real raised geometry');assert.ok(amount(boss,[labelX+1.4,1.2+2,a.baseThickness+.2],.1)<1e-5,'digits keep their open interior');
  }
 }finally{shapes.forEach(s=>s.delete());}
}
assert.ok(bossFitTestSettings({diameter:3,length:9,bossHeight:4}).bossHeight>=10.45);
for(const bad of [{diameter:0},{length:0},{bossWall:.2},{bossHeight:NaN},{diameter:50,bossWall:20}])assert.throws(()=>runOperation([],{type:'bossFitTest',id:'bad',...bad}));
console.log('PASS presets, 4 clearances / 8 labelled valid solids, exported mesh, exact holes/pins, insertion and floor clearance, print bed and plate bounds');
