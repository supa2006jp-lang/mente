import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseParts} from '../src/enclose.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=R.makeBox([0,0,0],[30,20,20]);
const original=source.serialize();
const p={boxMode:true,thickness:2,clearance:.5,enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:0};
const valid=shape=>{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid(),'BRep is valid');}finally{check.delete();}};
const dispose=parts=>parts.forEach(part=>part.delete());
const volumeIn=(shape,probe)=>{const common=shape.intersect(probe);try{return R.measureVolume(common);}finally{common.delete();}};
const checkParts=parts=>{
 assert.equal(parts.length,2);
 for(const part of parts){
  valid(part);
  const solids=part.solids;
  try{assert.equal(solids.length,1,'each printed half is connected');}
  finally{solids.forEach(s=>s.delete());}
 }
 const common=parts[0].intersect(parts[1]);
 try{assert.ok(R.measureVolume(common)<1e-5,'the printed halves do not overlap');}
 finally{common.delete();}
};

const unexpanded=encloseParts(source,{...p,hingeAngle:5});
const initialDistance=R.measureDistanceBetween(unexpanded[1],source);
assert.ok(initialDistance<.5,'small-angle sweep hits the enclosed source with the original clearance');
dispose(unexpanded);
const auto=encloseParts(source,{...p,autoExpandMotion:true,motionGap:.5});
checkParts(auto);
assert.ok(auto.analysis,'motion report is attached to generated halves');
assert.ok(auto.analysis.boxExtra>0,'collision forces a larger BOX');
assert.ok(auto.analysis.effectiveClearance>.5);
assert.ok(auto.analysis.minSampleGap>=auto.analysis.requiredGap+auto.analysis.conservativeMargin-1e-4,'sweep accounts for motion between samples');
assert.ok(auto.analysis.checkedAngle>=90,'the printable open pose is checked');
const extra=auto.analysis.boxExtra;
assert.ok(Math.abs(auto[0].boundingBox.bounds[0][0]-(-2.5-extra))<1e-4,'the box grows outward');
dispose(auto);
for(const angle of [0,5,10,15,45,90]){
 const parts=encloseParts(source,{...p,boxExtra:extra,hingeAngle:angle});
 checkParts(parts);
 assert.ok(R.measureDistanceBetween(parts[1],source)>=.5-1e-4,`source clearance at ${angle} degrees`);
 dispose(parts);
}
const roomy=encloseParts(source,{...p,clearance:10,autoExpandMotion:true,motionGap:.5});
assert.equal(roomy.analysis.boxExtra,0,'already clear motion needs no enlargement');
dispose(roomy);
assert.throws(()=>encloseParts(source,{...p,autoExpandMotion:true,motionGap:.1}),/必要すき間/);
assert.throws(()=>encloseParts(source,{...p,hinge:false,autoExpandMotion:true,motionGap:.5}),/BOX・分割面・ヒンジ/);

