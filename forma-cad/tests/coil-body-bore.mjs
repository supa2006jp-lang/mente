import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {polygonCylinder} from '../src/coil-prism.js';
import {makeCoilJoint,resolveCoilJoint} from '../src/coil-joint.js';
import {detentDimensions} from '../src/coil-detent.js';
import {validateCoilPreset} from '../src/coil-presets.js';

const profile=[[0,-20],[17.32050807568877,-10],[17.320508075688775,10],[0,20],[-17.32050807568877,10],[-17.32050807568877,-10]];
const info={radius:17.32050807568877,outerRadius:20,height:40,origin:[0,0,0],axis:[0,0,1],profile,shapeType:'polygon'};
const spec={wire:2,pitch:4,turns:2,wall:4.1,bodyBoreWall:1.5,jointGap:.4,jointSeam:0,jointSplit:0,hand:'右ねじ',jointPose:'分けて並べる',jointLatch:true,latchStyle:'ridge',latchFirm:true,latchExtraFirm:true,latchGap:.05,latchEngagement:1.6,rimSeat:true,alignStop:false,closeAngle:0,closeAngleZero:2,autoAdjust:true,autoFillet:false};
const legacy=resolveCoilJoint(info,{...spec,bodyBoreWall:undefined});
const oldExplicit=resolveCoilJoint(info,{...spec,bodyBoreWall:0});
const q=resolveCoilJoint(info,spec);
assert.equal(legacy.innerRadius,legacy.maleRadius-legacy.wall);
assert.equal(oldExplicit.innerRadius,legacy.innerRadius);
assert.equal(q.maleRadius,legacy.maleRadius);
assert.equal(q.boreRadius,legacy.boreRadius);
assert.equal(q.wall,legacy.wall);
assert.equal(q.latchEngagement,legacy.latchEngagement);
assert.equal(q.bodyBoreWall,1.5);
assert.ok(Math.abs(q.innerRadius-(q.maleRadius-1.5))<1e-9);
assert.ok(q.innerRadius>legacy.innerRadius+2.5);
const detent=detentDimensions(q);
assert.ok(detent.reliefBacking>=1.5-1e-6,'mountain relief must leave a printable 1.5 mm exterior wall');
assert.ok(detent.reliefStart>detent.rootAngle,'relief stays under the tooth instead of reaching the arm root');
assert.throws(()=>resolveCoilJoint(info,{...spec,bodyBoreWall:.4}),/0.6 mm以上/);
const preset=validateCoilPreset({...spec,autoAdjust:true});
assert.equal(preset.bodyBoreWall,1.5);
assert.equal(validateCoilPreset({...spec,bodyBoreWall:undefined,autoAdjust:true}).bodyBoreWall,0);

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base=polygonCylinder(profile,40);
let result;
try {
 result=makeCoilJoint(base,spec);
 assert.equal(result.analysis.motion.status,'clear');
 assert.equal(result.analysis.motion.latch.status,'clear');
 assert.equal(result.analysis.bodyBoreWall,1.5);
 assert.ok(Math.abs(result.analysis.innerRadius-q.innerRadius)<1e-9);
 for(const part of result.parts){
  const check=new (R.getOC().BRepCheck_Analyzer)(part.wrapped,true,false),solids=part.solids;
  try { assert.equal(check.IsValid(),true); assert.equal(solids.length,1); }
  finally { check.delete();solids.forEach(s=>s.delete()); }
 }
 console.log(JSON.stringify({wall:q.wall,bodyBoreWall:q.bodyBoreWall,boreDiameter:2*q.innerRadius,oldBoreDiameter:2*legacy.innerRadius,latchEngagement:q.latchEngagement}));
 console.log('PASS independent body bore wall and exact hexagonal joint');
} finally {
 result?.parts.forEach(part=>part.delete());
 base.delete();
}
