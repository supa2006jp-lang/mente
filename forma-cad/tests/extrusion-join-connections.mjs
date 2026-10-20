import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
import {extrusionJoinConnectionPath,completeExtrusionJoinSelection} from '../src/extrusion-join-selection.js';

const graph={bodyIds:['a','b','c','d','e'],directBodyIds:['a'],bodyLinks:[['a','b'],['b','c'],['c','d'],['a','e'],['e','d']]};
assert.deepEqual(extrusionJoinConnectionPath(graph,['a','d']),['e'],'prefer a path needing one extra body over two');
assert.deepEqual(extrusionJoinConnectionPath(graph,['a','b','c','d']),[]);
assert.equal(extrusionJoinConnectionPath(graph,['a','missing']),null);
assert.equal(extrusionJoinConnectionPath({...graph,bodyLinks:[]},['a','d']),null);
const disconnected=ids=>Object.assign(Error('not connected'),{code:'EXTRUSION_JOIN_DISCONNECTED',diagnostics:{extrusionJoinConnections:ids}});
let attempts=0;assert.deepEqual(await completeExtrusionJoinSelection(['a','d'],graph.bodyIds,disconnected(['b']),async ids=>{attempts++;if(!ids.includes('c'))throw disconnected(['c']);}),['b','c']);assert.equal(attempts,2);
assert.deepEqual(await completeExtrusionJoinSelection(['a'],['a','b'],disconnected(['outside']),()=>assert.fail()),[]);
assert.deepEqual(await completeExtrusionJoinSelection(['a'],['a','b'],disconnected(['b']),async()=>{throw Error('geometry changed');}),[]);

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const input=['a','b','c','d'].map((id,i)=>({...defaults,id,kind:'extrusion',width:20,height:20,depth:10,z:-i*10}));
input.push({...input[0],id:'away',x:60});
const region={plane:'XY',offset:10,outer:[[-10,-10],[10,-10],[10,10],[-10,10]],holes:[],bodyId:'a',cadFace:{bodyId:'a',point:[0,0,10],normal:[0,0,1]}};
const f={...defaults,id:'f',kind:'extrusion',profile:'region',region,operation:'join',target:'a',targetAllBodies:false,targetBodies:['a','d'],joinSourceContacts:true,joinSelectionExact:true,depth:5};
let error;const restores=[];
try{
 for(const name of ['fuse','cut','mesh','serialize']){let proto=R.Solid.prototype;while(!Object.hasOwn(proto,name))proto=Object.getPrototypeOf(proto);const original=proto[name];proto[name]=()=>{throw Error('Connection help must not call '+name);};restores.push(()=>proto[name]=original);}
 try{runOperation(input,{type:'extrusionJoinInspect',features:[f],connectionCandidates:['a','b','c','d']});assert.fail('must reject the disconnected choice');}catch(e){error=e;}
 assert.equal(error.code,'EXTRUSION_JOIN_DISCONNECTED');assert.deepEqual(error.diagnostics.extrusionJoinConnections,['b','c']);
 const additions=await completeExtrusionJoinSelection(f.targetBodies,['a','b','c','d'],error,async ids=>runOperation(input,{type:'extrusionJoinInspect',features:[{...f,targetBodies:ids}],connectionCandidates:['a','b','c','d']}));
 assert.deepEqual(additions,['b','c']);assert.deepEqual(f.targetBodies,['a','d'],'advice does not change the chosen targets');
 assert.throws(()=>runOperation(input,{type:'extrusionJoinInspect',features:[f],connectionCandidates:['a','c','d']}),e=>e.code==='EXTRUSION_JOIN_DISCONNECTED'&&!e.diagnostics,'never suggest a body outside the confirmation scope');
 assert.throws(()=>runOperation(input,{type:'extrusionJoinInspect',features:[{...f,joinSourceContacts:false}],connectionCandidates:['a','b','c','d']}),e=>e.code==='EXTRUSION_JOIN_DISCONNECTED'&&!e.diagnostics,'direct-only scopes cannot acquire body-to-body expansion');
 // A prior feature removes b into a. Diagnostics still return original IDs.
 const first={...f,id:'first',faceBatch:'faces',targetBodies:['a','b']},second={...f,id:'second',faceBatch:'faces',region:{...region,offset:0,bodyId:'b',cadFace:{...region.cadFace,bodyId:'b',point:[0,0,0]}},target:'b',targetBodies:['b','d']};
 assert.throws(()=>runOperation(input,{type:'extrusionJoinInspect',features:[first,second],connectionCandidates:['a','b','c','d']}),e=>e.code==='EXTRUSION_JOIN_DISCONNECTED'&&JSON.stringify(e.diagnostics.extrusionJoinConnections)==='["c"]','batch aliases retain the missing bridge identity');
}finally{restores.forEach(restore=>restore());}
console.log('PASS native bridge detection without booleans, shortest additions, scoped/legacy safety, sequential aliases and whole-batch validation');
