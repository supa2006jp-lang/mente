import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {encloseBody} from '../src/enclose.js';
import {runOperation,featureSolid} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
import {fuseSolids} from '../src/solid-fuse.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const left=[5.441165258829186,19.950939282374232],baseFeature={...defaults,profile:'region',region:{plane:'XY',offset:0,outer:[[0,0],[110,0],[110,20],left],holes:[]},depth:20};
const original=featureSolid(baseFeature),normal=[-0.0004692173200123931,0.9999998899175472,0],shell=encloseBody(original,1.5,{roundedCorners:false,faces:[{point:[85.36305144193736,19.988439915751997,12.65712569851894],normal}]}),parts=shell.solids;
assert.equal(parts.length,1);const body=parts[0];
const length=Math.hypot(30,110),offset=[-3*110/length,3*30/length],center=[30+offset[0]/2,110+offset[1]/2],start=Math.atan2(-offset[1],-offset[0]),arc=Array.from({length:66},(_,i)=>[center[0]+1.5*Math.cos(start+Math.PI*i/65),center[1]+1.5*Math.sin(start+Math.PI*i/65)]);
const region={id:'closed-strip',plane:'XY',offset:0,outer:[offset,[0,0],left,...arc],holes:[],sourceIds:[]},toolFeature={...defaults,id:'extension',kind:'extrusion',profile:'region',region,depth:20,operation:'join',target:'shell',targetAllBodies:true},tool=featureSolid(toolFeature);
const sourceVolume=R.measureVolume(shell),sourceBounds=shell.boundingBox.bounds,toolVolume=R.measureVolume(tool),common=body.intersect(tool),expected=sourceVolume+toolVolume-R.measureVolume(common);
const history=[{kind:'cadop',id:'source',name:'enclosure',outputs:[{id:'shell',...shell.mesh(),brep:shell.serialize()}],remove:[]}];
const check=result=>{
 const analyzer=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false),solids=result.solids;
 try{assert.ok(analyzer.IsValid());assert.equal(solids.length,1);assert.ok(Math.abs(R.measureVolume(result)-expected)<.001);assert.ok(solidMeshComplete(result));for(const source of [body,tool]){const missing=source.cut(result);try{assert.ok(Math.abs(R.measureVolume(missing))<.001,'union preserves both inputs');}finally{missing.delete();}}}
 finally{analyzer.delete();solids.forEach(s=>s.delete());}
};
try{
 for(const all of [false,true]){const result=runOperation(history,{type:'extrusion',target:'shell',feature:{...toolFeature,targetAllBodies:all}}),joined=R.deserializeShape(result.outputs[0].brep).asShape3D();try{check(joined);}finally{joined.delete();}}
 const batch=fuseSolids([shell,tool]);try{check(batch);}finally{batch.delete();}
 assert.equal(R.measureVolume(shell),sourceVolume);assert.deepEqual(shell.boundingBox.bounds,sourceBounds);assert.equal(R.measureVolume(tool),toolVolume);
 console.log('PASS enclosed-body extrusion and batch joins, one valid solid, all material preserved, complete mesh, original inputs retained');
}finally{common.delete();tool.delete();parts.forEach(s=>s.delete());shell.delete();original.delete();}
