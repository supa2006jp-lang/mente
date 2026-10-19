import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
import {extrusionJoinPlan} from '../src/extrusion-join-plan.js';
import {selectExtrusionJoins} from '../src/extrusion-join-selection.js';
import {ExtrusionPreviewCache} from '../src/extrusion-preview-cache.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const input=['a','b','c'].map((id,i)=>({...defaults,id,kind:'extrusion',name:id,width:20,height:20,depth:10,z:i*20}));
const region={plane:'XY',offset:10,outer:[[-10,-10],[10,-10],[10,10],[-10,10]],holes:[],bodyId:'a',cadFace:{bodyId:'a',point:[0,0,10],normal:[0,0,1]}};
const f={...defaults,id:'f',kind:'extrusion',name:'結合',profile:'region',region,operation:'join',target:'a',targetAllBodies:true,joinSourceContacts:true,depth:30};
let detected;const restores=[],forbidden=['fuse','cut','mesh','serialize'];
try{for(const name of forbidden){let proto=R.Solid.prototype;while(!Object.hasOwn(proto,name))proto=Object.getPrototypeOf(proto);const original=proto[name];proto[name]=function(){throw Error('Inspection must not call '+name);};restores.push(()=>proto[name]=original);}detected=runOperation(input,{type:'extrusionJoinInspect',features:[f]});}finally{restores.forEach(restore=>restore());}
assert.equal(detected.contactOnly,true);assert.equal(detected.features[0].cadResult.outputs[0].brep,undefined);assert.deepEqual(detected.features[0].cadResult.analysis.extrusionJoin.bodyIds,['a','b','c']);
const plan=extrusionJoinPlan([f],detected.features,input.map(f=>f.id)),chosen=selectExtrusionJoins([f],plan,['a','b']);assert.deepEqual(chosen[0].targetBodies,['a','b']);assert.equal(chosen[0].joinSelectionExact,true);assert.throws(()=>selectExtrusionJoins([f],plan,['b']),/押し出し元/);assert.throws(()=>selectExtrusionJoins([f],plan,['a','wrong']),/一覧/);
const result=runOperation(input,{type:'extrusionBatch',features:chosen});assert.deepEqual(result.features[0].cadResult.remove,['b']);const bodies=kernelBodies([...input,...result.features]);assert.deepEqual([...bodies.keys()].sort(),['a','c']);for(const body of bodies.values())body.delete();
const independent={...f,id:'independent',target:'d',region:{bodyId:'d'}};assert.equal(selectExtrusionJoins([f,independent],{...plan,entries:[...plan.entries,{index:1,bodyIds:['d'],sourceId:'d'}]},['a','b'])[1],independent,'a separate source-only extrusion stays outside the confirmation scope');
const cache=new ExtrusionPreviewCache();cache.storeContacts(input,[f],detected);assert.equal(cache.get(input,[f]),null,'contact metadata cannot become committed geometry');assert.deepEqual(cache.getContacts(input,[{...f,id:'other'}]).features[0].id,'other');assert.equal(cache.getContacts(input,[{...f,depth:29}]),null);assert.equal(cache.getContacts([...input],[f]),null);
// Bodies connected only through another body require that connecting body too.
const chain=['a','b','c'].map((id,i)=>({...defaults,id,kind:'extrusion',width:20,height:20,depth:10,z:-i*10}));
const chainDetected=runOperation(chain,{type:'extrusionJoinInspect',features:[{...f,depth:5}]}),chainPlan=extrusionJoinPlan([{...f,depth:5}],chainDetected.features,chain.map(f=>f.id));
const disconnected=selectExtrusionJoins([{...f,depth:5}],chainPlan,['a','c']);assert.throws(()=>runOperation(chain,{type:'extrusionJoinInspect',features:disconnected}),/間にあるボディ/);assert.throws(()=>runOperation(chain,{type:'extrusionBatch',features:disconnected}),/間にあるボディ/);
// Snapshot-based multi-face batches inspect later contacts without any fuses.
const second={...f,id:'g',faceBatch:'f',region:{...region,offset:30,bodyId:'b',cadFace:{bodyId:'b',point:[0,0,30],normal:[0,0,1]}}},batch=[{...f,faceBatch:'f',depth:10},{...second,depth:10}],multi=runOperation(input,{type:'extrusionJoinInspect',features:batch});assert.ok(extrusionJoinPlan(batch,multi.features,input.map(f=>f.id)));assert.equal(multi.features.length,2);
console.log('PASS contact-only inspection without fuse/cut/mesh/serialization, virtual multi-face batches, selected persisted targets, disconnected selection rejection, metadata-only bounded cache and invalidation');
