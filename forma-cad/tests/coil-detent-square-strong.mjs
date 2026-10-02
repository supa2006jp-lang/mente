// Regression for the 40 mm square coil joint supplied as design.forma(31).
// The source file is not required by this test; only its relevant dimensions
// and coil settings are reproduced here.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {resolveCoilJoint,makeCoilJoint} from '../src/coil-joint.js';
import {polygonCylinder} from '../src/coil-prism.js';
import {detentDimensions} from '../src/coil-detent.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const profile=[[-20,-20],[20,-20],[20,20],[-20,20]];
const info={radius:20,outerRadius:20*Math.SQRT2,height:35.1,origin:[0,0,0],axis:[0,0,1],shapeType:'polygon',profile};
const source={wire:2,pitch:4,turns:2,wall:3.3,bodyBoreWall:1.5,jointGap:.4,jointSeam:0,jointSplit:.1,hand:'右ねじ',jointPose:'分けて並べる',autoFillet:false,closeAngleZero:2,jointLatch:true,latchStyle:'ridge',latchFirm:true,latchExtraFirm:true,latchGap:.05,latchEngagement:1.6,stopFaceSetback:.1,autoAdjust:true,rimSeat:true};
const old=resolveCoilJoint(info,source);
assert.ok(Math.abs(old.latchEngagement-1.205)<.001,'the supplied 3.3 mm wall caps the tooth height');
for(const wall of [4.09,4.1,4.2]){
 const q=resolveCoilJoint(info,{...source,wall}),d=detentDimensions(q);
 assert.ok(Math.abs(q.latchEngagement-1.6)<1e-7,'wall '+wall+' should allow the full 1.6 mm tooth');
 assert.ok(q.pitch>=d.requiredPitch-1e-7,'automatic pitch adjustment must leave the groove clear');
 assert.ok(d.backing>=1.2&&d.receiverBacking>=1.2&&d.reliefBacking>=1.5,'the receiver and relief retain printable walls');
 assert.ok(d.t>=1.2,'the arm keeps at least two 0.6 mm extrusion widths');
}
assert.ok(resolveCoilJoint(info,{...source,wall:4.08}).latchEngagement<1.6-1e-7,'4.08 mm is below the mathematical minimum');
for(const hand of ['右ねじ','左ねじ'])for(const stopFaceSetback of [.1,.5]){
 const base=polygonCylinder(profile,info.height);
 let result;
 try{
  result=makeCoilJoint(base,{...source,wall:4.2,pitch:4.1,hand,stopFaceSetback});
  const q=result.analysis,d=detentDimensions(q);
  assert.ok(Math.abs(d.e-1.6)<1e-7);
  assert.equal(q.motion.status,'clear');
  assert.equal(q.motion.latch.actualReceiver.status,'clear');
  assert.ok(q.motion.latch.actualReceiver.mountainRetention>=.8);
  assert.ok(q.motion.checks.some(check=>check.deflection>0),'the spring arm must flex while opening');
  for(const part of result.parts){
   const check=new (R.getOC().BRepCheck_Analyzer)(part.wrapped,true,false),solids=part.solids;
   try{assert.equal(check.IsValid(),true);assert.equal(solids.length,1);assert.ok(R.measureVolume(part)>0);}finally{check.delete();solids.forEach(s=>s.delete());}
  }
  console.log(JSON.stringify({hand,stopFaceSetback,wall:q.wall,tooth:d.e,pitch:q.pitch,receiverBacking:d.receiverBacking,reliefBacking:d.reliefBacking,retention:q.motion.latch.actualReceiver.mountainRetention}));
 }finally{base.delete();result?.parts.forEach(part=>part.delete());}
}
console.log('PASS full 1.6 mm mountain/groove on both hands of the supplied 40 mm square');