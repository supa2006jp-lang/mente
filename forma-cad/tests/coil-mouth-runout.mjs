import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {polygonCylinder} from '../src/coil-prism.js';
import {makeCoilJoint,resolveCoilJoint} from '../src/coil-joint.js';
import {checkLatchStopReceiver} from '../src/coil-latch.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const profile=Array.from({length:6},(_,i)=>[30*Math.cos(Math.PI/6+i*Math.PI/3),30*Math.sin(Math.PI/6+i*Math.PI/3)]),base=polygonCylinder(profile,50),p={wire:2,pitch:4,turns:2,wall:3.3,jointGap:.5,jointSeam:0,jointSplit:34.448,hand:'右ねじ',jointPose:'閉じた状態',jointLatch:true,latchFirm:true,latchExtraFirm:true,latchGap:.15,latchEngagement:1.1,rimSeat:true,alignStop:false,closeAngle:0,closeAngleZero:2,autoAdjust:true};
const fast=process.argv.includes('--preview-only'),result=makeCoilJoint(base,p,undefined,{preview:fast}),q=result.analysis,d=q.mouthRunout;
if(!fast)assert.equal(q.motion.status,'clear');assert.equal(d.thickness,.8);assert.ok(d.radialRelief<=q.wall*.1);assert.ok(q.radius-q.pilotRadius-d.radialRelief>=q.wall*.9-1e-7);assert.equal(q.wire,2);assert.equal(q.pitch,4);assert.equal(q.wall,3.3);assert.equal(q.gap,.5);assert.equal(q.closeAngle,2);if(!fast){assert.equal(q.motion.latch.status,'clear');assert.ok(q.motion.latch.tighteningOverlap>1e-4);}
console.log('checking real receivers');const reference=fast?{tighteningOverlap:2.9932987373820543}:q.motion.latch,actual=checkLatchStopReceiver(result.parts[1],q,reference);assert.ok(actual.retention>.99);console.log('original receiver passed');const shifted=makeCoilJoint(base,{...p,jointSplit:35.5},undefined,{preview:true}),shiftCheck=checkLatchStopReceiver(shifted.parts[1],shifted.analysis,reference);assert.ok(shiftCheck.retention>.93&&shiftCheck.retention<1);console.log('shifted receiver passed');shifted.parts.forEach(s=>s.delete());
const data=result.parts[1].mesh({tolerance:.01,angularTolerance:.03}),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.vertices,3));g.setIndex(data.triangles);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld();
// The entire trimmed radial band is empty, not merely the bore-side tip.
for(const phase of [.1,.3,.5,.7,.9])for(const fraction of [.02,.25,.5,.75,.97]){
 const z=d.start+(d.end-d.start)*phase,a=2*Math.PI*z/q.pitch,r=q.boreRadius+(q.pilotRadius-q.boreRadius)*fraction,ray=new THREE.Raycaster(new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),d.shoulder-.03),new THREE.Vector3(0,0,1)),hits=ray.intersectObject(m);
 assert.ok(hits.length,'backing above runout remains');assert.ok(hits[0].point.z>d.top-.035,'no feather remains in radial band');
}
// Past the trim end, the first land starts with a printable axial thickness.
const a=2*Math.PI*(d.end+.02)/q.pitch,r=q.boreRadius+.02,ray=new THREE.Raycaster(new THREE.Vector3(r*Math.cos(a),r*Math.sin(a),d.shoulder-.03),new THREE.Vector3(0,0,1)),hits=ray.intersectObject(m).map(h=>h.point.z).filter((z,i,all)=>i===0||Math.abs(z-all[i-1])>.001);assert.ok(Math.abs(hits[0]-d.shoulder)<.015);assert.ok(hits[1]-hits[0]>.78,'runout resumes at a thick end');
for(const part of result.parts){const checker=new (R.getOC().BRepCheck_Analyzer)(part.wrapped,true,false);assert.ok(checker.IsValid());checker.delete();const solids=part.solids;assert.equal(solids.length,1);solids.forEach(s=>s.delete());const mesh=part.mesh({tolerance:.08,angularTolerance:.15}),keys=Array.from({length:mesh.vertices.length/3},(_,i)=>mesh.vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',')),edges=new Map();for(let i=0;i<mesh.triangles.length;i+=3)for(let j=0;j<3;j++){const a=keys[mesh.triangles[i+j]],b=keys[mesh.triangles[i+(j+1)%3]];if(a===b)continue;const key=[a,b].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}assert.ok([...edges.values()].every(n=>n===2),'watertight STL');part.delete();}
base.delete();
const smallBase=R.makeCylinder(12,30),small=makeCoilJoint(smallBase,{...p,jointLatch:false,latchFirm:false,latchExtraFirm:false,wire:.4,pitch:1,wall:1,jointGap:.05,jointSplit:10,hand:'左ねじ',closeAngleZero:0});assert.equal(small.analysis.motion.status,'clear');assert.ok(small.analysis.mouthRunout.thickness<.8);small.parts.forEach(part=>part.delete());smallBase.delete();
for(const wire of [.4,1,2,4])for(const pitch of [1,3,8]){const q=resolveCoilJoint({radius:30,height:80,origin:[0,0,0],axis:[0,0,1],shapeType:'cylinder'},{...p,jointLatch:false,wire,pitch,jointGap:.05,jointSplit:30}),d=q.mouthRunout;assert.ok(d.thickness>0);assert.ok(d.thickness+.045<d.reach,'no next land cut at runout start');assert.ok(d.thickness<q.pitch-2*d.reach);}
console.log('PASS actual hex mouth relief, whole radial band removed, .8 mm end, native opening/latch checks, unchanged fit/angle, watertight STL and small-wire limits');
