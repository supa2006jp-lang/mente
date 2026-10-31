import test from 'node:test';
import assert from 'node:assert/strict';
import {PreviewResultGuard,resultSnapshot,assertPreviewResult} from '../src/preview-result-guard.js';
import {MachiningPreviewCache} from '../src/machining-preview-cache.js';
import {KernelClient,subscribeKernelActivity} from '../src/kernel-client.js';
const result=(id='body',volume=1000)=>({outputs:[{id,brep:'native',shapeMetrics:{version:1,volume,solids:1,bounds:[[0,0,0],[10,10,10]]}}],remove:[]});
const spec={type:'shell',id:'preview',target:'body',thickness:1,direction:'内側',faces:[{point:[0,0,10],normal:[0,0,1]}]};
test('measure volume, bounds, solid counts, output/deletion IDs independently',()=>{
 const expected=resultSnapshot(result(),spec);
 for(const change of [r=>r.outputs[0].shapeMetrics.volume=500,r=>r.outputs[0].shapeMetrics.bounds[1][0]=12,r=>r.outputs[0].shapeMetrics.solids=2,r=>r.outputs=[],r=>r.remove=['other'],r=>delete r.outputs[0].shapeMetrics]){
  const actual=result();change(actual);assert.throws(()=>assertPreviewResult(expected,resultSnapshot(actual,spec)),e=>e.code==='preview-mismatch'&&e.diagnostics.certainty==='measured');
 }
 assert.equal(assertPreviewResult(expected,resultSnapshot(result('body',1000+1e-7),spec)).measured,1);
});
test('only match the same immutable history and complete semantic settings',()=>{
 const guard=new PreviewResultGuard(),history=[];guard.accept(history,{type:'preview',operation:spec},result());
 assert.throws(()=>guard.accept(history,{...spec,id:'commit'},result('body',500)),/プレビューと確定結果/);
 for(const patch of [{thickness:2},{direction:'外側'},{faces:[{point:[0,0,0],normal:[0,0,-1]}]},{target:'other'}])assert.doesNotThrow(()=>guard.accept(history,{...spec,...patch},result('body',500)));
 assert.doesNotThrow(()=>guard.accept([...history],spec,result('body',500)));
 assert.doesNotThrow(()=>guard.accept(history,{...spec,id:'commit'},result()));
});
test('new generated IDs may change but source body IDs may not',()=>{
 const guard=new PreviewResultGuard(),history=[],copy={type:'mirror',id:'p',target:'body',plane:'YZ',offset:0};
 guard.accept(history,{type:'preview',operation:copy},result('p'));
 assert.equal(guard.accept(history,{...copy,id:'c'},result('c')).measured,1);
 assert.throws(()=>guard.accept(history,{...copy,id:'c'},result('body')),/一致しない/);
 const shell={...spec,id:'body'};guard.accept(history,{type:'preview',operation:shell},result());assert.doesNotThrow(()=>guard.accept(history,shell,result()));
});
test('complete extrusion previews compare final writes, ignore intermediate tools and names',()=>{
 const history=[],guard=new PreviewResultGuard(),batch=[{id:'first',name:'A',operation:'join',target:'body',depth:2},{id:'second',name:'B',operation:'new',depth:3}];
 const first=result('body',1200),second=result('second',80),preview={features:[{...batch[0],cadResult:first},{...batch[1],cadResult:second}],outputs:[{id:'body'},{id:'second'}],remove:[],exact:true};
 guard.accept(history,{type:'exactExtrusionPreview',features:batch},preview);
 const commitBatch=batch.map((f,i)=>({...f,id:'commit'+i,name:'renamed'})),commit={features:[{...commitBatch[0],cadResult:first},{...commitBatch[1],cadResult:result('commit1',80)}]};
 assert.equal(guard.accept(history,{type:'extrusionBatch',features:commitBatch},commit).measured,2);
 commit.features[0].cadResult=result('body',1100);assert.throws(()=>guard.accept(history,{type:'extrusionBatch',features:commitBatch},commit),/一致しない/);
 assert.equal(resultSnapshot({contactOnly:true},spec),null);
 assert.equal(resultSnapshot(result(),{type:'exactExtrusionPreview',features:batch,editingId:'old'}),null,'edited previews contain successors, unlike a replacement batch');
});
test('preview cache notices changed measurements before it can modify the project',()=>{
 const history=[],cache=new MachiningPreviewCache(),preview=result();cache.store(history,spec,preview);preview.outputs[0].shapeMetrics.volume=20;
 assert.throws(()=>cache.get(history,{...spec,id:'commit'}),e=>e.localVerification&&e.code==='preview-mismatch');
});
test('cross-worker comparison rejects before resolution, records one error and keeps queue usable',async()=>{
 const workers=[],events=[],off=subscribeKernelActivity(e=>events.push(e));
 const create=()=>new KernelClient(()=>{const w={postMessage(message){this.last=message;},terminate(){}};workers.push(w);return w;});
 const a=create(),b=create(),history=[];
 try{
  const preview=a.run(history,{type:'preview',operation:spec});workers[0].onmessage({data:{id:1,result:result()}});await preview;
  const bad=b.run(history,spec),next=b.run(history,{type:'move'});workers[1].onmessage({data:{id:1,result:result('body',500)}});await assert.rejects(bad,e=>e.code==='preview-mismatch');
  assert.equal(workers[1].last.id,2);workers[1].onmessage({data:{id:2,result:{ok:true}}});assert.deepEqual(await next,{ok:true});
  assert.deepEqual(events.filter(e=>e.client===b&&e.id===1&&['completed','error'].includes(e.state)).map(e=>e.state),['error']);
 }finally{off();a.reset();b.reset();}
});
