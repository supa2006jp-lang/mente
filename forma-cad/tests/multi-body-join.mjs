import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {fuseSolids,fuseSolid} from '../src/solid-fuse.js';
import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const oc=R.getOC(),near=(a,b)=>assert.ok(Math.abs(a-b)<Math.max(1e-5,Math.abs(b)*1e-8),a+' != '+b);
function verify(shape){const check=new oc.BRepCheck_Analyzer(shape.wrapped,true,false);try{assert.ok(check.IsValid());assert.ok(shape.mesh().triangles.length);}finally{check.delete();}}
const boxes=[0,10,20,30].map(x=>R.makeBox([x,0,0],[x+10,10,10]));
for(const indices of [[0,1,2,3],[0,3,2,1],[3,1,0,2]]){const result=fuseSolids(indices.map(i=>boxes[i]));try{near(R.measureVolume(result),4000);verify(result);const solids=result.solids;assert.equal(solids.length,1,'a connected chain fuses regardless of selection order');solids.forEach(s=>s.delete());}finally{result.delete();}}
const plate=R.makeBox([-30,-20,0],[30,20,4]),ringOuter=R.makeCylinder(15,18,[0,0,3]),ringInner=R.makeCylinder(12,20,[0,0,2]),ring=ringOuter.cut(ringInner);
ringOuter.delete();ringInner.delete();
const braces=[-1,1].map(sign=>{const block=R.makeBox([sign<0?-22:10,-3,3],[sign<0?-10:22,3,13]),hole=R.makeCylinder(2,8,[sign*18,-4,8],[0,1,0]);try{return block.cut(hole);}finally{block.delete();hole.delete();}});
const complex=[plate,ring,...braces],snapshots=complex.map(s=>s.serialize());
const before=performance.now(),batch=fuseSolids(complex),batchMs=performance.now()-before;
assert.ok(complex.every((s,i)=>s.serialize()===snapshots[i]),'boolean building never mutates cached inputs');
const metrics=complex.map(s=>[R.measureVolume(s),s.faces.length]);
let sequential=complex[0].clone();const sequentialStart=performance.now();try{for(const part of complex.slice(1)){const next=fuseSolid(sequential,part);sequential.delete();sequential=next;}near(R.measureVolume(batch),R.measureVolume(sequential));verify(batch);}finally{sequential.delete();}
console.log('Four hollow / drilled bodies: batch '+Math.round(batchMs)+' ms, sequential '+Math.round(performance.now()-sequentialStart)+' ms');
batch.delete();assert.deepEqual(complex.map(s=>[R.measureVolume(s),s.faces.length]),metrics,'meshing the result can cache triangulations but cannot change input geometry');
const features=[{kind:'cadop',id:'source',outputs:complex.map((s,i)=>({id:'body-'+i,brep:s.serialize()})),remove:[]}],progress=[],spec={type:'join',id:'joined',target:'body-0',others:['body-3','body-1','body-2','body-1'],combineMode:'結合'};
const result=runOperation(features,spec,p=>progress.push(p));assert.deepEqual(result.remove,['body-3','body-1','body-2']);assert.equal(result.outputs.length,1);assert.equal(result.outputs[0].id,'body-0');assert.ok(progress.some(p=>p.stage.includes('4個'))&&progress.at(-1).stage.includes('表示データ'));
const kept=runOperation(features,{...spec,keepTools:'保持'});assert.deepEqual(kept.remove,[]);
const intersect=runOperation(features,{...spec,combineMode:'交差'});const intersection=R.deserializeShape(intersect.outputs[0].brep).asShape3D();verify(intersection);intersection.delete();
assert.throws(()=>runOperation(features,{...spec,others:['missing']}),/別のボディ/);assert.deepEqual(complex.map(s=>[R.measureVolume(s),s.faces.length]),metrics);
for(const shape of [...boxes,...complex])shape.delete();
console.log('PASS four-body touching chain and selection order, hollow/drilled geometry, exact union volume, input preservation, progress, retained tools, intersection and invalid selection');
