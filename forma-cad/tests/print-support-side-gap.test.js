import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {validatePrintSupport} from '../src/print-support.js';
import {makeWallSupports} from '../src/print-support-walls.js';
import {createSupportSideGap} from '../src/print-support-side-gap.js';
import {bridgeRibSuggestion,nearestRibLanding,supportIntervals,supportMeshTriangles} from '../src/print-support-bridges.js';

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

test('a partial side wall starts a full-length rib at the clearance and the roof reaches that rib',()=>{
 for(const axis of [0,1])for(const fromLow of [true,false]){
  const point=(s,t,z)=>axis===0?[t,s,z]:[s,t,z];
  const roof=R.makeBox(point(0,0,20),point(36,12,23));
  const wall=R.makeBox(point(0,fromLow?-1:12,0),point(16,fromLow?0:13,20));
  const bodies=new Map(Object.entries({roof,wall})),sideGap=.7;
  try{
   withRibs(bodies,{sideGap,keepRibThickness:true,alignSideGapRibs:true,
    wallDirection:axis===0?'y':'x',wallRoof:true,wallOffset:.25},result=>{
    const {ribPreview,roofPreview,analysis}=result;
    const first=fromLow?ribPreview[0]:ribPreview.at(-1);
    const edge=fromLow?sideGap:12-sideGap;
    near(first.bounds[fromLow?0:1][axis],edge);
    near(first.bounds[0][1-axis],.1);
    near(first.bounds[1][1-axis],35.9);
    assert.equal(ribPreview.length,4);
    const pitch=ribPreview[1].center-ribPreview[0].center;
    for(const [index,rib] of ribPreview.entries()){
     near(widthOf(rib),.8);
     near(rib.center,ribPreview[0].center+index*pitch);
    }
    near(R.measureDistanceBetween(result.shape,wall),sideGap);
    const skin=roofPreview.parts.find(part=>part.role==='roof');
    near(skin.bounds[fromLow?0:1][axis],edge);
    assert.equal(analysis.sideGapAlignedCeilings,1);
   });
  }finally{wall.delete();roof.delete();}
 }
});

test('a wall anchors the first rib even with the open-edge setting off',()=>{
 const roof=R.makeBox([0,0,20],[36,12,23]),wall=R.makeBox([0,-1,0],[16,0,20]);
 const bodies=new Map(Object.entries({roof,wall}));
 try{
  withRibs(bodies,{sideGap:.7,keepRibThickness:true,alignSideGapRibs:true,edgeRibs:false},({ribPreview})=>{
   near(ribPreview[0].bounds[0][1],.7);
   assert.ok(ribPreview.length>=3);
   const pitch=ribPreview[1].center-ribPreview[0].center;
   assert.ok(pitch<=5+1e-6);
   for(const [i,rib] of ribPreview.entries())near(rib.center,ribPreview[0].center+i*pitch);
   assert.ok(ribPreview.at(-1).bounds[1][1]<11.9);
  });
 }finally{wall.delete();roof.delete();}
});

