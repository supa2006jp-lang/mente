import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {resolveCoilJoint,screwLidPose} from '../src/coil-joint.js';
import {latchDimensions,latchShapes,attachLatch,checkLatch,latchReleaseMotion} from '../src/coil-latch.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const info={radius:17.3205080757,outerRadius:20,height:50,origin:[0,0,0],axis:[0,0,1],shapeType:'cylinder'};
const p={wire:2,pitch:4,turns:2,wall:2.9,jointGap:.4,jointSeam:.15,jointSplit:30,hand:'右ねじ',autoAdjust:true,alignStop:true,closeAngle:10,jointPose:'閉じた状態',rimSeat:true,jointLatch:true,latchGap:.3,latchEngagement:.8};
const q=resolveCoilJoint(info,p),plain=resolveCoilJoint(info,{...p,jointLatch:false,alignStop:false,closeAngle:0,jointSeam:0});
assert.equal(q.latchVersion,'internal-v1');assert.equal(q.rimSeat,true);assert.equal(q.alignStop,false);assert.equal(q.stop,null);assert.equal(q.closeAngle,10);assert.equal(q.seam,0);assert.equal(q.requestedLatchEngagement,.8);assert.equal(q.latchEngagement,.8);
for(const field of ['wall','maleRadius','innerRadius','pilotRadius','boreRadius','pitch','wire','threadLength','neckLength'])assert.equal(q[field],plain[field],'internal thread fit retained: '+field);
assert.equal(q.split,30);assert.equal(q.height,50);
assert.equal(resolveCoilJoint(info,{...p,jointLatch:false}).closeAngle,10);
assert.equal(resolveCoilJoint(info,{...p,jointLatch:undefined}).jointLatch,false);
assert.equal(resolveCoilJoint(info,{...p,latchVersion:'external-v1'}).latchVersion,'internal-v1');
assert.throws(()=>resolveCoilJoint(info,{...p,jointLatch:'true'}),/爪の設定/);
assert.throws(()=>resolveCoilJoint(info,{...p,latchGap:.049}),/爪のすき間/);
assert.throws(()=>resolveCoilJoint(info,{...p,latchGap:1.01}),/爪のすき間/);
assert.throws(()=>resolveCoilJoint(info,{...p,latchEngagement:.39}),/掛かり量/);
assert.throws(()=>resolveCoilJoint(info,{...p,latchEngagement:1.61}),/掛かり量/);
assert.throws(()=>resolveCoilJoint({...info,radius:9.9},p),/半径10/);
assert.throws(()=>resolveCoilJoint(info,{...p,pitch:3.2,autoAdjust:false}),/ピッチ/);
assert.throws(()=>resolveCoilJoint(info,{...p,jointSplit:15,autoAdjust:false}),/分割位置/);
assert.throws(()=>resolveCoilJoint(info,{...p,latchEngagement:1.6,autoAdjust:false}),/掛かり量/);
assert.throws(()=>resolveCoilJoint(info,{...p,latchGap:1,autoAdjust:false}),/筒の厚さ/);
const capped=resolveCoilJoint(info,{...p,latchEngagement:1.6});assert.equal(capped.requestedLatchEngagement,1.6);assert.ok(capped.latchEngagement<1.6);assert.ok(capped.notes.some(s=>s.includes('爪の掛かり量')));assert.equal(capped.wall,q.wall);
const adjusted=resolveCoilJoint(info,{...p,latchGap:1,latchEngagement:.4});assert.ok(adjusted.wall>q.wall);assert.ok(adjusted.notes.some(s=>s.includes('筒の厚さ')));assert.ok(adjusted.latchEngagement>=.4-1e-8);
const smallInfo={...info,radius:10,outerRadius:10,height:35},smallP={...p,wire:1,pitch:3.3,turns:1,wall:1.8,jointGap:.2,jointSplit:10};
const small=resolveCoilJoint(smallInfo,smallP);assert.ok(small.split>=small.wall+14+.5-1e-8);assert.ok(small.height-small.split>=latchDimensions(small).requiredLidHeight-1e-8);
const volume=shape=>Math.abs(R.measureVolume(shape));
const overlap=(a,b)=>{const hit=a.intersect(b);try{return volume(hit);}finally{hit.delete();}};
function validSingle(shape){const solids=shape.solids,check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.equal(solids.length,1);assert.equal(check.IsValid(),true);assert.ok(volume(shape)>0);}finally{check.delete();solids.forEach(s=>s.delete());}}
function watertight(shape){const m=shape.mesh({tolerance:.05,angularTolerance:.15}),keys=Array.from({length:m.vertices.length/3},(_,i)=>m.vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',')),edges=new Map();for(let i=0;i<m.triangles.length;i+=3)for(let j=0;j<3;j++){const a=keys[m.triangles[i+j]],b=keys[m.triangles[i+(j+1)%3]];if(a===b)continue;const k=[a,b].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}assert.equal([...edges.values()].filter(n=>n===1).length,0,'open mesh edges');assert.equal([...edges.values()].filter(n=>n>2).length,0,'nonmanifold mesh edges');}
function bounds(shape){const box=shape.boundingBox;try{return box.bounds.map(p=>p.slice());}finally{box.delete();}}
for(const scenario of [{info,p},{info,p:{...p,latchGap:1,latchEngagement:1.6}},{info,p:{...p,latchGap:.05,latchEngagement:.4}},{info:smallInfo,p:smallP}])for(const hand of ['右ねじ','左ねじ']){
 const resolved=resolveCoilJoint(scenario.info,{...scenario.p,hand}),d=latchDimensions(resolved),check=checkLatch(resolved);assert.equal(check.status,'clear');assert.ok(check.openingOverlap>1e-4);assert.ok(check.tighteningOverlap>1e-6);assert.ok(check.checks.every(c=>Number.isFinite(c.deflection)&&c.deflection>=0&&c.deflection<=d.release+1e-7&&c.releasedOverlap<1e-6));assert.equal(check.checks[0].deflection,0);assert.ok(check.checks.some(c=>c.deflection>0));assert.equal(check.checks.find(c=>Math.abs(c.turns-d.h/resolved.pitch)<1e-8).deflection,0);assert.ok(resolved.radius-(d.toothOuter+d.c)>=.6-1e-7);assert.ok(d.inner-d.release>=resolved.maleRadius+.1-1e-7);
 const shapes=latchShapes(resolved);try{const armBox=bounds(shapes.arm);assert.ok(armBox[0][2]>=resolved.wall+.5-1e-7,'root above solid bottom');for(const s of [...shapes.cuts,shapes.arm,shapes.stop]){const b=bounds(s);assert.ok(Math.max(...b[0].slice(0,2).map(Math.abs),...b[1].slice(0,2).map(Math.abs))<=resolved.radius+1e-7,'no outside hardware');}}finally{for(const k of ['arm','stop','channel','pocket','stopPocket'])shapes[k].delete();shapes.cuts.forEach(s=>s.delete());}
 // Smooth shoulder/neck surrogates isolate the hidden claw and its cam from
 // costly helical sweeps. The supplied-model test verifies the full kernel.
 let body=R.makeCylinder(resolved.radius,resolved.split).cut(R.makeCylinder(resolved.innerRadius,resolved.split+.2,[0,0,resolved.wall]));const neck=R.makeCylinder(resolved.maleRadius,resolved.neckLength+.05,[0,0,resolved.split-.05]).cut(R.makeCylinder(resolved.innerRadius,resolved.neckLength+.2,[0,0,resolved.split-.1]));const joined=body.fuse(neck);body.delete();neck.delete();body=joined;
 let lid=R.makeCylinder(resolved.radius,resolved.height-resolved.split,[0,0,resolved.split]).cut(R.makeCylinder(resolved.boreRadius,resolved.height-resolved.split-resolved.wall+.1,[0,0,resolved.split-.1]));const pilot=R.makeCylinder(resolved.pilotRadius,resolved.pilot+.02,[0,0,resolved.split-.01]);const bored=lid.cut(pilot);lid.delete();pilot.delete();lid=bored;
 let added,motion;
 try{
  added=attachLatch(body,lid,resolved);validSingle(added.body);validSingle(added.lid);watertight(added.body);watertight(added.lid);assert.deepEqual(bounds(added.body),bounds(body),'body original envelope retained');assert.deepEqual(bounds(added.lid),bounds(lid),'lid original envelope retained');assert.ok(overlap(added.body,added.lid)<1e-5);
  const pure=added.lid.clone().rotate((resolved.leftHand?1:-1)*2,[0,0,0],[0,0,1]);try{assert.ok(overlap(added.body,pure)>1e-6);}finally{pure.delete();}
  motion=latchReleaseMotion(added.body,resolved);
  for(const cam of check.checks){const released=motion.at(cam.deflection),moved=screwLidPose(added.lid,resolved,cam.turns);try{assert.ok(overlap(released,moved)<.001,'pose dependent cam release collision '+cam.turns);}finally{released.delete();moved.delete();}}
  for(const turns of [.5,1]){const moved=screwLidPose(added.lid,resolved,turns);try{assert.ok(overlap(added.body,moved)<.001,'stop pocket opening '+turns);}finally{moved.delete();}}
 }finally{motion?.delete();added?.body.delete();added?.lid.delete();body.delete();lid.delete();}
}
console.log('PASS internal version/legacy guards, preserved nominal thread fit and outline, wall adjustment and reach cap, hidden rooted beam, rigid lock and pose dependent cam release, both hands, watertight single-solid accessories');
