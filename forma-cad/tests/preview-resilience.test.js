import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {KernelClient} from '../src/kernel-client.js';
import {clearPreviewTimeouts,PreviewTimeoutCache,previewTimeoutKey} from '../src/preview-timeout-cache.js';
import {analyzeSketchRegions,needsBackgroundSketchAnalysis,sketchAnalysisBodies} from '../src/sketch-region-analysis.js';
import {findRegions} from '../src/regions.js';import {defaults} from '../src/geometry.js';

test('a timed-out preview is suppressed only for its document and settings; retries and commits still run',async()=>{
 clearPreviewTimeouts();const workers=[],client=new KernelClient(()=>{const w={postMessage(m){this.last=m;},terminate(){this.dead=true;}};workers.push(w);return w;}),document=[],spec={type:'preview',operation:{type:'shell',id:'a',target:'box',thickness:1}};
 await assert.rejects(client.run(document,spec,{timeout:5}),{code:'timeout'});assert.equal(workers.length,1);
 await assert.rejects(client.run(document,{type:'preview',operation:{...spec.operation,id:'b'}},{timeout:5}),{code:'preview-timeout-cached'});assert.equal(workers.length,1);
 const changed=client.run(document,{type:'preview',operation:{...spec.operation,thickness:2}});workers.at(-1).onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await changed;
 const commit=client.run(document,spec.operation,{timeout:5});assert.equal(client.pending.get(client.active).timeout,90000);workers.at(-1).onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await commit;
 const retry=client.run(document,spec,{retry:true});workers.at(-1).onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await retry;client.reset();
});
test('only the timed-out active preview is remembered, not queued previews or cancellation',async()=>{
 clearPreviewTimeouts();const client=new KernelClient(()=>({postMessage(m){this.last=m;},terminate(){}})),document=[],a={type:'preview',operation:{type:'fillet',radius:1}},b={type:'preview',operation:{type:'fillet',radius:2}};
 const first=client.run(document,a,{timeout:5}),failed=assert.rejects(first,{code:'timeout'}),next=client.run(document,b),stopped=assert.rejects(next,{code:'timeout'});await Promise.all([failed,stopped]);const rerun=client.run(document,b);assert.ok(client.worker);client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await rerun;
 const cancelled=client.run(document,b),cancelledCheck=assert.rejects(cancelled,{code:'cancelled'});client.reset();await cancelledCheck;const afterCancel=client.run(document,b);client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await afterCancel;client.reset();
});
test('explicit automatic previews keep their native request and share timeout policy across clients',async()=>{
 clearPreviewTimeouts();const document=[],history=[],spec={type:'storageTray',id:'draft',wall:2},client=new KernelClient(()=>({postMessage(m){this.last=m;},terminate(){}}));
 await assert.rejects(client.run(history,spec,{automaticPreview:true,document,timeout:5}),{code:'timeout'});
 const another=new KernelClient(()=>{throw Error('must not start');});await assert.rejects(another.run([],{...spec,id:'new'},{automaticPreview:true,document}),{code:'preview-timeout-cached'});
 const otherDocument=client.run([],spec,{automaticPreview:true,document:[]});assert.equal(client.worker.last.spec.type,'storageTray');client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await otherDocument;client.reset();
 const cache=new PreviewTimeoutCache();for(let i=0;i<20;i++)cache.remember(document,'key'+i);assert.equal(cache.has(document,'key0'),false);assert.equal(cache.has(document,'key19'),true);assert.equal(previewTimeoutKey({type:'shell'}),null);assert.equal(previewTimeoutKey({type:'nativeExtrusionProbe',feature:{id:'a',depth:1}}),previewTimeoutKey({type:'nativeExtrusionProbe',feature:{id:'b',depth:1}}));
});
test('background region analysis matches closed regions and solid partitions while preserving inputs',()=>{
 const points=Array.from({length:600},(_,i)=>{const a=i*Math.PI/300;return [20*Math.cos(a),10*Math.sin(a)];}),features=[{...defaults,kind:'sketch',profile:'polyline',closed:true,id:'ellipse',points},{...defaults,kind:'sketch',profile:'circle',id:'hole',diameter:4}],original=JSON.stringify(features),mesh=new THREE.Mesh(new THREE.BoxGeometry(15,40,10));mesh.position.set(10,0,5);const bodies=sketchAnalysisBodies(new Map([['box',mesh]]));
 try{assert.equal(needsBackgroundSketchAnalysis(features),true);assert.equal(needsBackgroundSketchAnalysis([{...defaults,kind:'sketch',profile:'rect'}]),false);const expected=findRegions(features),result=analyzeSketchRegions({features,bodies});assert.deepEqual(result.regions,expected);assert.ok(result.overlap.length>0);assert.equal(result.faces.length,result.regions.length+result.overlap.length);assert.ok(result.faces.every(f=>f.positions.length>0));assert.equal(JSON.stringify(features),original);}finally{mesh.geometry.dispose();mesh.material.dispose();}
});

test('an automatic fillet preview with no completed trial is suppressed after its trial deadline',async()=>{
 clearPreviewTimeouts();const client=new KernelClient(()=>({postMessage(){},terminate(){}}),{filletTrialTimeout:5}),document=[],spec={type:'preview',operation:{type:'fillet',partialMode:'offer',radius:2,target:'box'}},pending=client.run(document,spec),stopped=assert.rejects(pending,{code:'fillet-budget'});
 client.worker.onmessage({data:{id:client.active,progress:{filletTrial:'start'}}});await stopped;await assert.rejects(client.run(document,spec),{code:'preview-timeout-cached'});client.reset();
});
