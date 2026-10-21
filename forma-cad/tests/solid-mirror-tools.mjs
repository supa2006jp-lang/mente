import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/solid-mirror-tools/';await fs.mkdir(dir,{recursive:true});
const box=(id,x,y=0)=>({...defaults,kind:'extrusion',id,name:id,width:10,height:8,depth:6,x,y});
const a=box('a',-5),b=box('b',-20,20),untouched=box('untouched',50),before=[a,b,untouched],snapshot=JSON.stringify(before);
const spec={type:'mirror',id:'batch',target:'a',targets:['a','b'],plane:'YZ',offset:0,mirrorMode:'コピー'};
const copies=runOperation(before,spec);assert.deepEqual(copies.outputs.map(o=>o.id),['batch','batch-mirror-1']);assert.deepEqual(copies.remove,[]);
assert.equal(runOperation(before,{...spec,targets:['a'],mirrorMode:'複製'}).analysis.mirrors[0].action,'copied','older mirror commands remain replayable');
function check(result,expected){for(const [id,volume,lo,hi]of expected){const output=result.outputs.find(o=>o.id===id);assert(output,id);const shape=R.deserializeShape(output.brep).asShape3D(),bounds=shape.boundingBox,parts=shape.solids;try{assert(Math.abs(R.measureVolume(shape)-volume)<1e-6);assert.equal(parts.length,1);assert(Math.abs(bounds.bounds[0][0]-lo)<1e-6);assert(Math.abs(bounds.bounds[1][0]-hi)<1e-6);}finally{parts.forEach(p=>p.delete());bounds.delete();shape.delete();}}}
check(copies,[['batch',480,0,10],['batch-mirror-1',480,15,25]]);
const joinedSpec={...spec,mirrorMode:'ミラー＋結合'},joined=runOperation(before,joinedSpec);
assert.deepEqual(joined.analysis.mirrors.map(r=>r.action),['joined','copied']);check(joined,[['a',960,-10,10],['batch-mirror-1',480,15,25]]);
const live=kernelBodies([...before,{kind:'cadop',id:spec.id,spec:joinedSpec,...joined}]);try{assert.deepEqual([...live.keys()],['a','b','untouched','batch-mirror-1']);assert(Math.abs(R.measureVolume(live.get('untouched'))-480)<1e-6);}finally{live.forEach(s=>s.delete());}
const move=runOperation(before,{...spec,mirrorMode:'反転移動',offset:2});assert.deepEqual(move.outputs.map(o=>o.id),['a','b']);check(move,[['a',480,4,14],['b',480,19,29]]);
const overlap=runOperation([box('a',-2)],{...spec,targets:['a'],mirrorMode:'ミラー＋結合'});check(overlap,[['a',672,-7,7]]);
// Point-only contact must remain a separate body rather than a disconnected compound.
const triangle={...a,profile:'region',region:{id:'tri',plane:'XY',offset:0,outer:[[-10,-5],[0,0],[-10,5]],holes:[],area:50,sourceIds:[]}};
const point=runOperation([triangle],{...spec,targets:['a'],mirrorMode:'ミラー＋結合'});assert.equal(point.analysis.mirrors[0].action,'copied');assert.equal(point.outputs[0].id,'batch');
// An unrelated body's face can be the fixed reference for every target.
const face=runOperation(before,{...spec,mirrorNormal:[1,0,0],mirrorOrigin:[49,0,0],mirrorFace:{bodyId:'untouched',point:[45,0,3],normal:[-1,0,0]}});assert.deepEqual(face.analysis.mirrorPlane.mirrorNormal.map(v=>v||0),[-1,0,0]);check(face,[['batch',480,90,100],['batch-mirror-1',480,105,115]]);
assert.throws(()=>runOperation(before,{...spec,targets:[]}),/選択/);assert.throws(()=>runOperation(before,{...spec,targets:['a','missing']}),/選択/);assert.equal(JSON.stringify(before),snapshot);
const step={kind:'cadop',id:spec.id,name:'ミラー＋結合',spec:joinedSpec,...joined},features=[...before,step],doc={format:'forma-cad',version:1,units:'mm',features};validateProject(doc);
const replay=runOperation(features,{type:'replay',before:features,start:before.length}).features.at(-1);assert.deepEqual(replay.outputs.map(o=>o.id),joined.outputs.map(o=>o.id));check(replay,[['a',960,-10,10],['batch-mirror-1',480,15,25]]);
await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:before}));await fs.writeFile(dir+'joined.forma.json',JSON.stringify(doc));
const proof={batchCopy:true,batchMove:true,joinedTouchingPair:true,detachedCopyPreserved:true,overlapVolumeCorrect:true,pointContactKeptSeparate:true,unselectedBodiesPreserved:true,fixedNativePlane:true,invalidSelectionAtomic:true,replay:true};await fs.writeFile(dir+'kernel-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
