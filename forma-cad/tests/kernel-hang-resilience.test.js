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
test('preview deadlines can be shortened without shortening actual model operations',async()=>{
 const client=new KernelClient(()=>({postMessage(){},terminate(){}}));
 assert.equal(kernelTimeout([],{type:'meshCombinePreview'}),5000);
 for(const type of ['fillet','shell','join','revolve','honeycomb','printSupport','storageTray','pull','split','move','stepImport','svgWrap','coilJoint','extrusion','replay']){
  const limit=kernelTimeout([],{type});assert.ok(Number.isFinite(limit)&&limit>0&&limit<=600000,type);
  const result=client.run([],{type},{timeout:1});assert.equal(client.pending.get(client.active).timeout,limit);client.worker.onmessage({data:{id:client.active,result:{outputs:[],remove:[]}}});await result;
 }
 const preview=client.run([],{type:'preview',operation:{type:'join'}},{timeout:10});await assert.rejects(preview,{code:'timeout'});client.reset();
});
