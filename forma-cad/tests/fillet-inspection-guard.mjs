import assert from 'node:assert/strict';
import {KernelClient} from '../src/kernel-client.js';

const spec={type:'preview',operation:{type:'fillet',id:'preview',target:'body',radius:2,partialMode:'offer'}};
const checkpoint={outputs:[{id:'body',brep:'verified-shape',vertices:[0,0,0,1,0,0,0,1,0],triangles:[0,1,2]}],remove:[],removed:[],analysis:{fillets:[{bodyId:'body',radius:2,edges:1}],partialFillet:{accepted:1,skipped:0,untested:1,radius:2,edges:[{bodyId:'body',point:[0,0,0]}],rejected:[{bodyId:'body',points:[[1,0,0],[1,1,0]]}]}}};
const workers=[],progress=[],features=[{id:'original'}],before=JSON.stringify(features);
const client=new KernelClient(()=>{const worker={messages:[],postMessage(message){this.messages.push(message);},terminate(){this.dead=true;}};workers.push(worker);return worker;},{filletTrialTimeout:15});
const message=(worker,id,progress)=>worker.onmessage({data:{id,progress}});
const preview=client.run(features,spec,{onProgress:p=>progress.push(p)}),first=workers[0];
const queued=client.request({spec:{type:'move'}},1000);
message(first,1,{stage:'確認済み',filletCheckpoint:checkpoint});message(first,1,{stage:'輪郭の検査',filletTrial:'start'});
const result=await preview;
assert.ok(first.dead,'a stuck native worker must actually be terminated');assert.equal(result.outputs[0].brep,'verified-shape');assert.equal(result.analysis.partialFillet.limitReason,'trial-time');assert.equal(result.analysis.partialFillet.untested,1);assert.equal(result.analysis.partialFillet.skipped,0,'unfinished contours are not declared impossible');
assert.equal(workers.length,2,'queued unrelated work restarts on a clean engine');assert.equal(workers[1].messages[0].id,2);workers[1].onmessage({data:{id:2,result:{moved:true}}});assert.deepEqual(await queued,{moved:true});
assert.ok(progress.every(p=>!('filletCheckpoint'in p)&&!('filletTrial'in p)),'private checkpoint meshes never reach UI activity records');assert.equal(checkpoint.analysis.partialFillet.limitReason,undefined);assert.equal(JSON.stringify(features),before);
first.onmessage({data:{id:1,result:{outputs:[]}}});assert.equal(client.pending.size,0,'late replies from a terminated worker are ignored');

// Without any accepted shape, report an unfinished inspection and retain the
// original document. Never manufacture an empty or unchecked success result.
const unfinished=client.run(features,spec),unfinishedId=client.next;
message(workers[1],unfinishedId,{stage:'輪郭の検査',filletTrial:'start'});
await assert.rejects(unfinished,error=>error.code==='fillet-budget'&&/まだ適用できる辺を確認できていません/.test(error.message));assert.ok(workers[1].dead);

// Completing a trial disarms the watchdog while meshing and saving continue.
const normal=client.run(features,spec),normalId=client.next,third=workers[2];message(third,normalId,{filletTrial:'start'});message(third,normalId,{filletTrial:'end'});
await new Promise(resolve=>setTimeout(resolve,30));assert.ok(!third.dead);third.onmessage({data:{id:normalId,result:{complete:true}}});assert.deepEqual(await normal,{complete:true});

// User cancellation clears both deadlines and cannot resurrect an old result
// into a later radius/selection request.
const cancelled=client.run(features,spec),cancelledId=client.next;message(third,cancelledId,{filletCheckpoint:checkpoint,filletTrial:'start'});client.cancel(cancelledId);await assert.rejects(cancelled,/キャンセル/);
const next=client.run(features,{...spec,operation:{...spec.operation,radius:3}}),nextId=client.next,fourth=workers[3];
await new Promise(resolve=>setTimeout(resolve,30));assert.ok(!fourth.dead);third.onmessage({data:{id:cancelledId,progress:{filletTrial:'start'}}});fourth.onmessage({data:{id:nextId,result:{radius:3}}});assert.equal((await next).radius,3);

// Explicit edges and history replay are exact operations, not speculative
// inspections: they keep their usual deadline and never return a partial shape.
const explicit=client.run(features,{type:'fillet',target:'body',radius:2,edges:[{bodyId:'body',point:[0,0,0]}]}),explicitId=client.next;
message(fourth,explicitId,{filletCheckpoint:checkpoint,filletTrial:'start'});await new Promise(resolve=>setTimeout(resolve,30));assert.ok(!fourth.dead);fourth.onmessage({data:{id:explicitId,result:{exact:true}}});assert.deepEqual(await explicit,{exact:true});
client.reset();console.log('PASS stalled native trial termination, validated checkpoint fallback, unfinished-state error, queue recovery, end/cancel cleanup, stale-response isolation and exact-operation scope');