test('repositioning restores the roof when clearance removes an entire rib',()=>{
 const roof=R.makeBox([0,0,20],[36,4,22]);
 // Only a tiny remnant of the original outside rib fits past this corner.
 const wall=R.makeBox([0,-3,0],[35.9-Math.sqrt(3)-.000025,-.9,20]);
 const bodies=new Map(Object.entries({roof,wall}));
 const settings={sideGap:2,keepRibThickness:true,wallRoof:true,wallPitch:10};
 try{
  withRibs(bodies,settings,({ribPreview,analysis})=>{
   assert.equal(ribPreview.length,1);
   assert.equal(analysis.roof.count,0);
  });
  withRibs(bodies,{...settings,alignSideGapRibs:true},({ribPreview,analysis})=>{
   assert.equal(ribPreview.length,2);
   near(ribPreview[0].bounds[0][1],1.1);
   assert.equal(analysis.roof.count,1);
  });
 }finally{wall.delete();roof.delete();}
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

const sectional={sideGap:.7,keepRibThickness:true,alignSideGapRibs:true,sectionSideGapRibs:true,
 wallRoof:true,wallPitch:5,wallTies:true,tieInterval:8};

test('a stepped side wall starts a new evenly spaced row at the local clearance',()=>{
 const roof=R.makeBox([0,0,20],[36,12,23]);
 const front=R.makeBox([0,-2,0],[18,0,20]);
 const back=R.makeBox([18,-2,0],[36,1.5,20]);
 const wall=front.fuse(back),bodies=new Map(Object.entries({roof,wall}));
 try{
  withRibs(bodies,sectional,result=>{
   const {analysis,ribPreview,coverage}=result;
   assert.ok(analysis.sideGapSections>=2);
   const at=x=>ribPreview.filter(rib=>x>rib.bounds[0][0]&&x<rib.bounds[1][0]);
   for(const [x,edge] of [[5,.7],[27,2.2]]){
    const ribs=at(x);
    assert.ok(ribs.length>=3);
    near(ribs[0].bounds[0][1],edge);
    const pitch=ribs[1].center-ribs[0].center;
    for(const [i,rib] of ribs.entries()){
     near(widthOf(rib),.8);
     near(rib.center,ribs[0].center+i*pitch);
    }
    const skin=coverage[0].skinSupport.face,spans=supportIntervals(supportMeshTriangles(skin),0,x);
    near(spans[0][0],edge);
   }
   assert.ok(analysis.wallTies.count>0);
   near(R.measureDistanceBetween(result.shape,wall),.7);
   near(R.measureDistanceBetween(result.shape,roof),.3);
  });
 }finally{[wall,back,front,roof].forEach(body=>body.delete());}
});

test('curved side clearance repositions full-width ribs around the wall',()=>{
 const roof=R.makeBox([0,0,20],[36,12,23]);
 const wall=R.makeCylinder(5,20,[18,-2,0]);
 const bodies=new Map(Object.entries({roof,wall}));
 try{
  withRibs(bodies,sectional,result=>{
   const {analysis,ribPreview,coverage}=result;
   assert.ok(analysis.sideGapSections>=3);
   const edges=[5,18,31].map(x=>{
    const rib=ribPreview.find(rib=>x>rib.bounds[0][0]+1e-6&&x<rib.bounds[1][0]-1e-6);
    assert.ok(rib);
    return rib.bounds[0][1];
   });
   assert.ok(edges[1]>=3.7-1e-5&&edges[1]<4,JSON.stringify(edges));
   near(edges[0],.1);
   near(edges[2],.1);
   for(const rib of ribPreview)near(widthOf(rib),.8);
   assert.ok(coverage[0].skinSupport.face.triangles.length>0);
   assert.ok(R.measureDistanceBetween(result.shape,wall)>=.7-1e-5);
  });
 }finally{[wall,roof].forEach(body=>body.delete());}
});

test('lower side walls influence the layout even if they stop before the skin',()=>{
 const roof=R.makeBox([0,0,20],[12,36,23]);
 const front=R.makeBox([-2,0,0],[0,18,17]),back=R.makeBox([-2,18,0],[1.5,36,17]);
 const wall=front.fuse(back),bodies=new Map(Object.entries({roof,wall}));
 try{
  withRibs(bodies,{...sectional,wallDirection:'y',wallTies:false},({analysis,ribPreview,shape})=>{
   assert.ok(analysis.sideGapSections>=2);
   for(const [y,edge] of [[5,.7],[27,2.2]]){
    const at=ribPreview.filter(rib=>y>rib.bounds[0][1]&&y<rib.bounds[1][1]);
    near(at[0].bounds[0][0],edge);
    for(const rib of at)near(widthOf(rib),.8);
   }
   near(R.measureDistanceBetween(shape,wall),.7);
  });
 }finally{[wall,back,front,roof].forEach(body=>body.delete());}
});

test('skin inspection measures rib reach at the previous layer, with a short rib option',()=>{
 const roof=R.makeBox([0,0,20],[36,18,23]),wall=R.makeBox([0,-1,0],[16,0,20]);
 const bodies=new Map(Object.entries({roof,wall}));
 const spec={wallRoof:true,wallPitch:8,sideGap:.7,keepRibThickness:true};
 try{
  let suggestion,selection,beforeDistance;
  const point=[8,2];
  withRibs(bodies,spec,({coverage})=>{
   const row=coverage[0],layer=row.skinSupport;
   const unsupported=layer.bands.find(band=>band.risk==='edge'&&band.from<point[0]&&band.to>point[0]&&band.start<point[1]&&band.end>point[1]);
   assert.ok(unsupported);
   near(layer.face.vertices[2],19.1);
   near(row.face.vertices[2],20);
   const nearest=nearestRibLanding(layer.landings,point);
   beforeDistance=nearest.distance;
   assert.ok(beforeDistance>2);
   selection=row.selection;
   suggestion=bridgeRibSuggestion({...row,bridges:layer},point,'edge');
   assert.ok(suggestion?.rib);
  });
  withRibs(bodies,{...spec,faceOverrides:[{selection,localRibs:[suggestion.rib]}]},({coverage,ribPreview})=>{
   assert.ok(ribPreview.some(rib=>rib.local&&!rib.excluded));
   const nearest=nearestRibLanding(coverage[0].skinSupport.landings,point);
   assert.ok(nearest.distance<beforeDistance);
  });
 }finally{[wall,roof].forEach(body=>body.delete());}
});
