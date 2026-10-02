import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseParts} from '../src/enclose.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=R.makeBox([0,0,0],[30,20,20]),original=source.serialize();
const basic={boxMode:true,thickness:2,clearance:.5,enclosureSplit:'XY',splitOffset:10,hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:0,snapLatch:true,latchGap:.45,latchEngagement:.3,seamGap:.3};
const reinforced={...basic,hardwareScale:1.3,latchProfile:'triangle'};
const dispose=parts=>parts.forEach(part=>part.delete());
const volumeIn=(solid,probe)=>{const common=solid.intersect(probe);try{return R.measureVolume(common);}finally{common.delete();}};
const valid=shape=>{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid(),'valid BRep');}finally{check.delete();}};
const inspect=parts=>{
 assert.equal(parts.length,2);
 for(const part of parts){
  valid(part);
  const solids=part.solids;
  try{assert.equal(solids.length,1,'each printed half stays connected');}
  finally{solids.forEach(s=>s.delete());}
 }
 const common=parts[0].intersect(parts[1]);
 try{assert.ok(R.measureVolume(common)<1e-5,'printed halves never overlap');}
 finally{common.delete();}
};

// Existing round projects retain their original solids and dimensions.
const legacy=encloseParts(source,basic);
const explicitOld=encloseParts(source,{...basic,hardwareScale:1,latchProfile:'round'});
for(let i=0;i<2;i++){
 assert.ok(Math.abs(R.measureVolume(legacy[i])-R.measureVolume(explicitOld[i]))<1e-5,'old projects retain the round geometry');
 assert.deepEqual(legacy[i].boundingBox.bounds,explicitOld[i].boundingBox.bounds);
}
dispose(explicitOld);

const weak=encloseParts(source,reinforced);
try{
 inspect(weak);
 const oldPinRadius=Math.max(1,basic.thickness*.55),newPinRadius=oldPinRadius*reinforced.hardwareScale;
 const oldOuterRadius=oldPinRadius+basic.hingeRadialGap+Math.max(.9,basic.thickness*.65);
 const newOuterRadius=newPinRadius+reinforced.hingeRadialGap+Math.max(.9,reinforced.thickness*.65)*reinforced.hardwareScale;
 assert.ok(Math.abs(weak.hingeFrame.point[1]-legacy.hingeFrame.point[1]-(newOuterRadius-oldOuterRadius))<1e-6,'hinge sleeve and pin grow while radial gap stays fixed');
 assert.equal(weak.analysis.latchMotion.unexpectedContactAngle,null);
 assert.ok(Math.abs(R.measureDistanceBetween(...weak)-reinforced.seamGap)<1e-5,'closed seam uses its independent gap');
}finally{dispose(weak);dispose(legacy);}

