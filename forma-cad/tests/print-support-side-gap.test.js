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
  after=makeWallSupports(bodies,validatePrintSupport({...spec,sideGap:.5,keepRibThickness:true}));
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

function roofWithWalls(axis,width,run){
 const point=(s,t,z)=>axis===0?[t,s,z]:[s,t,z];
 const roof=R.makeBox(point(0,-1,20),point(36,width+1,23));
 const nearWall=R.makeBox(point(0,-1,0),point(36,0,20));
 const farWall=R.makeBox(point(0,width,0),point(36,width+1,20));
 const joined=roof.fuse(nearWall),body=joined.fuse(farWall);
 try{run(new Map([['roof',body]]),{nearWall,farWall});}
 finally{[body,joined,farWall,nearWall,roof].forEach(shape=>shape.delete());}
}

const ribSpec={id:'ribs',target:'roof',style:'walls',baseMode:'bed',topGap:.3,wallPitch:5,wallDirection:'x',
 edgeMargin:.1,edgeRibs:true,wallThickness:.8,connectFeet:false,preview:true};
function withRibs(bodies,spec,check){
 const result=makeWallSupports(bodies,validatePrintSupport({...ribSpec,...spec}));
 try{check(result);}finally{result.shape?.delete();result.blockers.forEach(shape=>shape.delete());}
}
const widthOf=rib=>rib.bounds[1][rib.axis]-rib.bounds[0][rib.axis];

test('increasing clearance moves the outside ribs inward and preserves 0.8 mm thickness',()=>{
 for(const axis of [0,1])roofWithWalls(axis,12,(bodies,{nearWall,farWall})=>{
  const wallDirection=axis===0?'y':'x';
  withRibs(bodies,{wallDirection,sideGap:.5},({ribPreview})=>{
   near(widthOf(ribPreview[0]),.4);
   near(widthOf(ribPreview.at(-1)),.4);
  });
  for(const sideGap of [.5,.7,1,2])withRibs(bodies,{wallDirection,sideGap,keepRibThickness:true},result=>{
   assert.equal(result.ribPreview.length,4);
   for(const rib of result.ribPreview)near(widthOf(rib),.8);
   near(R.measureDistanceBetween(result.shape,nearWall),sideGap);
   near(R.measureDistanceBetween(result.shape,farWall),sideGap);
  });
 });
});

test('where a wall approaches part of a rib, clearance shortens the rib without leaving a thin strip',()=>{
 const roof=R.makeBox([0,0,20],[36,12,23]),wall=R.makeBox([0,-1,0],[16,0,20]);
 const boxes=[R.makeBox([3,.1,5],[4,.9,7]),R.makeBox([20,.1,5],[21,.9,7])];
 const bodies=new Map(Object.entries({roof,wall}));
 try{
  withRibs(bodies,{sideGap:.7,keepRibThickness:true},result=>{
   const outside=result.ribPreview[0];
   near(widthOf(outside),.8);
   assert.ok(outside.bounds[0][0]>=16-1e-6);
   for(const [index,box] of boxes.entries()){
    const common=result.shape.intersect(box);
    try{near(R.measureVolume(common),index===0?0:1.6);}finally{common.delete();}
   }
   assert.ok(R.measureDistanceBetween(result.shape,wall)>=.7-1e-5);
  });
 }finally{[...boxes,wall,roof].forEach(shape=>shape.delete());}
});

test('a strip too narrow for the nominal thickness is skipped',()=>{
 roofWithWalls(1,2.6,bodies=>{
  assert.throws(()=>withRibs(bodies,{sideGap:1,keepRibThickness:true},()=>{}),/指定した厚みと側壁との横すき間/);
 });
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
