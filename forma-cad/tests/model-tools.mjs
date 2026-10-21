import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {validateProject} from '../src/geometry.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const feature=(shape,id='body')=>({kind:'cadop',id,name:id,outputs:[{id,brep:shape.serialize(),...shape.mesh()}],remove:[]});
const shapeOf=result=>R.deserializeShape(result.outputs[0].brep).asShape3D();
const near=(a,b,message='')=>assert(Math.abs(a-b)<1e-4,`${message}: ${a} vs ${b}`);
const box=(a,b)=>R.makeBox(a,b);
function hollowBox(){const outer=box([0,0,0],[40,30,20]),tool=box([2,2,2],[38,28,21]);try{return outer.cut(tool);}finally{outer.delete();tool.delete();}}
const original=hollowBox(),features=[feature(original)];
for(const [factor,wall,expected]of [[.25,1,10*7.5*5-8*5.5*4],[2,1,80*60*40-78*58*39],[.25,.5,(40*30*20-36*26*18)/64]]){
 const spec={type:'resize',targets:['body'],factor,keepWall:true,sourceWall:2,wall,pivot:[0,0,0]},result=runOperation(features,spec),shape=shapeOf(result);
 try{near(R.measureVolume(shape),expected,`hollow scale ${factor}, wall ${wall}`);const b=shape.boundingBox;try{near(b.bounds[1][0],40*factor);near(b.bounds[1][1],30*factor);near(b.bounds[1][2],20*factor);}finally{b.delete();}if(wall!==2*factor)assert.equal(result.analysis.resize.wallFaces,5);}finally{shape.delete();}
}
const result=runOperation(features,{type:'resize',targets:['body'],factor:.25,keepWall:true,sourceWall:2,wall:1,preview:true});assert(result.comparison.added.length);assert(result.comparison.removed.length);
assert.throws(()=>runOperation(features,{type:'resize',targets:['body'],factor:.25,keepWall:true,sourceWall:9,wall:1}),/特定できません/);
assert.throws(()=>runOperation(features,{type:'resize',targets:['body'],factor:.25,keepWall:true,sourceWall:2,wall:5}),/内側の空間|形状|外寸/);
assert.throws(()=>runOperation(features,{type:'resize',targets:['body'],factor:0}),/倍率/);
assert.throws(()=>runOperation(features,{type:'resize',targets:['missing'],factor:.25}),/選び直/);
const withHistory={format:'forma-cad',version:1,units:'mm',features:[...features,{kind:'cadop',id:'resize',name:'サイズ変更',spec:{type:'resize',id:'resize',targets:['body'],factor:.25,keepWall:true,sourceWall:2,wall:1},...result}]};validateProject(withHistory);const reloaded=kernelBodies(withHistory.features);near(R.measureVolume(reloaded.get('body')),199);for(const s of reloaded.values())s.delete();
// A closed hollow object has two shells, but one connected solid.
const outside=box([0,0,0],[20,20,20]),inside=box([2,2,2],[18,18,18]),closed=outside.cut(inside),detached=box([25,0,0],[30,5,5]),compound=R.makeCompound([closed.clone(),detached.clone()]);
let inspected=runOperation([feature(closed)],{type:'bodyComponents',targets:['body']});assert.equal(inspected.rows[0].count,1);
inspected=runOperation([feature(compound)],{type:'bodyComponents',targets:['body']});assert.equal(inspected.rows[0].count,2);assert.equal(inspected.disconnected,1);assert(inspected.rows[0].components.every(p=>p.vertices.length&&p.triangles.length));
// Exact symmetric difference when addition and removal happen in the same step.
const a=box([0,0,0],[10,10,10]),b=box([5,0,0],[15,10,10]),difference=runOperation([feature(b)],{type:'compareShapes',before:[feature(a)]});near(difference.volumes.added,500);near(difference.volumes.removed,500);
const unchanged=runOperation([feature(a,'new-id')],{type:'compareShapes',before:[feature(a,'old-id')]});near(unchanged.volumes.added,0);near(unchanged.volumes.removed,0);
const outerCylinder=R.makeCylinder(10,20),innerCylinder=R.makeCylinder(8,22,[0,0,-1]),tube=outerCylinder.cut(innerCylinder),tubeResult=runOperation([feature(tube)],{type:'resize',targets:['body'],factor:.25,keepWall:true,sourceWall:2,wall:1}),scaledTube=shapeOf(tubeResult);near(R.measureVolume(scaledTube),Math.PI*(2.5**2-1.5**2)*5,'tube wall');assert.equal(tubeResult.analysis.resize.wallFaces,1);
const slab=box([0,0,0],[40,40,8]),hole=R.makeCylinder(2,10,[20,20,-1]),plate=slab.cut(hole),holeResult=runOperation([feature(plate)],{type:'resize',targets:['body'],factor:.5,keepHoles:true}),keptHole=shapeOf(holeResult);near(R.measureVolume(keptHole),20*20*4-Math.PI*2**2*4,'hole diameter');assert.equal(holeResult.analysis.resize.holeFaces,1);
const first=box([0,0,0],[10,10,10]),second=box([10.2,0,0],[20.2,10,10]),gapResult=runOperation([feature(first,'a'),feature(second,'b')],{type:'resize',targets:['a','b'],factor:.25,keepGap:true,gap:.2});const gapA=R.deserializeShape(gapResult.outputs[0].brep),gapB=R.deserializeShape(gapResult.outputs[1].brep);near(R.measureDistanceBetween(gapA,gapB),.2,'assembly gap');assert.equal(gapResult.analysis.resize.gaps,1);
for(const s of [original,outside,inside,closed,detached,compound,a,b,outerCylinder,innerCylinder,tube,scaledTube,slab,hole,plate,keptHole,first,second,gapA,gapB])s.delete();
console.log('PASS wall-constrained reduction/enlargement, cylinders, hole diameter, gaps, validation, native connected solids, symmetric difference, renamed bodies and project round trip');
