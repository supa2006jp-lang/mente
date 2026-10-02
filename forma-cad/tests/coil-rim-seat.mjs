import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeCoilJoint,resolveCoilJoint,screwLidPose} from '../src/coil-joint.js';
import {validateCoilPreset} from '../src/coil-presets.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const p={wire:1,pitch:4,turns:1,wall:1.2,jointGap:.2,jointSeam:.15,jointSplit:10,hand:'右ねじ',autoAdjust:true,alignStop:true,closeAngle:0,jointPose:'閉じた状態',rimSeat:true};
const info={radius:12,height:30,origin:[0,0,0],axis:[0,0,1],shapeType:'cylinder'};
const q=resolveCoilJoint(info,p);assert.equal(q.seam,0);assert.equal(q.alignStop,false);assert.equal(q.stop,null);assert.equal(q.wall,1.8);assert.ok(q.notes.some(s=>s.includes('0.00')));
assert.throws(()=>resolveCoilJoint(info,{...p,rimSeat:'true'}),/設定が不正/);
assert.throws(()=>resolveCoilJoint(info,{...p,autoAdjust:false}),/筒の厚さ/);
const legacy={...p};delete legacy.rimSeat;assert.equal(validateCoilPreset(legacy).rimSeat,false);
assert.equal(validateCoilPreset({...p,jointSeam:0}).rimSeat,true);
assert.throws(()=>validateCoilPreset({...legacy,jointSeam:0}),/合わせ目/);
assert.throws(()=>validateCoilPreset({...p,rimSeat:null}),/チェック設定/);
const base=R.makeCylinder(12,30),r=makeCoilJoint(base,p);
try{
 assert.equal(r.analysis.motion.status,'clear');assert.equal(r.analysis.motion.seating.status,'clear');assert.equal(r.analysis.motion.stop,undefined);
 assert.ok(r.analysis.motion.seating.tighteningOverlap>1e-5);
 assert.equal(r.analysis.motion.seating.contactDistance,0);
 for(const part of r.parts){const check=new (R.getOC().BRepCheck_Analyzer)(part.wrapped,true,false);assert.ok(check.IsValid());check.delete();}
 for(const turns of [0,.0001,.001,.01,.125]){const lid=screwLidPose(r.parts[1],r.analysis,turns);let overlap;try{overlap=r.parts[0].intersect(lid);assert.ok(Math.abs(R.measureVolume(overlap))<1e-5);}finally{overlap?.delete();lid.delete();}}
 console.log('PASS broad rim contact, closing arrest, short opening clearance, minimum wall, zero seam and legacy presets');
}finally{r.parts.forEach(s=>s.delete());base.delete();}
