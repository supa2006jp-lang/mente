import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {resolveCoilJoint,screwLidPose,makeCoilJoint,makeCoilTestPiece} from '../src/coil-joint.js';
import {polygonCylinder} from '../src/coil-prism.js';
import {detentDimensions,detentShapes,attachDetent,checkDetent,detentReleaseMotion,checkDetentReceiver} from '../src/coil-detent.js';
import {coilOverlapVolume} from '../src/coil-collision.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const common={wire:2,pitch:4,turns:2,wall:3.3,jointGap:.4,jointSeam:0,jointSplit:34.448,hand:'右ねじ',autoAdjust:true,alignStop:false,closeAngle:0,closeAngleZero:2,jointPose:'閉じた状態',rimSeat:true,jointLatch:true,latchStyle:'ridge',latchFirm:true,latchExtraFirm:true,latchGap:.15,latchEngagement:1.1};
const profile=Array.from({length:6},(_,i)=>[30*Math.cos(Math.PI/6+i*Math.PI/3),30*Math.sin(Math.PI/6+i*Math.PI/3)]);
const cylinder={radius:26,height:55,origin:[0,0,0],axis:[0,0,1],shapeType:'cylinder'};
const polygon={...cylinder,radius:30*Math.cos(Math.PI/6),outerRadius:30,profile,shapeType:'polygon'};
const square={...cylinder,radius:25,outerRadius:25*Math.SQRT2,profile:[[-25,-25],[25,-25],[25,25],[-25,25]],shapeType:'polygon'};
for(const invalid of [-.001,1.001,NaN,Infinity,'0.5',true])assert.throws(()=>resolveCoilJoint(cylinder,{...common,stopFaceSetback:invalid}),/回転止め面の引き込み量/);
function validSingle(shape){
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
 try{assert.equal(check.IsValid(),true);assert.equal(solids.length,1);assert.ok(R.measureVolume(shape)>1e-6);}finally{check.delete();solids.forEach(s=>s.delete());}
}
function watertight(shape){
 const m=shape.mesh({tolerance:.08,angularTolerance:.15}),keys=Array.from({length:m.vertices.length/3},(_,i)=>m.vertices.slice(i*3,i*3+3).map(v=>Math.round(v*1e5)).join(',')),edges=new Map();
 for(let i=0;i<m.triangles.length;i+=3)for(let j=0;j<3;j++){const a=keys[m.triangles[i+j]],b=keys[m.triangles[i+(j+1)%3]];if(a===b)continue;const k=[a,b].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}
 assert.ok([...edges.values()].every(n=>n===2),'closed manifold mesh');
}
function stopFaceWitness(shape,d,q){
 const hand=q.leftHand?-1:1,angle=hand*(d.phase+d.stopB),nx=-hand*Math.sin(angle),ny=hand*Math.cos(angle),mesh=shape.mesh({tolerance:.02,angularTolerance:.08});
 let furthest=-Infinity;
 for(let i=0;i<mesh.vertices.length;i+=3)furthest=Math.max(furthest,mesh.vertices[i]*nx+mesh.vertices[i+1]*ny);
 return {furthest,heights:mesh.vertices.filter((_,i)=>i%3===2)};
}
function runoutShelfTriangles(lid,q){
 const flipped=lid.clone().rotate(180,[0,0,0],[1,0,0]).translate([0,0,q.height]);
 try{
  const mesh=flipped.mesh({tolerance:.025,angularTolerance:.08}),target=q.height-q.mouthRunout.shoulder,sign=q.leftHand?-1:1,first=sign*2*Math.PI*q.mouthRunout.start/q.pitch,last=sign*2*Math.PI*q.mouthRunout.end/q.pitch,lo=Math.min(first,last),hi=Math.max(first,last);let count=0;
  for(let i=0;i<mesh.triangles.length;i+=3){
   const vertices=[];for(let j=0;j<3;j++){const offset=mesh.triangles[i+j]*3;vertices.push(mesh.vertices.slice(offset,offset+3));}
   const center=[0,1,2].map(axis=>(vertices[0][axis]+vertices[1][axis]+vertices[2][axis])/3),r=Math.hypot(center[0],center[1]),theta=Math.atan2(-center[1],center[0]);
   const angle=theta+Math.round((lo-theta)/(2*Math.PI))*2*Math.PI;
   if(Math.abs(center[2]-target)>.035||r<q.pilotRadius-.25||r>q.pilotRadius+.25||angle<lo-.1||angle>hi+.1)continue;
   const ab=vertices[1].map((value,axis)=>value-vertices[0][axis]),ac=vertices[2].map((value,axis)=>value-vertices[0][axis]),nz=ab[0]*ac[1]-ab[1]*ac[0],length=Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],nz);
   if(length>1e-9&&nz/length<-.9)count++;
  }
  return count;
 }finally{flipped.delete();}
}
function surrogate(q){
 const outer=(height,z=0)=>q.profile?polygonCylinder(q.profile,height,z):R.makeCylinder(q.radius,height,[0,0,z]);
 let body=outer(q.split),neck=R.makeCylinder(q.maleRadius,q.neckLength+.05,[0,0,q.split-.05]);const b=body.fuse(neck);body.delete();neck.delete();body=b;
 let tool=R.makeCylinder(q.innerRadius,q.split+q.neckLength-q.wall+.1,[0,0,q.wall]),cut=body.cut(tool);body.delete();tool.delete();body=cut;
 let lid=outer(q.height-q.split,q.split);if(q.profile&&q.closeAngle){const rotated=lid.rotate(q.closeAngle,[0,0,0],[0,0,1]);lid.delete();lid=rotated;}
 tool=R.makeCylinder(q.boreRadius,q.height-q.split-q.wall+.1,[0,0,q.split-.1]);cut=lid.cut(tool);lid.delete();tool.delete();lid=cut;
 tool=R.makeCylinder(q.pilotRadius,q.pilot+.02,[0,0,q.split-.01]);cut=lid.cut(tool);lid.delete();tool.delete();lid=cut;
 return {body,lid};
}
for(const info of [cylinder,polygon,square])for(const hand of ['右ねじ','左ねじ']){
 const q=resolveCoilJoint(info,{...common,hand}),d=detentDimensions(q);
 assert.deepEqual(q.stopFacePreview,{angle:d.hand*(d.phase+d.stopB),inner:d.stopInner,outer:d.stopOuter,height:d.stopHeight});
 assert.ok(d.crestWidth>=4.8&&d.crestWidth<=5.2);
 assert.ok(d.t>=1.2,'two 0.6 mm extrusion widths at arm root');
 assert.ok(d.backing>=1.2&&d.receiverBacking>=1.2-1e-7);
 assert.ok(q.pitch>=d.requiredPitch-1e-7&&q.split>=d.requiredSplit-1e-7);
 let previousVolume=Infinity;
 for(const stopFaceSetback of [0,.5,1]){
  const adjusted=resolveCoilJoint(info,{...common,hand,stopFaceSetback}),sd=detentDimensions(adjusted),shapes=detentShapes(adjusted);
  assert.equal(adjusted.stopFaceSetback,stopFaceSetback);
  try{
   assert.ok(R.measureVolume(shapes.arm)>0);assert.ok(R.measureVolume(shapes.pocket)>0);assert.ok(R.measureVolume(shapes.stop)>0);
   validSingle(shapes.stop);
   const witness=stopFaceWitness(shapes.stop,sd,adjusted),bottom=adjusted.split-.1,top=adjusted.split+sd.stopHeight;
   assert.ok(Math.abs(witness.furthest+stopFaceSetback)<.02,'mountain-facing stop face follows the requested setback');
   assert.ok(witness.heights.some(z=>Math.abs(z-top)<.02),'stop still reaches the original top height');
   assert.ok(witness.heights.every(z=>Math.abs(z-bottom)<.02||Math.abs(z-top)<.02),'stop top remains level');
   const volume=R.measureVolume(shapes.stop);
   assert.ok(volume<previousVolume-1e-5,'larger setback shortens the stop');
   previousVolume=volume;
  }finally{for(const k of ['arm','stop','channel','pocket','stopPocket'])shapes[k].delete();shapes.cuts.forEach(s=>s.delete());}
 }
 const lock=checkDetent(q);
 if(info===cylinder)for(const stopFaceSetback of [0,1]){const adjusted=resolveCoilJoint(info,{...common,hand,stopFaceSetback}),checked=checkDetent(adjusted);assert.equal(checked.status,'clear');assert.ok(checked.tighteningOverlap>1e-6);}
 assert.equal(lock.status,'clear');assert.ok(lock.openingOverlap>1e-4);assert.ok(lock.checks.some(c=>c.deflection>0));assert.ok(lock.checks.every(c=>c.releasedOverlap<1e-6));
 const {body,lid}=surrogate(q);let assembled,motion;
 try{
  assembled=attachDetent(body,lid,q);validSingle(assembled.body);validSingle(assembled.lid);watertight(assembled.body);watertight(assembled.lid);
  assert.ok(coilOverlapVolume(assembled.body,assembled.lid)<1e-5,'seated pair clear');
  const receiver=checkDetentReceiver(assembled.lid,q,lock);assert.equal(receiver.status,'clear');assert.ok(receiver.retention>=.8);
  motion=detentReleaseMotion(assembled.body,q);
  for(const c of lock.checks){const released=motion.at(c.deflection),moved=screwLidPose(assembled.lid,q,c.turns);try{assert.ok(coilOverlapVolume(released,moved)<.001,'opening pose '+c.turns);}finally{released.delete();moved.delete();}}
 }finally{motion?.delete();assembled?.body.delete();assembled?.lid.delete();body.delete();lid.delete();}
 console.log(JSON.stringify({shape:info.profile?.length===4?'square':info.shapeType,hand,crestWidth:d.crestWidth,engagement:d.e,release:d.release,requiredPitch:d.requiredPitch}));
}

