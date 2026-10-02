import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeCoilJoint,screwLidPose} from '../src/coil-joint.js';
import {coilOverlapVolume} from '../src/coil-collision.js';
import {latchReleaseMotion} from '../src/coil-latch.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function legacy(a,b){const hit=a.intersect(b);try{return Math.abs(R.measureVolume(hit));}finally{hit.delete();}}
function parity(a,b,label){const start=performance.now(),old=legacy(a,b),oldMs=performance.now()-start,snapshot=[a.serialize(),b.serialize()],next=performance.now(),value=coilOverlapVolume(a,b),newMs=performance.now()-next;assert.ok(Math.abs(old-value)<Math.max(1e-6,Math.abs(old)*1e-6),label+': exact volume parity');assert.deepEqual([a.serialize(),b.serialize()],snapshot,label+': inputs unchanged');console.log(JSON.stringify({label,volume:value,oldMs:Math.round(oldMs),newMs:Math.round(newMs)}));return {oldMs,newMs,value};}
const a=R.makeBox([0,0,0],[10,10,10]),over=R.makeBox([5,5,5],[15,15,15]),touch=R.makeBox([10,0,0],[20,10,10]),inside=R.makeBox([2,2,2],[4,4,4]),away=R.makeBox([20,20,20],[30,30,30]);
for(const [label,b] of [['positive',over],['touching',touch],['containment',inside],['disjoint',away]])parity(a,b,label);
for(const volume of [.5e-7,2e-7,.0005,.002]){const size=Math.cbrt(volume),tiny=R.makeBox([1,1,1],[1+size,1+size,1+size]);try{const old=legacy(a,tiny),next=coilOverlapVolume(a,tiny);assert.ok(Math.abs(next-volume)<volume*.001);for(const threshold of [1e-7,.001])assert.equal(next>threshold,old>threshold,'small collision threshold '+volume);}finally{tiny.delete();}}
[a,over,touch,inside,away].forEach(s=>s.delete());
const source=R.makeBox([-25,-25,0],[25,25,80]),p={wire:2,pitch:4,turns:2,wall:2.9,jointGap:.4,jointSeam:0,jointSplit:60,hand:'右ねじ',autoAdjust:true,alignStop:false,closeAngle:0,jointPose:'閉じた状態',rimSeat:true,jointLatch:true,latchGap:.2,latchEngagement:.9,latchFirm:true};
let lastStage='',motionStart,allStart=performance.now();
const result=makeCoilJoint(source,p,progress=>{if(progress.stage!==lastStage){console.log(progress.stage);lastStage=progress.stage;if(progress.stage==='開閉の干渉を確認しています')motionStart=performance.now();}});
console.log(JSON.stringify({label:'square50x80 split60',checks:result.analysis.motion.checks.length,motionMs:Math.round(performance.now()-motionStart),totalMs:Math.round(performance.now()-allStart)}));
assert.equal(result.analysis.motion.status,'clear');assert.equal(result.analysis.motion.checks.length,29);assert.equal(result.analysis.motion.latch.status,'clear');assert.ok(result.analysis.motion.seating.tighteningOverlap>1e-5);assert.ok(result.analysis.motion.checks.every(c=>c.overlap<=.001));
const q=result.analysis,motion=latchReleaseMotion(result.parts[0],q),timings=[];
try{for(const t of [.0075,.125,.5]){const cam=q.motion.latch.checks.find(c=>c.turns===t),b=motion.at(cam?.deflection??0),l=screwLidPose(result.parts[1],q,t);try{timings.push(parity(b,l,'square full thread '+t));}finally{b.delete();l.delete();}}
const tightened=result.parts[1].clone().rotate(-5,[0,0,0],[0,0,1]);try{assert.ok(parity(result.parts[0],tightened,'closing interference').value>.001);}finally{tightened.delete();}
const reflected=result.parts.map(s=>s.mirror('XZ'));try{parity(reflected[0],reflected[1],'left hand closed');const squeezed=reflected[1].clone().rotate(5,[0,0,0],[0,0,1]);try{assert.ok(parity(reflected[0],squeezed,'left hand closing interference').value>.001);}finally{squeezed.delete();}}finally{reflected.forEach(s=>s.delete());}
console.log(JSON.stringify({speedRatio:timings.reduce((sum,x)=>sum+x.newMs,0)/timings.reduce((sum,x)=>sum+x.oldMs,0)}));
}finally{motion.delete();result.parts.forEach(s=>s.delete());source.delete();}
console.log('PASS exact old/new collision volume, unchanged inputs, containment/touching, full square29poses and seating, cam release compounds, both hands positive closing collisions');
