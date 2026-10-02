import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {polygonCylinder} from '../src/coil-prism.js';
import {makeCoilJoint} from '../src/coil-joint.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const profile=[[0,-20],[17.32050807568877,-10],[17.320508075688775,10],[0,20],[-17.32050807568877,10],[-17.32050807568877,-10]];
const base=polygonCylinder(profile,40);
const spec={wire:2,pitch:4,turns:2,wall:3.3,jointGap:.4,jointSeam:0,jointSplit:0,hand:'右ねじ',jointPose:'分けて並べる',jointLatch:true,latchStyle:'ridge',latchFirm:true,latchExtraFirm:true,latchGap:.05,latchEngagement:1.6,rimSeat:true,alignStop:false,closeAngle:0,closeAngleZero:2,autoAdjust:true,autoFillet:false};
// Measure the actual underside triangles where this 0.6 mm print previously
// grew a tree support: the narrow start of the female groove in the flipped lid.
function isolatedEntryArea(lid,q){
 const box=lid.boundingBox;
 let cx,cy;
 try{const [lo,hi]=box.bounds;cx=(lo[0]+hi[0])/2;cy=(lo[1]+hi[1])/2;}finally{box.delete();}
 const mesh=lid.mesh({tolerance:.025,angularTolerance:.08});
 let area=0;
 for(let i=0;i<mesh.triangles.length;i+=3){
  const p=[];for(let j=0;j<3;j++){const k=3*mesh.triangles[i+j];p.push(mesh.vertices.slice(k,k+3));}
  const mid=[0,1,2].map(axis=>(p[0][axis]+p[1][axis]+p[2][axis])/3),r=Math.hypot(mid[0]-cx,mid[1]-cy),angle=Math.atan2(mid[1]-cy,mid[0]-cx)*180/Math.PI;
  if(mid[2]<16.7||mid[2]>17.4||r<13||r>14.2||angle<55||angle>105)continue;
  const a=p[1].map((v,j)=>v-p[0][j]),b=p[2].map((v,j)=>v-p[0][j]),cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],length=Math.hypot(...cross);
  if(length>1e-9&&cross[2]/length<-.5)area+=length/2;
 }
 return area;
}
let result;
try{
 result=makeCoilJoint(base,spec);const q=result.analysis,runout=q.mouthRunout,tail=Math.min(q.pitch/8,Math.max(0,runout.reach-runout.thickness-.06));
 assert.equal(q.motion.status,'clear');assert.equal(q.motion.latch.status,'clear');
 const firstRelease=q.motion.latch.checks.find(check=>check.turns===.01)?.deflection;
 assert.ok(firstRelease>1&&firstRelease<1.3,'steep opening shoulder catches early without exhausting arm travel');
 assert.ok(q.motion.latch.actualReceiver.retention>=.8);assert.ok(q.motion.latch.actualReceiver.mountainRetention>=.8);
 assert.ok(Math.abs(q.split-24)<1e-6&&Math.abs(q.height-43.3)<1e-6);
 assert.ok(tail>.45&&tail<.5,'local mouth relief covers the unsupported 40-degree groove start');
 assert.ok(runout.thickness+tail+.06<=runout.reach+1e-9,'relief stops before the next helical land');
 const unsupportedEntry=isolatedEntryArea(result.parts[1],q);
 assert.ok(unsupportedEntry<.3,`female groove must not retain isolated entry underside: ${unsupportedEntry.toFixed(3)} mm²`);
 for(const shape of result.parts){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.equal(check.IsValid(),true);assert.equal(solids.length,1);}finally{check.delete();solids.forEach(s=>s.delete());}}
 console.log(JSON.stringify({source:'40mm hexagonal source, rounded detent, 0.6mm-nozzle clearance',split:q.split,height:q.height,tail,unsupportedEntry,openingSamples:q.motion.checks.length,receiverRetention:q.motion.latch.actualReceiver.retention,mountainRetention:q.motion.latch.actualReceiver.mountainRetention}));
 console.log('PASS exact user-size rounded detent opening and receiver after support-free mouth relief');
}finally{result?.parts.forEach(s=>s.delete());base.delete();}
