import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseBody,encloseParts} from '../src/enclose.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const valid=s=>{const c=new (R.getOC().BRepCheck_Analyzer)(s.wrapped,true,false);try{assert.ok(c.IsValid());}finally{c.delete();}};
const source=R.makeBox([0,0,0],[30,20,20]),original=source.serialize();
const box=encloseBody(source,2,{clearance:.5,boxMode:true});
valid(box);
assert.deepEqual(box.boundingBox.bounds,[[-2.5,-2.5,-2.5],[32.5,22.5,22.5]]);
assert.ok(Math.abs(R.measureVolume(box)-(35*25*25-31*21*21))<1e-4);
const topProbe=R.makeBox([1,1,21],[29,19,22]),sideProbe=R.makeBox([1,21,1],[29,22,19]),topFace={bodyId:'source',point:[15,10,20],normal:[0,0,1]},sideFace={bodyId:'source',point:[15,20,10],normal:[0,1,0]};
const volumeIn=(solid,probe)=>{const part=solid.intersect(probe);try{return R.measureVolume(part);}finally{part.delete();}};
assert.ok(volumeIn(box,topProbe)>100,'unselected BOX top stays closed');
assert.ok(volumeIn(box,sideProbe)>100,'unselected BOX side stays closed');
const openedTop=encloseBody(source,2,{clearance:.5,boxMode:true,faces:[topFace]});valid(openedTop);
assert.ok(volumeIn(openedTop,topProbe)<1e-5,'selected +Z face opens the BOX top');
assert.ok(volumeIn(openedTop,sideProbe)>100,'unselected side stays closed');
const openedSide=encloseBody(source,2,{clearance:.5,boxMode:true,faces:[sideFace]});valid(openedSide);
assert.ok(volumeIn(openedSide,sideProbe)<1e-5,'selected +Y face opens that BOX side');
assert.ok(volumeIn(openedSide,topProbe)>100,'unselected top stays closed');
const openedBoth=encloseBody(source,2,{clearance:.5,boxMode:true,faces:[topFace,sideFace]});valid(openedBoth);
assert.ok(volumeIn(openedBoth,topProbe)<1e-5&&volumeIn(openedBoth,sideProbe)<1e-5);
for(const shape of [box,openedTop,openedSide,openedBoth,topProbe,sideProbe])shape.delete();
for(const [plane,offset,edges] of [['XY',10,['-X','+X','-Y','+Y']],['XZ',10,['-X','+X','-Z','+Z']],['YZ',15,['-Y','+Y','-Z','+Z']]]){
 for(const edge of edges){
  for(const angle of [0,45,90]){
   const p={boxMode:true,thickness:2,clearance:.5,enclosureSplit:plane,splitOffset:offset,hinge:true,hingeEdge:edge,hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:angle};
   const parts=encloseParts(source,p);
   assert.equal(parts.length,2,plane+' '+edge+' '+angle);
   parts.forEach(valid);
   for(const part of parts){const solids=part.solids;try{assert.equal(solids.length,1,plane+' '+edge+' '+angle+' has a connected body');}finally{solids.forEach(s=>s.delete());}}
   const separation=R.measureDistanceBetween(parts[0],parts[1]);assert.ok(separation>.18,plane+' '+edge+' '+angle+' clearance '+separation);
   const common=parts[0].intersect(parts[1]);
   try{assert.ok(R.measureVolume(common)<1e-5,plane+' '+edge+' '+angle);}
   finally{common.delete();}
   parts.forEach(s=>s.delete());
   console.log('ok',plane,edge,angle);
  }
 }
}
const gapDistances=[];
for(const gap of [.2,1]){const parts=encloseParts(source,{boxMode:true,thickness:2,clearance:.5,enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:gap,hingeAxialGap:gap,hingeAngle:90});gapDistances.push(R.measureDistanceBetween(parts[0],parts[1]));parts.forEach(s=>s.delete());}
assert.ok(gapDistances[1]>gapDistances[0]+.5,'adjusting hinge gaps separates the printed bodies');
assert.throws(()=>encloseParts(source,{boxMode:true,thickness:2,clearance:.5,enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.1,hingeAxialGap:.5,hingeAngle:90}),/すき間/);
const openedHinge=encloseParts(source,{boxMode:true,thickness:2,clearance:.5,faces:[topFace],enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:90});openedHinge.forEach(valid);openedHinge.forEach(shape=>shape.delete());
assert.throws(()=>encloseParts(source,{boxMode:true,thickness:2,clearance:.5,faces:[sideFace],enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:90}),/ヒンジを付ける側/);
assert.equal(source.serialize(),original);
source.delete();
console.log('PASS closed BOX, selected openings, hinge attachment rules, all split planes and edge angles');
