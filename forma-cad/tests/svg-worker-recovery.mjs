import assert from 'node:assert/strict';import {KernelClient,freshSvgEngine} from '../src/kernel-client.js';
assert.ok(freshSvgEngine([],{type:'svgWrap'}));assert.ok(freshSvgEngine([],{type:'preview',operation:{type:'svgWrap'}}));assert.ok(freshSvgEngine([{spec:{type:'svgWrap'}}],{type:'replay',start:0}));assert.ok(!freshSvgEngine([{spec:{type:'svgWrap'}},{spec:{type:'move'}}],{type:'replay',start:1}));
const workers=[],client=new KernelClient(()=>{const w={messages:[],postMessage(m){this.messages.push(m);},terminate(){this.dead=true;}};workers.push(w);return w;});
const warm=client.warmup();workers[0].onmessage({data:{id:1,result:{ready:true}}});await warm;
const features=[{id:'body',kind:'extrusion'}],spec={type:'svgWrap',target:'body'},progress=[];
const svg=client.run(features,spec,{onProgress:p=>progress.push(p)});assert.ok(workers[0].dead);assert.equal(workers.length,2);
const queued=client.run([],{type:'move'});assert.equal(client.pending.get(3).timer,null);
workers[1].onmessage({data:{id:2,error:'indirect call to null'}});assert.ok(workers[1].dead);assert.equal(workers.length,3);assert.deepEqual(workers[2].messages[0].features,features);assert.deepEqual(workers[2].messages[0].spec,spec);assert.ok(progress.some(p=>p.stage.includes('再起動')));
workers[1].onmessage({data:{id:2,result:{outputs:['stale']}}});workers[1].onerror({message:'stale worker'});workers[1].onmessageerror();assert.equal(client.pending.size,2);
workers[2].onmessage({data:{id:2,result:{outputs:['solid']}}});assert.deepEqual(await svg,{outputs:['solid']});assert.equal(workers[2].messages.at(-1).id,3);workers[2].onmessage({data:{id:3,result:{ok:true}}});await queued;
// A second trap stops the job, discards the poisoned engine, and keeps the queue usable.
const bad=client.run(features,spec),badPromise=assert.rejects(bad,e=>e.rawMessage==='indirect call to null'&&/内部エラー/.test(e.message));workers[3].onmessage({data:{id:4,error:'indirect call to null'}});workers[4].onmessage({data:{id:4,error:'indirect call to null'}});await badPromise;assert.ok(workers[4].dead);assert.equal(client.pending.size,0);
const ordinary=client.run([],{type:'move'});assert.equal(workers.length,6);workers[5].onmessage({data:{id:5,result:'ready'}});await ordinary;
// Cancellation after automatic recovery still rejects the active and queued jobs.
const cancel=client.run(features,spec),cancelled=assert.rejects(cancel,/キャンセル/),next=client.run([],{type:'move'}),nextCancelled=assert.rejects(next,/キャンセル/);workers[6].onmessage({data:{id:6,error:'memory access out of bounds'}});client.reset();await Promise.all([cancelled,nextCancelled]);assert.ok(workers[7].dead);assert.equal(client.pending.size,0);
console.log('PASS isolated SVG engine, replay scope, one automatic recovery with original input, queued jobs preserved, repeated trap, fresh subsequent engine, and cancellation');