// A near-wall hook and compact receiver hold the lid on a horizontal shelf.
const recommended={...reinforced,latchGap:.30,latchEngagement:1.30};
const closed=encloseParts(source,recommended);
const scale=recommended.hardwareScale,outerWall=-recommended.clearance-recommended.thickness;
const depth=Math.min(8*scale,recommended.splitOffset-recommended.hingeRadialGap/2-outerWall-1);
const beadN=recommended.splitOffset-depth+1.5*scale,shelfN=beadN+.6*scale,roofN=shelfN+recommended.latchGap;
const bossReach=Math.max(1.1*scale,recommended.latchEngagement+.1*scale);
const unextendedTipQ=bossReach-recommended.latchEngagement,previousTipQ=unextendedTipQ-.5,tipExtension=.5,tipQ=previousTipQ-tipExtension,beamQ=bossReach+recommended.latchGap;
const beamThickness=(Math.max(.9,Math.min(1.3,recommended.thickness*.55))+.12)*scale;
const toothBottomN=beadN-1.25*scale,toothChamfer=.2*scale,toothRootQ=beamQ+beamThickness;
const gripRadius=beamThickness/2,gripEndN=beadN-2.3*scale,gripCenterQ=beamQ+gripRadius;
const probe=(q0,q1,n0,n1)=>R.makeBox([14.9,outerWall-q1,n0],[15.1,outerWall-q0,n1]);
const has=(part,q0,q1,n0,n1,message)=>{const p=probe(q0,q1,n0,n1);try{assert.ok(volumeIn(part,p)>.0002,message);}finally{p.delete();}};
const empty=(part,q0,q1,n0,n1,message)=>{const p=probe(q0,q1,n0,n1);try{assert.ok(volumeIn(part,p)<1e-6,message);}finally{p.delete();}};
let armSlice;
try{
 inspect(closed);
 assert.equal(closed.analysis.latchMotion.status,'flex-required');
 assert.equal(closed.analysis.latchMotion.unexpectedContactAngle,null);
 assert.ok(Math.abs(R.measureDistanceBetween(...closed)-recommended.seamGap)<1e-5,'closed seam remains 0.30 mm');
 assert.ok(Math.abs(unextendedTipQ-.13)<1e-8,'the unextended tip begins 0.13 mm outside the BOX wall');
 assert.ok(Math.abs(previousTipQ+.37)<1e-8,'the prior square claw entered the wall by 0.37 mm');
 assert.ok(Math.abs(previousTipQ-tipQ-.5)<1e-8,'the square claw extends another 0.50 mm toward the receiver');
 assert.ok(Math.abs(tipQ+.87)<1e-8,'the longer tip enters the matching wall recess by 0.87 mm');
 assert.ok(Math.abs(beamQ-1.73)<1e-8,'arm moves within 1.73 mm of the BOX outside wall');
 assert.ok(Math.abs(beamThickness-1.586)<1e-8,'spring arm is modestly thicker');
 assert.ok(Math.abs(gripCenterQ-2.523)<1e-8,'the square claw extension does not move the round finger pull');
 assert.ok(Math.abs(gripEndN-(beadN-2.99))<1e-8,'the square claw extension does not lengthen the finger pull');

 // The blue tab runs from the underside of the pull arm to a broad, flat low face.
 // Only its near-wall entry corner is chamfered; the long upper shelf still catches.
 for(const [q0,q1] of [[tipQ+toothChamfer+.08,tipQ+toothChamfer+.16],[bossReach-.30,bossReach-.20]]){
  has(closed[1],q0,q1,toothBottomN+.03,toothBottomN+.08,'the broad claw has a flat low face beside the pull arm');
  empty(closed[1],q0,q1,toothBottomN-.08,toothBottomN-.03,'the claw ends at the same flat low face');
 }
 empty(closed[1],tipQ+.03,tipQ+.08,toothBottomN+.04,toothBottomN+.09,'the short entry chamfer removes the low tip corner');
 has(closed[1],tipQ+.03,tipQ+.08,toothBottomN+toothChamfer+.03,toothBottomN+toothChamfer+.08,'the chamfer joins the flat hook tip');
 has(closed[1],toothRootQ-.09,toothRootQ-.04,beadN-.12,beadN-.04,'the full-width claw joins the pull arm');

 // The gray finger pull continues below the blue claw and ends in a round profile.
 has(closed[1],gripCenterQ-.04,gripCenterQ+.04,toothBottomN-.45,toothBottomN-.35,'the finger pull extends past the claw');
 empty(closed[1],tipQ+.45,tipQ+.55,toothBottomN-.45,toothBottomN-.35,'the blue claw does not extend with the finger pull');
 has(closed[1],gripCenterQ-.04,gripCenterQ+.04,gripEndN-.50,gripEndN-.45,'the rounded end extends beyond the straight arm');
 empty(closed[1],beamQ+.05,beamQ+.10,gripEndN-.50,gripEndN-.45,'the end curves inward at its edge');
 empty(closed[1],gripCenterQ-.04,gripCenterQ+.04,gripEndN-gripRadius-.10,gripEndN-gripRadius-.05,'the round end stops at its radius');

 // Inner and outer samples must both change from solid to empty at the same shelf height.
 for(const [q0,q1] of [[tipQ+.08,tipQ+.18],[bossReach-.45,bossReach-.35]]){
  has(closed[1],q0,q1,shelfN-.08,shelfN-.03,'hook is solid immediately below the horizontal shelf');
  empty(closed[1],q0,q1,shelfN+.03,shelfN+.08,'hook ends at the horizontal shelf');
  empty(closed[0],q0,q1,roofN-.08,roofN-.03,'receiver is recessed below its horizontal roof');
  has(closed[0],q0,q1,roofN+.03,roofN+.08,'receiver has a solid roof over the hook');
 }

 // The deeper matched pocket cuts 1.20 mm into a 2 mm BOX wall and leaves 0.80 mm solid.
 has(closed[1],tipQ+.03,tipQ+.08,beadN+.12,beadN+.20,'the longer hook tip is printable solid inside the matched recess');
 empty(closed[1],tipQ-.08,tipQ-.03,beadN+.12,beadN+.20,'the hook ends at the newly extended tip');
 empty(closed[0],-1.19,-1.16,beadN+.18,beadN+.28,'the matched receiver pocket reaches just short of its wall limit');
 has(closed[0],-1.24,-1.21,beadN+.18,beadN+.28,'the receiver pocket stops at the 1.20 mm wall cut');
 has(closed[0],-1.62,-1.58,beadN+.18,beadN+.28,'at least 0.8 mm of wall remains behind the deeper groove');

 // The receiver follows the tab's low face with a full clearance gap.
 has(closed[0],.70,.78,toothBottomN-recommended.latchGap-.08,toothBottomN-recommended.latchGap-.03,'solid receiver remains below the groove');
 empty(closed[0],.70,.78,toothBottomN-recommended.latchGap+.03,toothBottomN-recommended.latchGap+.08,'the groove begins one latch gap below the tab');
 empty(closed[0],.70,.78,toothBottomN+.03,toothBottomN+.08,'the receiver clears the broad lower face');
 has(closed[1],.70,.78,toothBottomN+.03,toothBottomN+.08,'the claw enters the matching receiver recess');

 // Measure the actual beam cross section away from its tip and root.
 const armZone=probe(1.2,4.0,shelfN+1.6,shelfN+1.7);
 try{armSlice=closed[1].intersect(armZone);}finally{armZone.delete();}
 const armBounds=armSlice.boundingBox.bounds;
 const actualInnerQ=outerWall-armBounds[1][1],actualOuterQ=outerWall-armBounds[0][1];
 assert.ok(Math.abs(actualInnerQ-beamQ)<1e-5,'printed arm sits next to the compact receiver');
 assert.ok(Math.abs(actualOuterQ-actualInnerQ-beamThickness)<1e-5,'printed arm has the reinforced thickness');
 empty(closed[0],bossReach+.04,beamQ-.04,shelfN+.33,shelfN+.37,'receiver-to-arm gap stays open');
}finally{armSlice?.delete();dispose(closed);}

