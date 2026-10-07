import assert from 'node:assert/strict';import {KernelClient} from '../src/kernel-client.js';
let created=0;const workers=[];const client=new KernelClient(()=>{created++;const w={postMessage(m){this.last=m;},terminate(){this.dead=true;}};workers.push(w);return w;});
const warm=client.warmup();workers[0].onmessage({data:{id:1,result:{ready:true}}});await warm;
const a=client.run([],{type:'move'});workers[0].onmessage({data:{id:2,result:{outputs:[]}}});await a;assert.equal(created,1);
const cancel=client.run([],{type:'move'});client.reset();await assert.rejects(cancel,/キャンセル/);assert.ok(workers[0].dead);
const retry=client.warmup();workers[1].onmessage({data:{id:4,result:{ready:true}}});await retry;assert.equal(created,2);
const fail=client.run([],{type:'move'});workers[1].onmessage({data:{id:5,error:'invalid shape'}});await assert.rejects(fail,e=>e.rawMessage==='invalid shape'&&/形状計算/.test(e.message));assert.equal(created,2);
await assert.rejects(client.request({},5),/制限時間/);assert.ok(workers[1].dead);console.log('PASS reuse, warmup, cancellation, restart, operation error and timeout');