const plain=encloseParts(source,p);
const closeSeam=encloseParts(source,{...p,seamGap:.2});
const explicitLegacySeam=encloseParts(source,{...p,seamGap:p.hingeRadialGap});
checkParts(closeSeam);
assert.ok(Math.abs(R.measureDistanceBetween(closeSeam[0],closeSeam[1])-.2)<1e-4,'seam gap narrows the closed rim independently of the hinge gap');
assert.ok(Math.abs(R.measureDistanceBetween(plain[0],plain[1])-.5)<1e-4,'omitted seam gap uses the original hinge radial gap');
const seamProbe=R.makeBox([0,-2,9.8],[1,-1,9.85]);
try{
 assert.ok(volumeIn(closeSeam[0],seamProbe)>.04,'the narrower seam adds solid material at the ordinary rim');
 assert.ok(volumeIn(plain[0],seamProbe)<1e-5,'the original rim remains clear at the same point');
}finally{seamProbe.delete();}
for(let i=0;i<2;i++)assert.ok(Math.abs(R.measureVolume(plain[i])-R.measureVolume(explicitLegacySeam[i]))<1e-5,'omitted seam gap preserves old project geometry');
dispose(closeSeam);
dispose(explicitLegacySeam);
const closed=encloseParts(source,{...p,snapLatch:true,latchGap:.45});
checkParts(closed);
assert.ok(R.measureVolume(closed[0])>R.measureVolume(plain[0]),'receiver boss is fused to the base');
assert.ok(R.measureVolume(closed[1])>R.measureVolume(plain[1]),'snap tab is fused to the lid');
assert.ok(closed[0].boundingBox.bounds[0][1]<plain[0].boundingBox.bounds[0][1]-2,'receiver projects beyond the opposite wall');
const grooveProbe=R.makeBox([14.8,-5.2,3.3],[15.2,-4.8,3.7]);
const bossProbe=R.makeBox([14.8,-5.2,6],[15.2,-4.8,6.4]);
try{
 assert.ok(volumeIn(closed[0],grooveProbe)<1e-5,'receiver has a recess for the bead');
 assert.ok(volumeIn(closed[0],bossProbe)>.05,'recess is cut into a solid boss');
}finally{grooveProbe.delete();bossProbe.delete();}
const entryProbe=R.makeBox([14.8,-5.5,6.9],[15.2,-5.43,7.1]);
const retainedWallProbe=R.makeBox([14.8,-5.1,6.9],[15.2,-5.0,7.1]);
try{
 assert.ok(volumeIn(closed[0],entryProbe)<1e-5,'lead-in removes the receiver outer lip above the groove');
 assert.ok(volumeIn(closed[0],retainedWallProbe)>.006,'lead-in keeps the receiver wall behind the ramp');
}finally{entryProbe.delete();retainedWallProbe.delete();}
const gentlerLatch=encloseParts(source,{...p,snapLatch:true,latchGap:.45,latchEngagement:.3});
const explicitLegacyLatch=encloseParts(source,{...p,snapLatch:true,latchGap:.45,latchEngagement:.7});
checkParts(gentlerLatch);
assert.ok(gentlerLatch[1].boundingBox.bounds[0][1]<closed[1].boundingBox.bounds[0][1]-.39,'smaller engagement moves the rounded bead outward from the receiver lip');
assert.equal(gentlerLatch.analysis.boxExtra,0,'latch report preserves enclosure expansion metadata');
assert.equal(gentlerLatch.analysis.latchMotion.status,'flex-required','normal latch contact is not classified as a rigid-body failure');
assert.equal(gentlerLatch.analysis.latchMotion.unexpectedContactAngle,null);
assert.ok(gentlerLatch.analysis.latchMotion.maxRequiredDeflection>.02&&gentlerLatch.analysis.latchMotion.maxRequiredDeflection<.06,'lead-in lowers estimated flex while keeping retention');
assert.ok(gentlerLatch.analysis.latchMotion.contactRange[0]>0&&gentlerLatch.analysis.latchMotion.contactRange[1]<10,'snap contact occurs only near closure');
assert.ok(explicitLegacyLatch.analysis.latchMotion.maxRequiredDeflection>gentlerLatch.analysis.latchMotion.maxRequiredDeflection+.2,'greater engagement requires more flex');
const legacyFlex=closed.analysis.latchMotion.maxRequiredDeflection;
for(let i=0;i<2;i++)assert.ok(Math.abs(R.measureVolume(closed[i])-R.measureVolume(explicitLegacyLatch[i]))<1e-5,'omitted latch engagement matches explicit legacy engagement in this version');
dispose(gentlerLatch);
dispose(explicitLegacyLatch);
dispose(plain);
dispose(closed);
const open=encloseParts(source,{...p,snapLatch:true,latchGap:.45,hingeAngle:90});
checkParts(open);
assert.ok(R.measureDistanceBetween(open[0],open[1])>.18,'opened snap tab clears the base');
assert.ok(Math.abs(open.analysis.latchMotion.maxRequiredDeflection-legacyFlex)<.005,'the same 0-90 degree sweep is reported from an opened print pose');
dispose(open);
const combined=encloseParts(source,{...p,autoExpandMotion:true,motionGap:.5,snapLatch:true,latchGap:.45,hingeAngle:90});
checkParts(combined);
assert.ok(combined.analysis.boxExtra>0,'automatic enlargement works together with the snap latch');
assert.ok(combined.analysis.latchMotion&&combined.analysis.latchMotion.checkedAngle>=90,'the final auto-expanded box is diagnosed once');
dispose(combined);
for(const [plane,offset,edges] of [
 ['XY',10,['-X','+X','-Y','+Y']],
 ['XZ',10,['-X','+X','-Z','+Z']],
 ['YZ',15,['-Y','+Y','-Z','+Z']]
]){
 for(const edge of edges){
  const parts=encloseParts(source,{...p,enclosureSplit:plane,splitOffset:offset,hingeEdge:edge,snapLatch:true,latchGap:.45,hingeAngle:90});
  checkParts(parts);
  assert.equal(parts.analysis.latchMotion.unexpectedContactAngle,null,('unexpected motion contact for '+plane+' '+edge));
  dispose(parts);
 }
}
for(const seamGap of [.09,3.01,NaN])assert.throws(()=>encloseParts(source,{...p,seamGap}),/蓋と本体のすき間/);
for(const latchEngagement of [.09,1.51,NaN])assert.throws(()=>encloseParts(source,{...p,snapLatch:true,latchGap:.45,latchEngagement}),/爪の掛かり量/);
assert.throws(()=>encloseParts(source,{...p,snapLatch:true,latchGap:.1}),/爪と溝のすき間/);
assert.throws(()=>encloseParts(source,{...p,hinge:false,snapLatch:true,latchGap:.45}),/ヒンジ/);
const oppositeFace={bodyId:'source',point:[15,0,10],normal:[0,-1,0]};
assert.throws(()=>encloseParts(source,{...p,snapLatch:true,latchGap:.45,faces:[oppositeFace]}),/爪を付ける側/);
assert.equal(source.serialize(),original,'generating and testing parts does not mutate the target solid');
source.delete();
console.log('PASS motion clearance and optional snap latch');
