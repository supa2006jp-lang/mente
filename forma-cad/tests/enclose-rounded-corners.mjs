import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {encloseBody,encloseParts} from '../src/enclose.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4,a+' != '+b);
function valid(shape){const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(analyzer.IsValid());assert.ok(shape.mesh().triangles.length);}finally{analyzer.delete();}}
function filled(shape,point){const probe=R.makeBox(point.map(v=>v-.01),point.map(v=>v+.01));let common;try{common=shape.intersect(probe);return R.measureVolume(common)>1e-6;}finally{common?.delete();probe.delete();}}
const source=R.makeBox([0,0,0],[10,20,30]),original=source.serialize();
for(const clearance of [0,.5]){
 const rounded=encloseBody(source,2,{clearance}),explicit=encloseBody(source,2,{clearance,roundedCorners:true}),sharp=encloseBody(source,2,{clearance,roundedCorners:false});
 try{
  for(const shape of [rounded,explicit,sharp])valid(shape);
  near(R.measureVolume(rounded),R.measureVolume(explicit));
  const outside=2+clearance,inside=clearance;
  near(R.measureVolume(sharp),(10+2*outside)*(20+2*outside)*(30+2*outside)-(10+2*inside)*(20+2*inside)*(30+2*inside));
  assert.equal(filled(sharp,[-outside+.1,-outside+.1,15]),true,'OFF preserves a square outer corner');
  assert.equal(filled(rounded,[-outside+.1,-outside+.1,15]),false,'default keeps the rounded offset');
  assert.equal(filled(sharp,[5,10,15]),false,'storage cavity remains empty');
  const opening={point:[5,10,30],normal:[0,0,1]},open=encloseBody(source,2,{clearance,roundedCorners:false,faces:[opening]});
  try{valid(open);near(R.measureVolume(open),(10+2*outside)*(20+2*outside)*(30+outside)-(10+2*inside)*(20+2*inside)*(30+inside));assert.equal(filled(open,[5,10,29.9]),false,'top stays open');assert.equal(filled(open,[-outside+.1,-outside+.1,15]),true,'opening does not reintroduce rounded side corners');}finally{open.delete();}
  const parts=encloseParts(source,{thickness:2,clearance,roundedCorners:false,enclosureSplit:'XY',splitOffset:15});try{assert.equal(parts.length,2);parts.forEach(valid);near(parts.reduce((n,s)=>n+R.measureVolume(s),0),R.measureVolume(sharp));}finally{parts.forEach(s=>s.delete());}
 }finally{rounded.delete();explicit.delete();sharp.delete();}
}
assert.equal(source.serialize(),original,'source stays unchanged across offset modes');
const features=[{kind:'cadop',id:'source',outputs:[{id:'base',brep:original}],remove:[]}],spec={id:'sharp-enclosure',type:'enclose',target:'base',thickness:2,clearance:.5,roundedCorners:false},result=runOperation(features,spec),history=[...features,{kind:'cadop',id:spec.id,spec,...result}],reloaded=kernelBodies(JSON.parse(JSON.stringify(history)));
try{near(R.measureVolume(reloaded.get(spec.id)),5964);assert.equal(history.at(-1).spec.roundedCorners,false);}finally{reloaded.forEach(s=>s.delete());}
const cylinder=R.makeCylinder(10,20),cylindrical=encloseBody(cylinder,2,{roundedCorners:false});try{valid(cylindrical);near(R.measureVolume(cylindrical),Math.PI*(12**2*24-10**2*20));}finally{cylindrical.delete();cylinder.delete();}
for(const roundedCorners of [false,true]){const box=encloseBody(source,2,{boxMode:true,roundedCorners});try{near(R.measureVolume(box),5424);}finally{box.delete();}}
source.delete();
console.log('PASS rounded default/legacy compatibility, sharp corners and exact wall/clearance volumes, open top, split enclosure, preserved source curves, BOX invariance and saved spec/BREP reload');
