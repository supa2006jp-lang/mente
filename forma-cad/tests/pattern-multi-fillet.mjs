import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {edgeTreatmentBodyIds,edgeTreatmentSpec} from '../src/edge-treatment-selection.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {MachiningPreviewCache} from '../src/machining-preview-cache.js';
import {validateProject} from '../src/geometry.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([0,0,0],[10,10,10]),other=R.makeBox([500,0,0],[510,10,10]),seed={kind:'cadop',id:'seed',name:'原型',outputs:[{id:'body',...box.mesh(),brep:box.serialize()},{id:'other',...other.mesh(),brep:other.serialize()}],remove:[]};box.delete();other.delete();
for(const distribution of ['spacing','between']){
 const pattern={type:'rectangular',id:'pattern',target:'body',distribution,count:4,count2:1,spacing:20,spacing2:20,operation:'新規ボディ',...(distribution==='between'?{betweenAlignment:'inside',startPoint:[0,0,5],endPoint:[60,0,5],patternAnchor:[5,5,5],patternExtent:{min:-5,max:5}}:{})},made=runOperation([seed],pattern),history=[seed,{kind:'cadop',id:'pattern',name:'矩形状パターン',spec:pattern,...made}],ids=[...new Set(['body',...made.outputs.map(o=>o.id)])],snapshot=JSON.stringify(history);
 assert.equal(ids.length,4);const faces=ids.flatMap(bodyId=>Array.from({length:6},()=>({bodyId}))),selected={bodyIds:[],faces,allBodies:true};
 assert.deepEqual(edgeTreatmentBodyIds(selected),ids);assert.deepEqual(edgeTreatmentBodyIds({bodyIds:[ids[0],ids[0]],faces}),ids);
 const operation=edgeTreatmentSpec({id:'machining-preview',type:'fillet',target:ids.at(-1),radius:2,partialMode:'offer'},selected);assert.deepEqual(operation.targets,ids);
 assert.deepEqual(edgeTreatmentSpec(operation,{bodyIds:ids,allBodies:true}).targets,ids);
 const preview=runOperation(history,{type:'preview',operation}),cache=new MachiningPreviewCache();cache.store(history,operation,preview);const savedSpec={...operation,id:'fillet'};delete savedSpec.partialMode;const applied=cache.get(history,{...savedSpec,partialMode:'offer'});assert.ok(applied);assert.deepEqual(applied.outputs.map(o=>o.id),ids);assert.equal(applied.outputs.length,4);
 const volumes=[];for(const output of applied.outputs){const shape=R.deserializeShape(output.brep).asShape3D();volumes.push(R.measureVolume(shape));const valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);assert.ok(valid.IsValid());valid.delete();shape.delete();}assert.ok(volumes.every(v=>v<1000));volumes.forEach(v=>near(v,volumes[0]));
 assert.equal(JSON.stringify(history),snapshot);const project=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[...history,{kind:'cadop',id:'fillet',name:'フィレット',spec:savedSpec,...applied}]}))),bodies=kernelBodies(project);assert.equal(bodies.size,5);near(R.measureVolume(bodies.get('other')),1000);for(const shape of bodies.values())shape.delete();
 const single=edgeTreatmentSpec(operation,{...selected,allBodies:false});assert.equal(single.targets,undefined);assert.equal(single.target,ids.at(-1));
 const face={bodyId:ids[0],plane:'XY',offset:10};assert.deepEqual(edgeTreatmentSpec(operation,{face}).face,face);
 const edges=[{bodyId:ids[1],point:[25,0,5]}],specific=edgeTreatmentSpec(operation,{...selected,edges});assert.equal(specific.targets,undefined);assert.deepEqual(specific.edges,edges);assert.equal(specific.target,ids[1]);
 const chamfer=runOperation(history,edgeTreatmentSpec({type:'chamfer',target:ids.at(-1),distance:1},selected));assert.deepEqual(chamfer.outputs.map(o=>o.id),ids);for(const output of chamfer.outputs){const shape=R.deserializeShape(output.brep).asShape3D();assert.ok(R.measureVolume(shape)<1000);shape.delete();}
}
console.log('PASS four patterned bodies from 24 selected faces, full/inside patterns, identical valid fillets on all four, preview/cache/commit IDs, single-body opt-out, explicit edge/face scope, unchanged unrelated body and saved project reload');
