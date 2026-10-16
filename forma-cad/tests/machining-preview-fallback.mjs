import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {runOperation} from '../src/kernel.js';
import {MachiningPreviewCache} from '../src/machining-preview-cache.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([0,0,0],[30,20,12]),history=[{kind:'cadop',id:'seed',outputs:[{id:'body',brep:box.serialize(),...box.mesh()}],remove:[]}],snapshot=JSON.stringify(history),spec={type:'fillet',id:'round',target:'body',radius:2,edges:[{bodyId:'body',point:[15,0,12],a:[0,0,12],b:[30,0,12]}]};
const normal=runOperation(history,{type:'preview',operation:spec});
assert.equal(normal.removed.length,1,'ordinary removed-material colouring is retained');assert.equal(normal.previewWarnings,undefined);
// Fault injection is confined to the independent overlay boolean: the native
// fillet and its validity checks still run normally in every case below.
const originalCut=R.Solid.prototype.cut;
try{
 for(const cut of [function(){throw Error('overlay boolean failed');},function(){return box.clone();}]){
  R.Solid.prototype.cut=cut;
  const preview=runOperation(history,{type:'preview',operation:spec});
  assert.equal(preview.removed.length,0);assert.equal(preview.previewWarnings[0].code,'removed-preview-unavailable');assert.equal(preview.previewWarnings[0].bodyId,'body');assert.equal(preview.analysis.fillets[0].radius,2);
  const result=R.deserializeShape(preview.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(result.wrapped,true,false);
  try{assert.ok(check.IsValid());assert.ok(Math.abs(R.measureVolume(result)-(30*20*12-30*4*(1-Math.PI/4)))<1e-6);}finally{check.delete();result.delete();}
  const cache=new MachiningPreviewCache();cache.store(history,spec,preview);const commit=cache.get(history,{...spec,id:'confirmed'});
  assert.deepEqual(commit.outputs,preview.outputs,'confirmation reuses the exact successful shape');assert.equal(commit.previewWarnings,undefined,'overlay notices are not stored in committed history');assert.equal(commit.removed,undefined);
  assert.throws(()=>runOperation(history,{type:'preview',operation:{...spec,radius:100}}),error=>error.code==='fillet-geometry','a genuine machining failure is never converted to a warning');
 }
 R.Solid.prototype.cut=function(){throw new WebAssembly.RuntimeError('memory access out of bounds');};
 assert.throws(()=>runOperation(history,{type:'preview',operation:spec}),WebAssembly.RuntimeError,'fatal native errors must reach the worker restart handler');
}finally{R.Solid.prototype.cut=originalCut;box.delete();}
assert.equal(JSON.stringify(history),snapshot,'preview and failed overlay preserve input history');
console.log('PASS exact native fillet, removed-overlay failure and volume mismatch fallback, confirmation cache, real machining errors, fatal errors and unchanged input');
