import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation} from '../src/kernel.js';
import {defaults,rebuild} from '../src/geometry.js';
import {planarFace} from '../src/frames.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const features=[
 {...defaults,id:'plate-sketch',name:'Plate sketch',kind:'sketch',profile:'rect',width:30,height:30,x:15,y:15},
 {...defaults,id:'plate',name:'Plate',kind:'extrusion',profile:'region',depth:2,region:{id:'plate-region',plane:'XY',offset:0,outer:[[0,0],[30,0],[30,30],[0,30]],holes:[],area:900,sourceIds:['plate-sketch']}},
 {...defaults,id:'hole',name:'Hole Ø10',kind:'extrusion',profile:'circle',plane:'CUSTOM',frame:{u:[1,0,0],v:[0,1,0],n:[0,0,1]},operation:'cut',target:'plate',diameter:10,x:15,y:15,z:2,depth:-20,hole:true},
];
const geometry=rebuild(features).get('plate').geometry,position=geometry.attributes.position,index=geometry.index;
let triangle=-1;
for(let i=0;i<(index?index.count:position.count);i+=3){
 if([0,1,2].every(j=>Math.abs(position.getZ(index?index.getX(i+j):i+j)-2)<1e-5)){triangle=i/3;break;}
}
assert.ok(triangle>=0,'a top face can be selected');
const region={...planarFace(geometry,triangle),bodyId:'plate',cadFace:{bodyId:'plate',point:[20,15,2],normal:[0,0,1]}};
assert.equal(region.holes.length,1);
assert.ok(region.holes[0].length>100,'the display contour is polygonal while the CAD hole is circular');
const baseVolume=2*(900-Math.PI*25),wallVolume=2*((900-26*26)+Math.PI*(7*7-5*5));
for(const [depth,operation,expected] of [[2,'join',baseVolume+wallVolume],[-2,'cut',baseVolume-wallVolume]]){
 const feature={...defaults,id:'thin',name:'Thin face extrusion',kind:'extrusion',profile:'region',plane:'CUSTOM',frame:region.frame,region,mode:'thin',side:'inside',wall:2,depth,operation,target:'plate'};
 const output=runOperation(features,{type:'extrusionBatch',features:[feature]}).features[0].cadResult.outputs[0];
 const shape=R.deserializeShape(output.brep).asShape3D();
 try{
  const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
  try{assert.ok(analyzer.IsValid(),'the result is a valid CAD solid');}
  finally{analyzer.delete();}
  const solids=shape.solids;
  try{assert.equal(solids.length,1,'the wall remains attached to the plate');}
  finally{for(const solid of solids)solid.delete();}
  assert.ok(Math.abs(R.measureVolume(shape)-expected)<.001,'exact circular opening and 2 mm wall are preserved');
 }finally{shape.delete();}
}
const raised={...defaults,id:'raised',name:'Full face extrusion',kind:'extrusion',profile:'region',plane:'CUSTOM',frame:region.frame,region,mode:'solid',depth:2,operation:'join',target:'plate'};
const raisedFeature=runOperation(features,{type:'extrusionBatch',features:[raised]}).features[0];
const stacked=[...features,raisedFeature];
const upperGeometry=rebuild(stacked).get('plate').geometry,upperPosition=upperGeometry.attributes.position,upperIndex=upperGeometry.index;
let upperTriangle=-1;
for(let i=0;i<(upperIndex?upperIndex.count:upperPosition.count);i+=3){
 if([0,1,2].every(j=>Math.abs(upperPosition.getZ(upperIndex?upperIndex.getX(i+j):i+j)-4)<1e-5)){upperTriangle=i/3;break;}
}
assert.ok(upperTriangle>=0,'the second extrusion has a selectable top face');
const upperRegion={...planarFace(upperGeometry,upperTriangle),bodyId:'plate',cadFace:{bodyId:'plate',point:[20,15,4],normal:[0,0,1]}};
const upperBaseVolume=4*(900-Math.PI*25);
for(const side of ['inside','center'])for(const [depth,operation] of [[2,'join'],[-2,'cut']]){
 if(operation==='cut'&&side!=='inside')continue;
 const feature={...defaults,id:'thin-raised',name:'Thin raised face',kind:'extrusion',profile:'region',plane:'CUSTOM',frame:upperRegion.frame,region:upperRegion,mode:'thin',side,wall:2,depth,operation,target:'plate'};
 const output=runOperation(stacked,{type:'extrusionBatch',features:[feature]}).features[0].cadResult.outputs[0];
 const shape=R.deserializeShape(output.brep).asShape3D();
 try{
  const analyzer=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
  try{assert.ok(analyzer.IsValid(),`stacked ${side} ${operation} remains a valid solid`);}
  finally{analyzer.delete();}
  const solids=shape.solids;
  try{assert.equal(solids.length,1,`stacked ${side} ${operation} remains connected`);}
  finally{for(const solid of solids)solid.delete();}
  const stripArea=side==='inside'?(900-26*26)+Math.PI*(7*7-5*5):(32*32-28*28)+Math.PI*(6*6-4*4);
  const expected=upperBaseVolume+(operation==='join'?1:-1)*stripArea*2;
  assert.ok(Math.abs(R.measureVolume(shape)-expected)<.001,`stacked ${side} ${operation} has the expected wall volume`);
 }finally{shape.delete();}
}
console.log('PASS exact hole-face thin join and cut, including a second extrusion, produce valid solids');
