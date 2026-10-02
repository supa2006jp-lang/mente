import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {encloseBody,encloseParts} from '../src/enclose.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=R.makeBox([0,0,0],[30,20,20]),sourceBrep=source.serialize();
const basic={boxMode:true,thickness:2,clearance:.5,enclosureSplit:'XY',splitOffset:10,
 hinge:true,hingeEdge:'+Y',hingeRadialGap:.5,hingeAxialGap:.5,hingeAngle:0};
const valid=shape=>{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid(),'valid solid');}finally{check.delete();}};
const volumeIn=(solid,probe)=>{const overlap=solid.intersect(probe);try{return R.measureVolume(overlap);}finally{overlap.delete();}};
const inspectParts=parts=>{
 assert.equal(parts.length,2);
 for(const part of parts){
  valid(part);
  const solids=part.solids;try{assert.equal(solids.length,1,'one connected solid per half');}finally{solids.forEach(s=>s.delete());}
 }
 assert.ok(volumeIn(parts[0],parts[1])<1e-5,'the body and lid do not overlap');
};
const ordinary=encloseBody(source,2,basic),chest=encloseBody(source,2,{...basic,chestStyle:true});
try{
 valid(chest);
 assert.ok(R.measureVolume(chest)>R.measureVolume(ordinary),'arched roof adds solid material');
 assert.ok(chest.boundingBox.bounds[1][2]>ordinary.boundingBox.bounds[1][2]+3,'barrel roof rises above the rectangular lid');
 const rib=R.makeBox([9,9.5,26.2],[9.3,10.5,26.4]);
 const plainRoof=R.makeBox([17.3,9.5,26.2],[17.6,10.5,26.4]);
 try{
  assert.ok(volumeIn(chest,rib)>.01,'raised arch band is integral to the lid');
  assert.ok(volumeIn(chest,plainRoof)<1e-5,'surface between bands remains lower');
 }finally{rib.delete();plainRoof.delete();}
 const interior=R.makeBox([-.49,-.49,-.49],[30.49,20.49,20.49]);
 try{assert.ok(volumeIn(chest,interior)<1e-5,'rectangular interior and fit are preserved');}finally{interior.delete();}
 const plainAgain=encloseBody(source,2,{...basic,chestStyle:false});
 try{assert.ok(Math.abs(R.measureVolume(plainAgain)-R.measureVolume(ordinary))<1e-5,'style off keeps the ordinary BOX');}
 finally{plainAgain.delete();}
}finally{ordinary.delete();chest.delete();}
for(const angle of [0,90]){
 const parts=encloseParts(source,{...basic,chestStyle:true,hingeAngle:angle,snapLatch:true,latchGap:.45});
 try{
  inspectParts(parts);
  assert.equal(parts.analysis.latchMotion.unexpectedContactAngle,null,'roof and ribs do not obstruct the latch');
 }finally{parts.forEach(part=>part.delete());}
}
const expanded=encloseParts(source,{...basic,chestStyle:true,hingeAngle:90,
 autoExpandMotion:true,motionGap:.5,snapLatch:true,latchGap:.45});
try{
 inspectParts(expanded);
 assert.ok(expanded.analysis.minSampleGap>=expanded.analysis.requiredGap+expanded.analysis.conservativeMargin-1e-4,
  'automatic motion enlargement still protects the enclosed target');
 assert.equal(expanded.analysis.latchMotion.unexpectedContactAngle,null);
}finally{expanded.forEach(part=>part.delete());}
for(const [plane,offset,edge] of [['XZ',10,'+Z'],['YZ',15,'+Y']]){
 const parts=encloseParts(source,{...basic,enclosureSplit:plane,splitOffset:offset,hingeEdge:edge,chestStyle:true});
 try{inspectParts(parts);}finally{parts.forEach(part=>part.delete());}
}
assert.throws(()=>encloseBody(source,2,{boxMode:true,chestStyle:true}),/分割平面/);
assert.throws(()=>encloseBody(source,2,{...basic,chestStyle:true,faces:[{bodyId:'source',point:[15,10,20],normal:[0,0,1]}]}),/屋根側/);
assert.equal(source.serialize(),sourceBrep,'source body remains unchanged');
source.delete();
console.log('PASS treasure chest roof, integral ribs, rectangular fit, hinge and latch');
