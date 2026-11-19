import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {validatePrintSupport} from '../src/print-support.js';
import {makeWallSupports} from '../src/print-support-walls.js';
import {createSupportSideGap} from '../src/print-support-side-gap.js';

R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))}));
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-5,actual+' != '+expected);

test('ribs, foot and skins keep a side gap and retain their floor and ceiling placement',()=>{
 const roof=R.makeBox([0,0,20],[32,32,23]);
 const wall=R.makeBox([0,0,2],[4,32,20]);
 const post=R.makeCylinder(2.5,18,[14,16,2]);
 const floor=R.makeBox([0,0,0],[32,32,2]);
 const bodies=new Map(Object.entries({roof,wall,post,floor}));
 const spec={id:'ribs',target:'roof',style:'walls',baseMode:'bedOrModel',topGap:.3,wallPitch:5,wallDirection:'x',
  edgeMargin:.1,wallRoof:true,wallBottomSkin:true,wallTies:true,tieInterval:8,wallWindows:true,
  contactLines:true,topContactRim:true,preview:true};
 let before,after;
 try{
  before=makeWallSupports(bodies,validatePrintSupport(spec));
  assert.ok(R.measureDistanceBetween(before.shape,wall)<.002);
  assert.ok(R.measureDistanceBetween(before.shape,post)<.002);
  after=makeWallSupports(bodies,validatePrintSupport({...spec,sideGap:.5}));
  near(R.measureDistanceBetween(after.shape,wall),.5);
  near(R.measureDistanceBetween(after.shape,post),.5);
  near(R.measureDistanceBetween(after.shape,roof),.3);
  near(R.measureDistanceBetween(after.shape,floor),0);
  assert.ok(after.analysis.roof.count);
  assert.ok(after.analysis.bottomSkin.count);
  assert.equal(after.analysis.sideGap,.5);
  assert.throws(()=>validatePrintSupport({...spec,sideGap:-.1}),/側壁/);
  assert.throws(()=>validatePrintSupport({...spec,sideGap:2.1}),/側壁/);
 }finally{
  for(const result of [before,after])if(result){result.shape.delete();result.blockers.forEach(shape=>shape.delete());}
  bodies.forEach(body=>body.delete());
 }
});

test('diagonal clearance covers the outside corner of a planar wall',()=>{
 const wall=R.makeBox([0,0,0],[5,5,8]),sample=R.makeBox([5,5,2],[7,7,6]);
 const guard=createSupportSideGap(new Map([['wall',wall]]),[[5,5,2],[7,7,6]],.5);
 const cuts=[];
 try{
  const trimmed=guard.trim(sample,shape=>{cuts.push(shape);return shape;});
  near(R.measureDistanceBetween(trimmed,wall),.5);
 }finally{cuts.forEach(solid=>solid.delete());guard.dispose();sample.delete();wall.delete();}
});