const maximum={...recommended,latchEngagement:1.5};
const maximumClosed=encloseParts(source,maximum);
try{
 inspect(maximumClosed);
 assert.equal(maximumClosed.analysis.latchMotion.unexpectedContactAngle,null);
 empty(maximumClosed[0],-1.16,-1.13,beadN+.18,beadN+.28,'maximum-engagement groove remains deep');
 has(maximumClosed[0],-1.62,-1.58,beadN+.18,beadN+.28,'maximum-engagement groove retains wall thickness');
}finally{dispose(maximumClosed);}

const open=encloseParts(source,{...recommended,hingeAngle:90});
try{
 inspect(open);
 assert.ok(R.measureDistanceBetween(...open)>=recommended.hingeRadialGap-1e-4,'extended hook clears the base in the print pose');
}finally{dispose(open);}

// A shallow BOX still has a rounded finger end without a foot below its base.
const shallow=encloseParts(source,{...recommended,splitOffset:5.4});
try{
 inspect(shallow);
 const floor=outerWall;
 const pullQ=beamQ+beamThickness/2;
 assert.ok(Math.abs(shallow[1].boundingBox.bounds[0][2]-floor)<1e-5,'rounded finger end stops at the BOX floor');
 has(shallow[1],pullQ-.04,pullQ+.04,floor+.03,floor+.08,'rounded finger end reaches the BOX floor');
 empty(shallow[1],pullQ-.04,pullQ+.04,floor-.08,floor-.03,'rounded finger end never projects below the BOX floor');
}finally{dispose(shallow);}

for(const [plane,offset,edges] of [
 ['XY',10,['-X','+X','-Y','+Y']],
 ['XZ',10,['-X','+X','-Z','+Z']],
 ['YZ',15,['-Y','+Y','-Z','+Z']]
])for(const edge of edges)for(const angle of [0,90]){
 const parts=encloseParts(source,{...recommended,enclosureSplit:plane,splitOffset:offset,hingeEdge:edge,hingeAngle:angle});
 try{
  inspect(parts);
  assert.equal(parts.analysis.latchMotion.unexpectedContactAngle,null,'no unrelated contact during closure');
  assert.ok(R.measureDistanceBetween(...parts)>=(angle===0?recommended.seamGap:recommended.hingeRadialGap)-1e-4,'selected pose keeps its requested clearance');
 }finally{dispose(parts);}
}
assert.throws(()=>encloseParts(source,{...reinforced,hardwareScale:.9}),/ヒンジと爪の大きさ/);
assert.throws(()=>encloseParts(source,{...reinforced,latchProfile:'oval'}),/爪の形状/);
assert.throws(()=>encloseParts(source,{...reinforced,latchEngagement:1.51}),/爪の掛かり量/);
assert.throws(()=>encloseParts(source,{...recommended,thickness:.2,latchGap:.8,latchEngagement:1.5}),/受け溝がBOXの壁を貫通/,'thin walls must reject a groove that breaks through');
assert.equal(source.serialize(),original,'latch generation leaves the source unchanged');
source.delete();
console.log('PASS reinforced near-wall horizontal hook, deep matching groove, legacy round latch, all 12 hinge edges');
