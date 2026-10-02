import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {polygonCylinder} from '../src/coil-prism.js';
import {makeCoilJoint,makeCoilTestPiece} from '../src/coil-joint.js';
import {latchDimensions} from '../src/coil-latch.js';
import {coilOverlapVolume} from '../src/coil-collision.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
// Exact geometry and settings from the user's design.forma(28).json.
const profile=[[1.83697019872103e-15,-30],[25.980762113533157,-15],[25.98076211353316,14.999999999999995],[1.83697019872103e-15,30],[-25.980762113533153,15.00000000000001],[-25.980762113533157,-15.000000000000004]];
const p={wire:2,pitch:4,turns:2,wall:3.3,jointGap:.5,jointSeam:0,jointSplit:34.448,hand:'右ねじ',jointPose:'分けて並べる',jointAxis:'自動',jointLatch:true,latchFirm:true,latchExtraFirm:true,latchGap:.15,latchEngagement:1.1,rimSeat:true,alignStop:false,closeAngle:0,closeAngleZero:2,autoAdjust:true};
const near=(a,b,tolerance=1e-6)=>assert.ok(Math.abs(a-b)<tolerance,a+' != '+b);
function local(shape,q){const z=new THREE.Vector3(0,0,1),n=new THREE.Vector3(...q.axis).normalize(),axis=z.clone().cross(n);if(axis.lengthSq()<1e-12)axis.set(1,0,0);axis.normalize();return shape.clone().translate(q.origin.map(v=>-v)).rotate(-z.angleTo(n)*180/Math.PI,[0,0,0],axis.toArray());}
function crop(shape,q,low,high){const r=(q.outerRadius||q.radius)+1,box=R.makeBox([-r,-r,low],[r,r,high]);try{return shape.intersect(box);}finally{box.delete();}}
function watertight(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}const solids=shape.solids;try{assert.equal(solids.length,1);}finally{solids.forEach(s=>s.delete());}const mesh=shape.mesh({tolerance:.08,angularTolerance:.15}),keys=Array.from({length:mesh.vertices.length/3},(_,i)=>mesh.vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',')),edges=new Map();for(let i=0;i<mesh.triangles.length;i+=3)for(let j=0;j<3;j++){const a=keys[mesh.triangles[i+j]],b=keys[mesh.triangles[i+(j+1)%3]];if(a===b)continue;const key=[a,b].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}assert.ok([...edges.values()].every(n=>n===2),'watertight printable STL');}
function sameFunctionalShape(a,b,q,low,high){const original=crop(a,q,low,high),test=crop(b,q,low,high);try{const va=R.measureVolume(original),vb=R.measureVolume(test),common=coilOverlapVolume(original,test);near(va,vb,.001);near(va,common,.001);}finally{original.delete();test.delete();}}
function inspect(base,options={}){
 const original=makeCoilJoint(base,{...p,jointPose:'閉じた状態'},undefined,options),result=makeCoilTestPiece(base,{...p,jointPose:'1回転開く',flipLidToGrid:true},undefined,options),q=result.analysis,t=q.testPiece,d=latchDimensions(q);
 try{
  assert.equal(q.motion.status,options.preview?'pending':'clear');assert.equal(q.closeAngle,2);assert.equal(q.split,34.448);assert.equal(q.latchEngagement,1.1);assert.equal(q.latchExtraFirm,true);
  near(t.bodyLow,q.split-q.minimumSplit);near(t.bodyHeight,q.minimumSplit+q.neckLength);near(t.lidHeight,q.minimumLidHeight);assert.ok(t.savedPercent>5);assert.ok(t.testVolume<t.originalVolume);near(t.savedPercent,100*(1-t.testVolume/t.originalVolume));
  const boxes=result.parts.map(part=>part.boundingBox);try{const [bl,bh]=boxes[0].bounds,[ll,lh]=boxes[1].bounds;near(bl[2],0);near(ll[2],0);near(ll[0]-bh[0],5);near((bl[1]+bh[1])/2,(ll[1]+lh[1])/2);}finally{boxes.forEach(b=>b.delete());}
  const body=result.parts[0].clone().translate(t.bodyTranslation.map(v=>-v)),lid=result.parts[1].clone().translate(t.lidTranslation.map(v=>-v)).rotate(180,[0,0,0],[1,0,0]),originalLocal=original.parts.map(part=>local(part,q));
  try{
   // Native equality throughout the claw, stop, complete helix and runout zone
   // catches accidental thread rephasing when shortening or changing source axis.
   sameFunctionalShape(originalLocal[0],body,q,q.split-d.length-.1,q.split+q.neckLength+.1);
   sameFunctionalShape(originalLocal[1],lid,q,q.split+q.seam,q.split+q.neckLength+q.extension+.15);
  }finally{body.delete();lid.delete();originalLocal.forEach(s=>s.delete());}
  result.parts.forEach(watertight);
  console.log(JSON.stringify({axis:q.axis,bodyHeight:t.bodyHeight,lidHeight:t.lidHeight,savedPercent:t.savedPercent,phase:'native-equal'}));
 }finally{original.parts.forEach(s=>s.delete());result.parts.forEach(s=>s.delete());}
}
const base=polygonCylinder(profile,50);try{inspect(base,{preview:process.argv.includes('--phase-only')});const tall=polygonCylinder(profile,100),rotated=tall.clone().rotate(35,[0,0,0],[1,1,0]).translate([17,-8,31]);try{const n=new THREE.Vector3(0,0,1).applyAxisAngle(new THREE.Vector3(1,1,0).normalize(),35*Math.PI/180);inspect(rotated,{preferredAxis:n.toArray(),preview:true});}finally{rotated.delete();tall.delete();}}finally{base.delete();}
// An already-short pair needs no replacement floor/cap or additional material.
const shortBase=polygonCylinder(profile,35.8),shortSpec={...p,jointSplit:16.3,jointPose:'閉じた状態'},shortOriginal=makeCoilJoint(shortBase,shortSpec,undefined,{preview:true}),shortTest=makeCoilTestPiece(shortBase,shortSpec,undefined,{preview:true});try{near(shortTest.analysis.testPiece.bodyLow,0);near(shortTest.analysis.testPiece.lidTop,shortTest.analysis.height);near(shortTest.analysis.testPiece.originalVolume,shortTest.analysis.testPiece.testVolume,.001);near(shortTest.analysis.testPiece.savedPercent,0,.001);}finally{shortOriginal.parts.forEach(s=>s.delete());shortTest.parts.forEach(s=>s.delete());shortBase.delete();}
console.log('PASS native design28 and rotated source, original joint phase/claw/stop/runout retained, smaller volume, XY-separated solid watertight STL');
