import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeCoilJoint,coilJointInfo,resolveCoilJoint} from '../src/coil-joint.js';
import {validateCoilPreset} from '../src/coil-presets.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base=R.makeBox([-25,-25,0],[25,25,80]);
const old={wire:2,pitch:4,turns:2,wall:2.9,jointGap:.4,jointSeam:0,jointSplit:60,hand:'右ねじ',autoAdjust:true,alignStop:false,closeAngle:2,jointPose:'閉じた状態',rimSeat:true,jointLatch:true,latchGap:.15,latchEngagement:1,latchFirm:true,latchExtraFirm:true};
const current={...old,closeAngle:0,closeAngleZero:2},info=coilJointInfo(base),resolve=p=>resolveCoilJoint(info,p);
assert.equal(resolve(old).closeAngle,2);assert.equal(resolve(old).closeAngleZero,0);
assert.equal(resolve({...old,closeAngle:0}).closeAngle,0);
const q=resolve(current);assert.equal(q.closeAngle,2);assert.equal(q.closeAngleAdjustment,0);assert.equal(q.closeAngleZero,2);
assert.equal(resolve(JSON.parse(JSON.stringify(current))).closeAngle,2);
assert.equal(resolve({...current,closeAngle:-2}).closeAngle,0);
assert.equal(resolve({...current,hand:'左ねじ',closeAngleZero:-2}).closeAngle,-2);
assert.equal(resolve({...current,closeAngle:10}).closeAngle,12);
assert.equal(resolve({...current,jointLatch:false,closeAngle:180}).closeAngle,182);
assert.throws(()=>resolve({...current,closeAngleZero:3}),/角度補正/);
assert.throws(()=>resolve({...current,closeAngle:10.1}),/角度補正/);
assert.equal(validateCoilPreset(old).closeAngleZero,0);
assert.equal(validateCoilPreset(current).closeAngleZero,2);
assert.equal(validateCoilPreset({...current,closeAngleZero:-2}).closeAngleZero,-2);
assert.throws(()=>validateCoilPreset({...current,closeAngleZero:1}),/基準/);
const expected=makeCoilJoint(base,old,null,{preview:true}),actual=makeCoilJoint(base,current,null,{preview:true});
try{
 for(let i=0;i<2;i++)for(const [a,b] of [[expected.parts[i],actual.parts[i]],[actual.parts[i],expected.parts[i]]]){
  const cut=a.cut(b);try{assert.ok(Math.abs(R.measureVolume(cut))<1e-6,'new zero preserves exact reinforced body/lid geometry');}finally{cut.delete();}
 }
 assert.equal(actual.analysis.closeAngle,2);assert.equal(actual.analysis.closeAngleAdjustment,0);assert.equal(actual.analysis.closeAngleZero,2);
 console.log('PASS new zero equals previous +2 degree reinforced body/lid geometry, saved baseline roundtrip, legacy baseline, mirrored hand and relative limits');
}finally{expected.parts.forEach(s=>s.delete());actual.parts.forEach(s=>s.delete());base.delete();}
