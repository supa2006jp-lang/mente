import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const record=(id,shape)=>{try{return {kind:'cadop',id,name:id,outputs:[{id,brep:shape.serialize(),...shape.mesh()}],remove:[]};}finally{shape.delete();}};
const feature=(spec,result)=>({kind:'cadop',id:spec.id,name:'面合わせ',spec,...result});
const near=(a,b)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<1e-5,`${a} != ${b}`));};
const bounds=(features,id)=>{const bodies=kernelBodies(features);try{const box=bodies.get(id).boundingBox;try{return box.bounds.map(p=>[...p]);}finally{box.delete();}}finally{bodies.forEach(b=>b.delete());}};
const before=[record('a',R.makeBox([0,0,0],[20,30,10])),record('b',R.makeBox([50,80,40],[70,110,50]))],snapshot=JSON.stringify(before);
const spec={type:'assemblyMate',id:'center',mode:'plane',planeAlignment:'center',source:{bodyId:'a',point:[1,2,10],normal:[0,0,1]},destination:{bodyId:'b',point:[69,109,40],normal:[0,0,-1]},offset:0};
for(const [source,destination]of [[[1,2,10],[69,109,40]],[[19,28,10],[51,81,40]],[[10,15,10],[60,95,40]]]){
 const input={...spec,source:{...spec.source,point:source},destination:{...spec.destination,point:destination}},result=runOperation(before,input),next=[...before,feature(input,result)];
 near(result.analysis.assembly.source.anchor,[10,15,10]);near(result.analysis.assembly.destination.anchor,[60,95,40]);near(bounds(next,'a')[0],[50,80,30]);near(bounds(next,'a')[1],[70,110,40]);assert.deepEqual(bounds(next,'b'),bounds(before,'b'));
 const bodies=kernelBodies(next);try{const overlap=bodies.get('a').intersect(bodies.get('b'));try{assert.ok(Math.abs(R.measureVolume(overlap))<1e-6);}finally{overlap.delete();}}finally{bodies.forEach(b=>b.delete());}
}
const offset={...spec,offset:2},offsetResult=runOperation(before,offset);near(bounds([...before,feature(offset,offsetResult)],'a')[1],[70,110,38]);
// Perpendicular faces and side faces must use their own face centers as well.
for(const input of [
 {...spec,source:{bodyId:'a',point:[20,1,1],normal:[1,0,0]},destination:{bodyId:'b',point:[50,109,49],normal:[-1,0,0]}},
 {...spec,destination:{bodyId:'b',point:[50,109,49],normal:[-1,0,0]}}
]){const result=runOperation(before,input),assembly=result.analysis.assembly;near(assembly.destination.anchor,[50,95,45]);const next=[...before,feature(input,result)];near(bounds(next,'a')[1].slice(0,2),[50,110]);}
const cylinders=[record('a',R.makeCylinder(5,10)),record('b',R.makeCylinder(5,10,[30,0,40]))],round={...spec,source:{bodyId:'a',point:[4,0,10],normal:[0,0,1]},destination:{bodyId:'b',point:[31,1,40],normal:[0,0,-1]}},roundResult=runOperation(cylinders,round);near(roundResult.analysis.assembly.source.anchor,[0,0,10]);near(roundResult.analysis.assembly.destination.anchor,[30,0,40]);
// Old files lacked the setting: replay must keep the original click alignment.
const {planeAlignment,...legacy}=spec,legacyResult=runOperation(before,legacy),saved=JSON.parse(JSON.stringify([...before,feature(legacy,legacyResult)])),replayed=runOperation(saved,{type:'replay',before:saved,start:2}).features;near(bounds(replayed,'a')[0],[68,107,30]);assert.deepEqual(bounds(replayed,'a'),bounds(saved,'a'));
// A source dimension change still resolves the new face center during replay.
const centered=[...before,feature(spec,runOperation(before,spec))],edited=structuredClone(centered);edited[0]=record('a',R.makeBox([0,0,0],[24,30,12]));const replay=runOperation(edited,{type:'replay',before:centered,start:0}).features;near(replay.at(-1).analysis.assembly.source.anchor,[12,15,12]);near(bounds(replay,'a')[0],[48,80,28]);near(bounds(replay,'a')[1],[72,110,40]);
assert.equal(JSON.stringify(before),snapshot);console.log('PASS off-center clicks give identical centered faces, rectangular/circular/side/perpendicular faces, exact contact and gap, legacy placement preservation and dimension replay');