if(!process.argv.includes('--surrogate-only')){
// A 50 mm hexagonal source at the user's pitch, wall and engagement verifies
// the real helix, mouth relief, finished receiver and shortened print sample.
const userProfile=profile.map(point=>point.map(value=>value*25/30)),base=polygonCylinder(userProfile,80),spec={...common,latchStyle:'ridge',jointSplit:45,autoFillet:true,filletRadius:.5};
const original=makeCoilJoint(base,spec),test=makeCoilTestPiece(base,spec);
try{
 const q=original.analysis,t=test.analysis.testPiece,d=detentDimensions(q);
 assert.equal(q.latchVersion,'rounded-detent-v2');
 assert.equal(q.motion.status,'clear');
 assert.equal(q.fillet?.status,'clear');
 assert.equal(test.analysis.motion.status,'clear');
 assert.ok(q.motion.latch.actualReceiver.retention>=.8);
 assert.ok(q.motion.latch.actualReceiver.mountainRetention>=.8);
 assert.ok(t.bodyLow>0&&t.lidTop<q.height&&t.savedPercent>0);
 for(const part of [...original.parts,...test.parts])validSingle(part);
 assert.equal(runoutShelfTriangles(original.parts[1],q),0,'inverted lid has no horizontal runout shoulder requiring an interior tree support');
 const restoredBody=test.parts[0].clone().translate([0,0,t.bodyLow]);
 const restoredLid=test.parts[1].clone().translate(t.lidTranslation.map(v=>-v)).rotate(180,[0,0,0],[1,0,0]);
 const sameZone=(a,b,low,high)=>{const crop=shape=>{const tool=R.makeBox([-26,-26,low],[26,26,high]);try{return shape.intersect(tool);}finally{tool.delete();}};const x=crop(a),y=crop(b);try{const va=R.measureVolume(x),vb=R.measureVolume(y),common=coilOverlapVolume(x,y);assert.ok(Math.abs(va-vb)<.001);assert.ok(Math.abs(va-common)<.001);}finally{x.delete();y.delete();}};
 try{
  sameZone(original.parts[0],restoredBody,q.split-d.length-.1,q.split+q.neckLength+.1);
  sameZone(original.parts[1],restoredLid,q.split,q.split+q.neckLength+q.extension+.15);
 }finally{restoredBody.delete();restoredLid.delete();}
 console.log(JSON.stringify({integrated:'50 mm hexagon',crestWidth:d.crestWidth,engagement:d.e,testSavedPercent:t.savedPercent,openingSamples:q.motion.checks.length}));
}finally{original.parts.forEach(s=>s.delete());test.parts.forEach(s=>s.delete());base.delete();}
console.log('PASS local rounded mountain/groove, internal backing, both hands, cylinder/hexagon, full coil motion, preserved test-piece phase');
}
