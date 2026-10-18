import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation} from '../src/kernel.js';
import {acceptedFilletSpec} from '../src/fillet-partial-confirm.js';
import {MachiningPreviewCache} from '../src/machining-preview-cache.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const outside=R.drawRoundedRectangle(120,45,22.5).sketchOnPlane('XY').extrude(50),shell=outside.shell(2,f=>f.inPlane('XY',50));
const features=[{id:'source',kind:'cadop',name:'円弧と直線のシェル',outputs:[{id:'body',brep:shell.serialize(),...shell.mesh()}],remove:[]}],before=JSON.stringify(features),checkpoints=[],events=[];
const spec={type:'fillet',target:'body',id:'preview',radius:2,partialMode:'offer'},started=performance.now();
const final=runOperation(features,{type:'preview',operation:spec},progress=>{events.push(progress.filletTrial);if(progress.filletCheckpoint)checkpoints.push(structuredClone(progress.filletCheckpoint));});
assert.ok(checkpoints.length>0);assert.equal(events.filter(e=>e==='start').length,4);assert.equal(events.filter(e=>e==='end').length,4);
for(const checkpoint of checkpoints){
 const info=checkpoint.analysis.partialFillet;assert.equal(info.accepted+info.skipped+info.untested,24);assert.equal(info.accepted,info.edges.length);assert.ok(checkpoint.outputs[0].triangles.length);assert.deepEqual(checkpoint.remove,[]);
 const output=R.deserializeShape(checkpoint.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(output.wrapped,true,false);
 try{
  assert.ok(check.IsValid(),'a recoverable checkpoint must already pass native geometry validation');
  const confirmed=acceptedFilletSpec(spec,info),replayed=runOperation(features,confirmed),replayShape=R.deserializeShape(replayed.outputs[0].brep).asShape3D();
  try{assert.ok(Math.abs(R.measureVolume(output)-R.measureVolume(replayShape))<1e-6,'checkpoint references must replay its exact validated geometry');}
  finally{replayShape.delete();}
  const cache=new MachiningPreviewCache();cache.store(features,spec,checkpoint);const applied=cache.get(features,{...spec,id:'committed'});
  assert.equal(applied.outputs[0].brep,checkpoint.outputs[0].brep);assert.equal(applied.removed,undefined);assert.equal(confirmed.partialMode,undefined);
 }finally{check.delete();output.delete();}
}
assert.equal(final.analysis.partialFillet.accepted,12);assert.equal(final.analysis.partialFillet.skipped,12);assert.equal(final.analysis.partialFillet.untested,0);assert.equal(JSON.stringify(features),before);
const thick=R.makeBox([200,0,0],[230,30,30]),multi=[{...features[0],outputs:[{id:'thick',brep:thick.serialize(),...thick.mesh()},...features[0].outputs]}],bodyCheckpoints=[];
try{
 runOperation(multi,{...spec,target:'thick',targets:['thick','body']},progress=>{if(progress.filletCheckpoint)bodyCheckpoints.push(progress.filletCheckpoint);});
 assert.equal(bodyCheckpoints[0].analysis.partialFillet.accepted,12);assert.deepEqual(bodyCheckpoints[0].analysis.partialFillet.pendingBodies,['body']);assert.deepEqual(bodyCheckpoints[0].outputs.map(o=>o.id),['thick'],'an earlier fully successful body remains recoverable if the next body stalls');
 assert.ok(bodyCheckpoints.some(c=>c.outputs.length===2));
}finally{thick.delete();}
console.log(JSON.stringify({checkpoints:checkpoints.length,nativeTrials:4,totalWithReplayChecksMs:Math.round(performance.now()-started)}));
shell.delete();outside.delete();console.log('PASS real native checkpoints, exact accepted-edge replay, cache confirmation and unchanged input history');
