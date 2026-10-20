import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
const oc=await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')});R.setOC(oc);
const box={...defaults,id:'b',kind:'extrusion',name:'プル確認',width:30,height:30,depth:8};
function shapeOf(result){return R.deserializeShape(result.outputs[0].brep).asShape3D();}
function valid(shape){const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{assert.ok(check.IsValid());assert.equal(shape.solids.length,1);}finally{check.delete();}}
const faces=[{point:[0,0,8],normal:[0,0,1],area:900,axis:2,bound:1},{point:[0,0,0],normal:[0,0,-1],area:900,axis:2,bound:0},{point:[15,0,4],normal:[1,0,0],area:240,axis:0,bound:1},{point:[-15,0,4],normal:[-1,0,0],area:240,axis:0,bound:0},{point:[0,15,4],normal:[0,1,0],area:240,axis:1,bound:1},{point:[0,-15,4],normal:[0,-1,0],area:240,axis:1,bound:0}];
for(const face of faces)for(const distance of [.2,-.2]){
 const result=runOperation([box],{type:'pull',distance,faces:[{bodyId:'b',point:face.point,normal:face.normal}]}),shape=shapeOf(result);
 try{valid(shape);assert.ok(Math.abs(R.measureVolume(shape)-(7200+face.area*distance))<1e-6);const extent=shape.boundingBox.bounds[face.bound][face.axis];assert.ok(Math.abs(extent-(face.point[face.axis]+face.normal[face.axis]*distance))<1e-6,'the chosen face moves in its own outward direction');}finally{shape.delete();}
}
for(const distance of [.2,-.2]){const result=runOperation([box],{type:'pull',distance,faces:[faces[0],faces[2]].map(f=>({bodyId:'b',point:f.point,normal:f.normal}))}),shape=shapeOf(result);try{valid(shape);assert.ok(distance*(R.measureVolume(shape)-7200)>0);}finally{shape.delete();}}
const hole={...defaults,id:'h',kind:'extrusion',profile:'circle',diameter:10,z:8,depth:-8,operation:'cut',target:'b'};
const ring=runOperation([box,hole],{type:'pull',distance:.2,faces:[{bodyId:'b',point:[10,0,8],normal:[0,0,1]}]}),ringShape=shapeOf(ring);try{valid(ringShape);assert.ok(Math.abs(R.measureVolume(ringShape)-(900-Math.PI*25)*8.2)<1e-5,'a hole in the pulled planar face stays open');}finally{ringShape.delete();}
const pullSpec={type:'pull',distance:.2,faces:[{bodyId:'b',point:[0,0,8],normal:[0,0,1]}]},first=runOperation([box],pullSpec),saved=JSON.parse(JSON.stringify([box,{kind:'cadop',id:'pull-1',spec:pullSpec,...first}]));
const second=runOperation(saved,{...pullSpec,faces:[{bodyId:'b',point:[0,0,8.2],normal:[0,0,1]}]}),secondShape=shapeOf(second);try{valid(secondShape);assert.ok(Math.abs(R.measureVolume(secondShape)-7560)<1e-6);}finally{secondShape.delete();}
console.log('PASS positive/negative pulls on all six planar normals, valid connected solids, selected bounds, multiple faces, hole preservation and saved repeated pull');
