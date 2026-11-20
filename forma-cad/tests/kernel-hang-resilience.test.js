import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {KernelClient,kernelTimeout} from '../src/kernel-client.js';
import {combinePreviewMeshes,meshCombinePreview} from '../src/combine-mesh-preview.js';
import {volume} from '../src/geometry.js';

test('combine preview measures transformed tool unions and preserves source meshes',()=>{
 const group=new THREE.Group(),a=new THREE.Mesh(new THREE.BoxGeometry(10,10,10)),b=new THREE.Mesh(a.geometry.clone()),c=new THREE.Mesh(a.geometry.clone());group.position.x=100;group.add(a,b,c);b.position.x=5;c.position.x=-7.5;
 const original=Array.from(a.geometry.attributes.position.array),payload=combinePreviewMeshes(a,[b,c]),before=structuredClone(payload),result=meshCombinePreview({bodies:payload}),g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(result.positions,3));g.setIndex(Array.from(result.indices));
 try{assert.ok(Math.abs(volume(g)-750)<.001);assert.deepEqual(payload,before);assert.deepEqual(Array.from(a.geometry.attributes.position.array),original);assert.ok(result.matrix.every(Number.isFinite));}finally{g.dispose();for(const m of [a,b,c]){m.geometry.dispose();m.material.dispose();}}
});
test('a timed out worker rejects active and queued requests and restarts cleanly, ignoring late replies',async()=>{
 const workers=[],client=new KernelClient(()=>{const w={postMessage(m){this.last=m;},terminate(){this.dead=true;}};workers.push(w);return w;});
 const first=client.request({spec:{type:'shell'}},15),a=assert.rejects(first,{code:'timeout'}),queued=client.run([],{type:'move'}),b=assert.rejects(queued,{code:'timeout'});await Promise.all([a,b]);assert.ok(workers[0].dead);assert.equal(client.pending.size,0);assert.equal(client.active,null);
 const next=client.run([],{type:'move'});workers[0].onmessage({data:{id:workers[1].last.id,result:{stale:true}}});assert.equal(client.pending.size,1);workers[1].onmessage({data:{id:workers[1].last.id,result:{ok:true}}});assert.deepEqual(await next,{ok:true});client.reset();
});
test('a superseded support preview discards its result and keeps the worker for the newest settings',async()=>{
 const workers=[],messages=[];
 const client=new KernelClient(()=>{
  const worker={postMessage(message){messages.push(message);},terminate(){this.dead=true;}};
  workers.push(worker);return worker;
 });
 try{
  const settings={type:'printSupport',style:'walls',preview:true,wallPitch:10};
  const first=client.startSupportPreview([],settings,{foreground:true});
  const cancelled=assert.rejects(first.result,{code:'cancelled'}),firstId=client.active;
  const obsolete=client.startSupportPreview([],{...settings,wallPitch:10.1},{foreground:true});
  const ignored=assert.rejects(obsolete.result,{code:'cancelled'});
  obsolete.supersede();first.supersede();
  const latest=client.startSupportPreview([],{...settings,wallPitch:12},{foreground:true});
  assert.deepEqual(messages.at(-1),{type:'supersedeSupportPreview',id:firstId});
  workers[0].onmessage({data:{id:firstId,result:{outputs:[],stale:true}}});
  await Promise.all([cancelled,ignored]);
  assert.equal(workers.length,1);assert.equal(workers[0].dead,undefined);
  assert.equal(messages.at(-1).spec.wallPitch,12);
  workers[0].onmessage({data:{id:client.active,result:{outputs:[],latest:true}}});
  assert.deepEqual(await latest.result,{outputs:[],latest:true});
 }finally{client.reset();}
});
test('preview deadlines can be shortened without shortening actual model operations',async()=>{
 const client=new KernelClient(()=>({postMessage(){},terminate(){}}));
 assert.equal(kernelTimeout([],{type:'meshCombinePreview'}),5000);
 const support={type:'printSupport',style:'walls',contactLines:true,preview:true};
 assert.equal(kernelTimeout([],support),180000);
 assert.equal(kernelTimeout([{spec:support}],{type:'replay',start:0}),180000);
 assert.equal(kernelTimeout([],{...support,contactLines:false}),90000);
 for(const type of ['fillet','shell','join','revolve','honeycomb','printSupport','storageTray','pull','split','move','stepImport','svgWrap','coilJoint','extrusion','replay']){
  const limit=kernelTimeout([],{type});assert.ok(Number.isFinite(limit)&&limit>0&&limit<=600000,type);
  const result=client.run([],{type},{timeout:1});assert.equal(client.pending.get(client.active).timeout,limit);client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await result;
 }
 const preview=client.run([],{type:'preview',operation:{type:'join'}},{timeout:10});await assert.rejects(preview,{code:'timeout'});client.reset();
});
