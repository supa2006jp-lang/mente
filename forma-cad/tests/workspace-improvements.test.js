import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {analyzePrintPreflight} from '../src/print-preflight.js';
import {historyImpact} from '../src/history-impact.js';
import {commandAvailability} from '../src/command-selection.js';
import {KernelClient,subscribeKernelActivity} from '../src/kernel-client.js';
import {installInteractionDetail} from '../src/interaction-detail.js';
const box=(id,z=5,x=0)=>{const geometry=new THREE.BoxGeometry(10,10,10).translate(x,0,z);const result={id,vertices:Array.from(geometry.attributes.position.array),triangles:Array.from(geometry.index.array)};geometry.dispose();return result;};
test('print checks closed meshes, open/duplicate/reversed faces and size without changing input',async()=>{
 const closed=box('box'),snapshot=JSON.stringify(closed),result=await analyzePrintPreflight([closed]);assert.deepEqual(result.issues,[]);assert.deepEqual(result.dimensions.size,[10,10,10]);
 const opened={...closed,triangles:closed.triangles.slice(6)},open=await analyzePrintPreflight([opened]);assert.ok(open.issues.some(i=>i.type==='topology'&&i.message.includes('開いた辺 4')));
 const duplicate=await analyzePrintPreflight([{...closed,triangles:[...closed.triangles,...closed.triangles.slice(0,3)]}]);assert.ok(duplicate.issues.some(i=>i.type==='topology'&&i.message.includes('非多様体の辺 3')));
 const reversed=structuredClone(closed);[reversed.triangles[0],reversed.triangles[1]]=[reversed.triangles[1],reversed.triangles[0]];assert.ok((await analyzePrintPreflight([reversed])).issues.some(i=>i.type==='topology'));
 assert.ok((await analyzePrintPreflight([closed],{capacity:[9,10,10]})).issues.some(i=>i.type==='size'));assert.equal(JSON.stringify(closed),snapshot);
});
test('floating groups use world floor and actual support, and inward cavity shells are not floating parts',async()=>{
 assert.ok((await analyzePrintPreflight([box('floating',20)])).issues.some(i=>i.type==='floating'));
 assert.ok(!(await analyzePrintPreflight([box('base'),box('top',15)])).issues.some(i=>i.bodyId==='top'&&i.type==='floating'));
 assert.ok((await analyzePrintPreflight([box('base'),box('top',16)])).issues.some(i=>i.bodyId==='top'&&i.type==='floating'));
 const base=box('shell'),inside=box('inner',7);inside.vertices=inside.vertices.map(v=>v*.4);for(let i=0;i<inside.triangles.length;i+=3)[inside.triangles[i],inside.triangles[i+1]]=[inside.triangles[i+1],inside.triangles[i]];
 const combined={id:'shell',vertices:[...base.vertices,...inside.vertices],triangles:[...base.triangles,...inside.triangles.map(v=>v+base.vertices.length/3)]};assert.ok(!(await analyzePrintPreflight([combined])).issues.some(i=>i.type==='floating'));
 await assert.rejects(analyzePrintPreflight([base],{shouldCancel:()=>true}),e=>e.name==='AbortError');
});
test('history distinguishes affected resources from unrelated steps and follows sketch/body dependencies',()=>{
 const features=[{id:'s',kind:'sketch'},{id:'a',kind:'extrusion',operation:'new',region:{sourceIds:['s']}},{id:'b',kind:'cadop',outputs:[{id:'B'}]},{id:'round',name:'丸め',kind:'cadop',spec:{type:'fillet',target:'a'},outputs:[{id:'a'}]},{id:'join',kind:'cadop',spec:{type:'join',target:'B',other:'a'},outputs:[{id:'B'}],remove:['a']},{id:'move',kind:'cadop',spec:{type:'move',target:'B'},outputs:[{id:'B'}]}];
 const result=historyImpact(features,'s');assert.deepEqual(result.steps.map(s=>s.affected),[true,false,true,true,true]);assert.equal(result.affected,4);assert.deepEqual(historyImpact(features,'missing').steps,[]);
});
test('command availability explains missing bodies and references and preserves compatible selection counts',()=>{
 assert.equal(commandAvailability('join',{bodies:1}).enabled,false);assert.match(commandAvailability('thread',{bodies:2}).reason,/内壁/);assert.equal(commandAvailability('fillet',{bodies:2,edges:3}).enabled,true);assert.match(commandAvailability('move',{bodies:2,bodyIds:['a','b']}).reason,/2 ボディ/);
});
test('cancelling one active calculation preserves queued work and exposes structured failure details',async()=>{
 const workers=[],events=[],client=new KernelClient(()=>{const worker={postMessage(payload){this.last=payload;},terminate(){this.dead=true;}};workers.push(worker);return worker;}),off=subscribeKernelActivity(event=>{if(event.client===client)events.push(event);});
 const first=client.run([],{type:'join'}),failure=assert.rejects(first,e=>e.code==='cancelled'),second=client.run([],{type:'move'});client.cancel(1);await failure;assert.ok(workers[0].dead);assert.equal(workers[1].last.id,2);workers[1].onmessage({data:{id:2,result:{ok:true}}});assert.deepEqual(await second,{ok:true});
 const third=client.run([],{type:'replay'}),failed=assert.rejects(third,e=>e.featureId==='round'&&e.diagnostics.edges.length===1);workers[1].onmessage({data:{id:3,error:'フィレットを作成できません',details:{featureId:'round',featureIndex:3,diagnostics:{edges:[{points:[[0,0,0],[1,0,0]]}]}}}});await failed;off();assert.deepEqual(events.filter(e=>e.id===1).map(e=>e.state),['queued','started','cancelled']);assert.ok(events.some(e=>e.state==='error'&&e.error.featureId==='round'));
});
test('large-body display reduces only during interaction and restores materials on cancellation',()=>{
 const previousDocument=globalThis.document,previousWindow=globalThis.window,input={checked:true},label={style:{},querySelector:()=>input},canvas=new EventTarget(),windowEvents=new EventTarget(),host={dataset:{}};
 globalThis.document={createElement:()=>label,querySelector:()=>({append(){}})};globalThis.window=windowEvents;
 const geometry=new THREE.BoxGeometry(20,20,20),originalPosition=Array.from(geometry.attributes.position.array);geometry.setIndex(Array.from({length:600003},(_,i)=>i%3));const material=new THREE.MeshBasicMaterial(),mesh=new THREE.Mesh(geometry,material),edge=new THREE.Object3D();mesh.add(edge);const scene=new THREE.Scene();scene.add(mesh);
 const send=(target,type,values)=>{const event=Object.assign(new Event(type),values);Object.defineProperty(event,'target',{value:canvas});target.dispatchEvent(event);};
 try{
  installInteractionDetail({scene,meshes:new Map([['A',mesh]]),canvas,canUse:()=>true,host});send(windowEvents,'pointerdown',{pointerId:1,clientX:0,clientY:0,shiftKey:true,button:0});send(windowEvents,'pointermove',{pointerId:1,clientX:20,clientY:20});assert.equal(material.visible,false);assert.equal(edge.visible,false);assert.equal(host.dataset.interactionDetail,'outline');assert.equal(scene.children.length,2);
  send(windowEvents,'pointercancel',{pointerId:1});assert.equal(material.visible,true);assert.equal(edge.visible,true);assert.equal(scene.children.length,1);assert.equal(host.dataset.interactionDetail,undefined);assert.deepEqual(Array.from(geometry.attributes.position.array),originalPosition);
 }finally{globalThis.document=previousDocument;globalThis.window=previousWindow;geometry.dispose();material.dispose();}
});
