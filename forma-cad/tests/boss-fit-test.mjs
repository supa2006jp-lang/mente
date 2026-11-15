import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';import {solidMeshComplete} from '../src/solid-mesh.js';import {bossFitPresets,bossFitPreset,bossFitTestSettings} from '../src/boss-fit.js';
import {savedBodyMeshes} from '../src/cad-output-mesh.js';
import {snapBossAxialPlay,snapBossInsertion} from '../src/boss-snap.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
assert.deepEqual(bossFitPresets.map(p=>p.clearance),[.25,.2,.1]);for(const p of bossFitPresets)assert.equal(bossFitPreset(p.clearance),p.id);assert.equal(bossFitPreset(.15),'custom');
for(const settings of [{diameter:3,length:4,bossWall:1.6,bossHeight:8},{diameter:6,length:7,bossWall:1.2,bossHeight:9},{pinStyle:'snap',diameter:5,length:8,bossWall:1.6,bossHeight:10.5}]){
 const result=runOperation([],{type:'bossFitTest',id:'test',...settings}),a=result.analysis;assert.equal(result.outputs.length,8);assert.deepEqual(a.samples.map(s=>s.clearance),[.1,.15,.2,.25]);assert.ok(a.width<=180&&a.depth<=180);const shapes=new Map();
 const inspected=savedBodyMeshes({type:'stlMeshes',bodies:result.outputs});assert(inspected.inspection.ok,'all labelled pieces export with closed manifold edges');assert.equal(inspected.inspection.checkedBodies,8);
 try{
  for(const output of result.outputs){const shape=R.deserializeShape(output.brep).asShape3D();shapes.set(output.id,shape);const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{check.delete();solids.forEach(s=>s.delete());}const box=shape.boundingBox;try{assert.ok(Math.abs(box.bounds[0][2])<1e-5);assert.ok(box.bounds[0][0]>=-1e-5&&box.bounds[1][0]<=180);assert.ok(box.bounds[0][1]>=-1e-5&&box.bounds[1][1]<=180);}finally{box.delete();}}
  function amount(shape,point,r=.02){const probe=R.makeCylinder(r,.05,point),hit=shape.intersect(probe);try{return R.measureVolume(hit)/R.measureVolume(probe);}finally{probe.delete();hit.delete();}}
  for(const sample of a.samples){const suffix=Math.round(sample.clearance*100),boss=shapes.get('test-boss-'+suffix),pin=shapes.get('test-pin-'+suffix),[x,y]=sample.bossCenter,[px,py]=sample.pinCenter,r=sample.diameter/2;
   assert.ok(amount(boss,[x+r+sample.clearance-.04,y,sample.rootZ-.5])<1e-5,'hole has the specified diametral clearance');assert.ok(amount(boss,[x+r+sample.clearance+.04,y,sample.rootZ-.5])>.999);
   assert.ok(amount(pin,[px+r-.04,py,a.baseThickness+.4])>.999);assert.ok(amount(pin,[px+r+.04,py,a.baseThickness+.4])<1e-5,'all four pins have the same nominal diameter');
   assert.ok(amount(boss,[x,y,a.baseThickness+.5])>.999,'receiver retains its bottom');
   const assembled=pin.clone().rotate(180,[0,0,0],[1,0,0]).translate([x-px,y+py,2*a.baseThickness+a.bossHeight]),common=boss.intersect(assembled);try{assert.ok(Math.abs(R.measureVolume(common))<1e-5,'labelled pins insert without touching the hole walls or bottom');}finally{common.delete();assembled.delete();}
   if(settings.pinStyle==='snap'){
    assert.ok(amount(pin,[px,py,a.baseThickness+6])<1e-5,'slit separates the prongs');
    assert.ok(amount(pin,[px+2.82,py,a.baseThickness+6])>.999,'head projects past the shaft');
    assert.ok(amount(boss,[x+2.85,y,sample.rootZ-6])<1e-5,'receiver has a wider pocket');
    if(sample.clearance===.1){
     const neck=R.makeCylinder(r+.05,8,[px,py,a.baseThickness+2.5]);
     try{
      for(const sign of [-1,1]){
       const half=R.makeBox([px+(sign<0?-4:0),py-4,a.baseThickness+2.5],[px+(sign<0?0:4),py+4,a.baseThickness+8.1]);
       const arm=pin.intersect(half).translate([-sign*.56,0,0]),outside=arm.cut(neck);
       try{assert.ok(R.measureVolume(arm)>1);assert.ok(R.measureVolume(outside)<1e-5,'each deflected prong clears the minimum throat');}finally{half.delete();arm.delete();outside.delete();}
      }
     }finally{neck.delete();}
    }
    const pulled=pin.clone().rotate(180,[0,0,0],[1,0,0]).translate([x-px,y+py,2*a.baseThickness+a.bossHeight+2]),catchContact=boss.intersect(pulled);
    try{assert.ok(R.measureVolume(catchContact)>.01,'unflexed head catches in the throat when pulled');}finally{catchContact.delete();pulled.delete();}
   }
   const labelX=x-11.1/2;assert.ok(amount(boss,[labelX+1.4,1.2+5.6-.325,a.baseThickness+.2],.1)>.999,'numeric clearance label is real raised geometry');assert.ok(amount(boss,[labelX+1.4,1.2+2,a.baseThickness+.2],.1)<1e-5,'digits keep their open interior');
  }
 }finally{shapes.forEach(s=>s.delete());}
}
const settings={type:'bossFitTest',id:'compare',pinStyle:'snap',testMode:'engagement',diameter:5,length:8,bossWall:1.6,bossHeight:10.5,clearance:.2,snapShoulderOffset:.45,snapRetentionRidge:true};
const comparison=runOperation([],settings);
const {samples}=comparison.analysis;
assert.equal(comparison.outputs.length,6);
assert.deepEqual(samples.map(s=>[s.label,s.snapEngagement,s.holeDiameter,s.headDiameter]),[
 ['1','light',5.4,5.6],['2','standard',5.4,5.8],['3','strong',5.4,6],
]);
assert.ok(savedBodyMeshes({type:'stlMeshes',bodies:comparison.outputs}).inspection.ok);
for(const sample of samples){
 const actual=new Map(comparison.outputs.filter(o=>o.id.endsWith('-'+sample.snapEngagement))
  .map(o=>[o.id.split('-')[1],R.deserializeShape(o.brep).asShape3D()]));
 const [x,y]=sample.bossCenter,[px,py]=sample.pinCenter;
 const pin=actual.get('pin').rotate(180,[0,0,0],[1,0,0]).translate([x-px,y+py,2*comparison.analysis.baseThickness+comparison.analysis.bossHeight]);
 const boss=actual.get('boss');
 const seated=boss.intersect(pin),atThroat=pin.clone().translate([0,0,5]),contact=boss.intersect(atThroat);
 try{
  assert.ok(R.measureVolume(seated)<1e-5);
  assert.ok(R.measureVolume(contact)>.01);
  const analysis={diameter:5,clearance:.2,length:8,snap:{headDiameter:sample.headDiameter,pocketDiameter:sample.headDiameter+.4,axialGap:.5,shoulderOffset:sample.shoulderOffset,retentionRidgeHeight:sample.retentionRidgeHeight}};
  assert.equal(snapBossInsertion(analysis,0).state,'outside');
  const entering=snapBossInsertion(analysis,3);
  assert.equal(entering.state,'contact');
  assert.ok(Math.abs(entering.deflection-sample.engagementDepth)<1e-8);
  assert.equal(snapBossInsertion(analysis,8).state,'engaged');
  assert.ok(Math.abs(sample.retentionRidgeHeight-.15)<1e-8);
  const atRidge=snapBossInsertion(analysis,6.8);
  assert.equal(atRidge.state,'contact');
  assert.ok(Math.abs(atRidge.deflection-sample.engagementDepth-.15)<1e-8);
  const ridgeProbe=R.makeCylinder(.015,.04,[x+2.62,y,sample.rootZ-4.85]);
  const ridgeMaterial=boss.intersect(ridgeProbe);
  try{assert.ok(R.measureVolume(ridgeMaterial)>.99*R.measureVolume(ridgeProbe));}
  finally{ridgeProbe.delete();ridgeMaterial.delete();}
  const play=snapBossAxialPlay(analysis);
  assert.ok(Math.abs(sample.shoulderOffset-.75)<1e-8);
  assert.ok(Math.abs(play-.05)<1e-8);
  for(const [travel,interference] of [[play-.02,false],[play+.02,true]]){
   const moved=pin.clone().translate([0,0,travel]),intersection=boss.intersect(moved);
   try{assert.equal(R.measureVolume(intersection)>1e-6,interference);}
   finally{moved.delete();intersection.delete();}
  }
 }finally{seated.delete();atThroat.delete();contact.delete();pin.delete();boss.delete();}
}
assert.throws(()=>bossFitTestSettings({...settings,clearance:.3}),/3種類/);
assert.throws(()=>bossFitTestSettings({...settings,snapRetentionRidge:false,snapShoulderOffset:.8}),/受け穴の段/);
assert.throws(()=>bossFitTestSettings({...settings,clearance:.05}),/内側の突起/);
assert.ok(bossFitTestSettings({diameter:3,length:9,bossHeight:4}).bossHeight>=10.45);
for(const bad of [{diameter:0},{length:0},{bossWall:.2},{bossHeight:NaN},{diameter:50,bossWall:20}])assert.throws(()=>runOperation([],{type:'bossFitTest',id:'bad',...bad}));
console.log('PASS presets, 4 clearances / 8 labelled valid solids, exported mesh, exact holes/pins, insertion and floor clearance, print bed and plate bounds');
