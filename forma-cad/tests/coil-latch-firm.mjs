import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {resolveCoilJoint,screwLidPose} from '../src/coil-joint.js';
import {latchDimensions,latchShapes,attachLatch,checkLatch,latchReleaseMotion} from '../src/coil-latch.js';
import {polygonCylinder} from '../src/coil-prism.js';
import {arcBacking} from '../src/latch-pocket-phase.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const profile=[[-17.32050807568877,-10.000000000000002],[0,-20],[17.32050807568877,-10.000000000000002],[17.320508075688775,9.999999999999995],[0,20],[-17.32050807568877,10.000000000000005]];
const info={radius:17.32050807568877,outerRadius:20,height:50,origin:[0,0,0],axis:[0,0,1],shapeType:'cylinder'};
const hex={...info,profile,shapeType:'polygon'};
const p={wire:2,pitch:4,turns:2,wall:2.9,jointGap:.4,jointSeam:0,jointSplit:30,hand:'右ねじ',autoAdjust:true,alignStop:false,closeAngle:0,rimSeat:true,jointLatch:true,latchFirm:true,latchGap:.2,latchEngagement:.9};
assert.throws(()=>resolveCoilJoint(info,{...p,latchFirm:'true'}),/爪の強さ/);
assert.equal(resolveCoilJoint(info,{...p,latchFirm:undefined}).latchFirm,false);
const standard=resolveCoilJoint(info,{...p,jointLatch:false,latchFirm:false});
for(const shapeInfo of [hex,info]){
 const q=resolveCoilJoint(shapeInfo,p),d=latchDimensions(q);
 for(const field of ['wall','maleRadius','innerRadius','pilotRadius','boreRadius','pitch','wire','threadLength','neckLength'])assert.equal(q[field],standard[field],'existing cavity and thread retained: '+field);
 assert.equal(q.requestedLatchEngagement,.9);assert.equal(q.latchFirm,true);assert.equal(q.latchVersion,'internal-v1');assert.ok(d.receiverBacking>=1.2-1e-8);assert.ok(q.radius-d.stopOuter-d.c>=1.2-1e-8);
 if(shapeInfo.profile){assert.equal(q.latchEngagement,.9);assert.equal(d.length,13);assert.equal(d.beamWidth,6);assert.ok(Math.abs(d.phase-.11519173063162569)<.002);assert.ok(d.receiverBacking>2);}
 else {assert.ok(Math.abs(q.latchEngagement-.605)<1e-8);assert.equal(d.length,12);assert.equal(d.beamWidth,7);assert.equal(d.phase,0);assert.ok(q.notes.some(n=>n.includes('爪の掛かり量')));assert.throws(()=>resolveCoilJoint(shapeInfo,{...p,autoAdjust:false}),/掛かり量/);}
}
// An almost circular rotated convex polygon has no corner deep enough for .9.
// It must choose the same conservative reach as a cylinder rather than perforate.
const n=32,rotation=.37,vertex=info.radius/Math.cos(Math.PI/n),roundProfile=Array.from({length:n},(_,i)=>{const a=rotation+2*Math.PI*i/n;return [vertex*Math.cos(a),vertex*Math.sin(a)];});
for(const hand of ['右ねじ','左ねじ']){
 const q=resolveCoilJoint({...hex,profile:roundProfile,outerRadius:vertex},{...p,hand}),d=latchDimensions(q);
 assert.ok(q.latchEngagement<.9);assert.ok(Math.abs(q.latchEngagement-.605)<1e-8);assert.equal(d.length,12);assert.equal(d.beamWidth,7);assert.ok(d.receiverBacking>=1.2-1e-8);
 const a=d.phase+d.toothA-d.c/d.inner,b=d.phase+d.toothB+d.c/d.inner;
 const backing=arcBacking(roundProfile,d.toothOuter+d.c,q.leftHand?-b:a,q.leftHand?-a:b,d.inner-d.c);
 assert.ok(Math.abs(backing-d.receiverBacking)<1e-8);
}
const volume=shape=>Math.abs(R.measureVolume(shape));
const overlap=(a,b)=>{const hit=a.intersect(b);try{return volume(hit);}finally{hit.delete();}};
function validSingle(shape){const solids=shape.solids,check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.equal(solids.length,1);assert.equal(check.IsValid(),true);assert.ok(volume(shape)>0);}finally{check.delete();solids.forEach(s=>s.delete());}}
function watertight(shape){const m=shape.mesh({tolerance:.05,angularTolerance:.15}),keys=Array.from({length:m.vertices.length/3},(_,i)=>m.vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',')),edges=new Map();for(let i=0;i<m.triangles.length;i+=3)for(let j=0;j<3;j++){const a=keys[m.triangles[i+j]],b=keys[m.triangles[i+(j+1)%3]];if(a===b)continue;const k=[a,b].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}assert.equal([...edges.values()].filter(n=>n===1).length,0,'open mesh edges');assert.equal([...edges.values()].filter(n=>n>2).length,0,'nonmanifold mesh edges');}
function bounds(shape){const box=shape.boundingBox;try{return box.bounds.map(p=>p.slice());}finally{box.delete();}}
const stopOnly=process.argv.includes('--stop-only');
for(const shapeInfo of (stopOnly?[hex]:[hex,info]))for(const hand of ['右ねじ','左ねじ']){
 const q=resolveCoilJoint(shapeInfo,{...p,hand}),d=latchDimensions(q),check=checkLatch(q);
 assert.equal(check.status,'clear');assert.ok(check.openingOverlap>1e-4);assert.ok(check.tighteningOverlap>1e-6);assert.equal(check.checks[0].deflection,0);assert.ok(check.checks.some(c=>c.deflection>0));assert.ok(check.checks.every(c=>c.deflection>=0&&c.deflection<=d.release+1e-7&&c.releasedOverlap<1e-6));assert.ok(d.receiverBacking>=1.2-1e-8);
 const outer=(height,z=0)=>q.profile?polygonCylinder(q.profile,height,z):R.makeCylinder(q.radius,height,[0,0,z]);
 let body=outer(q.split).cut(R.makeCylinder(q.innerRadius,q.split+.2,[0,0,q.wall]));const neck=R.makeCylinder(q.maleRadius,q.neckLength+.05,[0,0,q.split-.05]).cut(R.makeCylinder(q.innerRadius,q.neckLength+.2,[0,0,q.split-.1]));const joined=body.fuse(neck);body.delete();neck.delete();body=joined;
 let lid=outer(q.height-q.split,q.split).cut(R.makeCylinder(q.boreRadius,q.height-q.split-q.wall+.1,[0,0,q.split-.1]));const pilot=R.makeCylinder(q.pilotRadius,q.pilot+.02,[0,0,q.split-.01]);const bored=lid.cut(pilot);lid.delete();pilot.delete();lid=bored;
 let added,motion;try{
  added=attachLatch(body,lid,q);validSingle(added.body);validSingle(added.lid);watertight(added.body);watertight(added.lid);assert.deepEqual(bounds(added.body),bounds(body),'body outline unchanged');assert.deepEqual(bounds(added.lid),bounds(lid),'lid outline unchanged');assert.ok(overlap(added.body,added.lid)<1e-5);
  const pure=added.lid.clone().rotate((q.leftHand?1:-1)*2,[0,0,0],[0,0,1]);try{assert.ok(overlap(added.body,pure)>1e-6);}finally{pure.delete();}
  // Compare the added half millimeter of bearing area with an otherwise
  // identical stop cropped to the previous .7 mm upper contact band.
  assert.ok(Math.abs(d.stopHeight-d.h-d.c-1.2)<1e-8);
  const features=latchShapes(q),clip=R.makeCylinder(q.outerRadius+2,d.stopHeight-.5+.1,[0,0,q.split-.1]);let oldStop;
  try{
   oldStop=features.stop.intersect(clip);const onset=[];
   for(const degrees of [0,-.1,-1,-5]){
    const moved=added.lid.clone().rotate(d.hand*degrees,[0,0,0],[0,0,1]);
    try{const total=overlap(added.body,moved),current=overlap(features.stop,moved),previous=overlap(oldStop,moved);onset.push({degrees,total,current,previous});if(degrees===0){assert.ok(total<1e-5);assert.ok(current<1e-6);}else{assert.ok(total>1e-4,'immediate closing stop onset');assert.ok(current>previous*1.5,'larger bearing band improves contact volume');}}
    finally{moved.delete();}
   }
   assert.ok(onset[1].total<onset[2].total&&onset[2].total<onset[3].total);
   console.log('STOP '+hand+' '+JSON.stringify(onset));
  }finally{oldStop?.delete();clip.delete();for(const k of ['arm','stop','channel','pocket','stopPocket'])features[k].delete();features.cuts.forEach(s=>s.delete());}
  motion=latchReleaseMotion(added.body,q);for(const cam of check.checks){const released=motion.at(cam.deflection),moved=screwLidPose(added.lid,q,cam.turns);try{assert.ok(overlap(released,moved)<.001,'pose dependent full surrogate cam clearance: '+hand+' '+cam.turns);}finally{released.delete();moved.delete();}}
  for(const turns of [.5,.6,.73,.75,1]){const moved=screwLidPose(added.lid,q,turns);try{assert.ok(overlap(added.body,moved)<.001,'broad stop opening '+turns);}finally{moved.delete();}}
 }finally{motion?.delete();added?.body.delete();added?.lid.delete();body.delete();lid.delete();}
 console.log('PASS firm '+(q.profile?'hexagon':'cylinder')+' '+hand+' reach '+q.latchEngagement.toFixed(3)+' backing '+d.receiverBacking.toFixed(3)+' phase '+(d.phase*180/Math.PI).toFixed(1));
}
console.log('PASS firmness validation, unchanged cavity/thread/outline, polygon corner placement, cylinder and near round conservative cap, thick stop backing, both hands, watertight single solids, pose dependent cam release');
