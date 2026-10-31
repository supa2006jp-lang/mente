import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base={...defaults,id:'base',width:10,height:10,depth:10},cutter={...base,id:'tool'},cut={type:'join',target:'base',other:'tool',combineMode:'切り取り',keepTools:'削除'};
const volume=output=>{const shape=R.deserializeShape(output.brep).asShape3D();try{return R.measureVolume(shape);}finally{shape.delete();}};
for(const x of [30,10])for(const keepTools of ['保持','削除']){
 const history=[base,{...cutter,x}],saved=JSON.stringify(history);
 for(const spec of [{...cut,keepTools},{type:'preview',operation:{...cut,keepTools}}])assert.throws(()=>runOperation(history,spec),/重なっていません/,'disjoint and face-only contact must not become a successful cut');
 assert.equal(JSON.stringify(history),saved);const bodies=kernelBodies(history);try{assert.equal(bodies.size,2);for(const shape of bodies.values())assert.ok(Math.abs(R.measureVolume(shape)-1000)<1e-6);}finally{bodies.forEach(s=>s.delete());}
}
for(const keepTools of ['保持','削除']){const result=runOperation([base,{...cutter,x:9.99}],{...cut,keepTools});assert.ok(Math.abs(volume(result.outputs[0])-999)<1e-5);assert.deepEqual(result.remove,keepTools==='保持'?[]:['tool']);}
const clearance=runOperation([base,{...cutter,x:10.1}],{...cut,cutClearance:.2});assert.ok(volume(clearance.outputs[0])<1000,'offset clearance can turn a disjoint tool into a real cut');
const pipe={type:'pipe',id:'pipe',target:'base',diameter:2,operation:'切り取り'},path=x=>({...defaults,kind:'sketch',profile:'line',width:10,x,y:0,z:5});
for(const x of [30,11]){assert.throws(()=>runOperation([base],{...pipe,pathFeature:path(x)}),/重なっていません/);assert.throws(()=>runOperation([base],{type:'preview',operation:{...pipe,pathFeature:path(x)}}),/重なっていません/);}
const piped=runOperation([base],{...pipe,pathFeature:path(0)});assert.ok(Math.abs(volume(piped.outputs[0])-(1000-Math.PI*10))<1e-5);assert.equal(runOperation([base],{...pipe,operation:'新規ボディ',pathFeature:path(30)}).outputs.length,1);
const applied={kind:'cadop',id:'cut',spec:cut,...runOperation([base,{...cutter,x:5}],cut)},before=[base,{...cutter,x:5},applied],changed=structuredClone(before);changed[1].x=30;
assert.throws(()=>runOperation(changed,{type:'replay',before,start:1}),/重なっていません/,'history edits cannot silently remove a now-disjoint tool');
console.log('PASS no-op boolean and pipe cuts rejected in preview/commit/replay; source and tools preserved; valid shallow and clearance cuts retained');
