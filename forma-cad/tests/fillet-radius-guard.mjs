import assert from 'node:assert/strict';
import {KernelClient} from '../src/kernel-client.js';
const workers=[],client=new KernelClient(()=>{const w={postMessage(){},terminate(){this.dead=true;}};workers.push(w);return w;},{filletTrialTimeout:15});
const spec={type:'filletRadiusSearch',operation:{type:'fillet',target:'a',targets:['a','b'],radius:2}},features=[{id:'unchanged'}];
const checkpoint={outputs:[{id:'a',brep:'a-rounded'},{id:'b',brep:'b-rounded'}],remove:[],removed:[],analysis:{fillets:[{bodyId:'a',edges:12},{bodyId:'b',edges:12}],filletRadiusSearch:{radius:.5,upperRadius:2,resolution:.01,bodies:2,edges:24,attempts:3}}};
const events=[],job=client.run(features,spec,{onProgress:p=>events.push(p)}),w=workers[0];
w.onmessage({data:{id:1,progress:{filletRadiusCheckpoint:checkpoint}}});w.onmessage({data:{id:1,progress:{filletTrial:'start'}}});
const recovered=await job;assert.ok(w.dead);assert.equal(recovered.analysis.filletRadiusSearch.radius,.5);assert.equal(recovered.analysis.filletRadiusSearch.limitReason,'trial-time');assert.equal(recovered.outputs.length,2);assert.equal(recovered.analysis.partialFillet,undefined);assert.equal(checkpoint.analysis.filletRadiusSearch.limitReason,undefined);assert.ok(events.every(p=>!('filletRadiusCheckpoint'in p)));
const unfinished=client.run(features,spec),w2=workers[1];w2.onmessage({data:{id:2,progress:{filletTrial:'start'}}});await assert.rejects(unfinished,e=>e.code==='fillet-budget'&&/まだ確認できていません/.test(e.message));assert.ok(w2.dead);
const cancelled=client.run(features,spec),w3=workers[2];w3.onmessage({data:{id:3,progress:{filletRadiusCheckpoint:checkpoint,filletTrial:'start'}}});client.reset();await assert.rejects(cancelled,/キャンセル/);assert.ok(w3.dead);assert.deepEqual(features,[{id:'unchanged'}]);
const accepted=client.run(features,spec),w4=workers[3];assert.equal(client.acceptFilletRadius(),false,'cannot adopt an unchecked result');
const limiting={radius:1,diagnostics:{bodyIds:['b'],certainty:'faulty-contour',edges:[{bodyId:'b',points:[[0,0,0],[1,0,0]]}]}};
w4.onmessage({data:{id:4,progress:{filletRadiusCheckpoint:checkpoint}}});w4.onmessage({data:{id:4,progress:{filletRadiusFailure:limiting}}});w4.onmessage({data:{id:4,progress:{filletTrial:'start'}}});
assert.equal(client.acceptFilletRadius(),true);const chosen=await accepted;assert.ok(w4.dead);assert.equal(chosen.analysis.filletRadiusSearch.limitReason,'user');assert.equal(chosen.analysis.filletRadiusSearch.radius,.5);assert.deepEqual(chosen.analysis.filletRadiusSearch.limiting,limiting);assert.equal(chosen.outputs.length,2);assert.equal(checkpoint.analysis.filletRadiusSearch.limiting,undefined);
w4.onmessage({data:{id:4,result:{outputs:[]}}});assert.equal(client.pending.size,0);assert.equal(client.acceptFilletRadius(),false);
// A fatal WASM error after a verified full-selection checkpoint must not rerun
// the same crashing search or discard the last valid result.
const fatal=client.run(features,spec),w5=workers.at(-1),fatalId=client.next;
w5.onmessage({data:{id:fatalId,progress:{filletRadiusCheckpoint:checkpoint}}});
const queued=client.run(features,{type:'move'});
w5.onmessage({data:{id:fatalId,error:'RuntimeError: null function or function signature mismatch'}});
const safe=await fatal;assert(w5.dead);assert.equal(safe.analysis.filletRadiusSearch.limitReason,'kernel-error');assert.equal(safe.outputs.length,2);assert.equal(safe.analysis.filletRadiusSearch.radius,.5);
const clean=workers.at(-1);assert.notEqual(clean,w5);clean.onmessage({data:{id:client.next,result:{moved:true}}});assert.deepEqual(await queued,{moved:true});
const workerError=client.run(features,spec),workerId=client.next;
clean.onmessage({data:{id:workerId,progress:{filletRadiusCheckpoint:checkpoint}}});clean.onerror({message:'native engine crashed'});
assert.equal((await workerError).analysis.filletRadiusSearch.limitReason,'kernel-error');assert(clean.dead);
assert.equal(checkpoint.analysis.filletRadiusSearch.limitReason,undefined);client.reset();
console.log('PASS radius-search native stall/crash recovery only from complete all-body checkpoints, unfinished error, cancellation, clean queue recovery and private progress filtering');
