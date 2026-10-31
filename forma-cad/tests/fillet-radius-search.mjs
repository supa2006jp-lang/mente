import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies,featureSolid} from '../src/kernel.js';
import {defaults} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';
import {searchFilletRadius} from '../src/fillet-radius-search.js';
import {MachiningPreviewCache} from '../src/machining-preview-cache.js';

const geometry=()=>Object.assign(Error('geometry'),{code:'fillet-geometry'});
const trials=[],deleted=[];
const pure=searchFilletRadius({upperRadius:2,trial:r=>{trials.push(r);if(r>.73)throw geometry();return {radius:r,dispose:()=>deleted.push(r)};}});
assert.equal(pure.radius,.73);assert.ok(pure.attempts<12);assert.equal(deleted.length,trials.filter(r=>r<=.73).length-1);pure.result.dispose();
assert.throws(()=>searchFilletRadius({upperRadius:2,trial:()=>{throw geometry();}}),/0.01 mm以上/);
assert.throws(()=>searchFilletRadius({upperRadius:.009,trial:()=>assert.fail()}),/0.01/);
assert.throws(()=>searchFilletRadius({upperRadius:1,trial:()=>{throw Object.assign(Error('selection'),{code:'fillet-selection'});}}),/selection/);
const limited=searchFilletRadius({upperRadius:2,maxAttempts:3,trial:r=>{if(r>1.1)throw geometry();return {radius:r};}});assert.equal(limited.radius,1);assert.equal(limited.limitReason,'attempts');
const expandedTrials=[],expanded=searchFilletRadius({upperRadius:.1,expand:true,trial:r=>{expandedTrials.push(r);if(r>.73)throw geometry();return {radius:r};}});assert.equal(expanded.radius,.73);assert.equal(expanded.expanded,true);assert.ok(expandedTrials.includes(.8));assert.equal(expanded.limiting.radius,.74);
const cap=searchFilletRadius({upperRadius:1,expand:true,maxRadius:2,trial:r=>({radius:r})});assert.equal(cap.radius,2);assert.equal(cap.limitReason,'radius-limit');
const failures=[],diagnosed=searchFilletRadius({upperRadius:2,trial:r=>{if(r>.5)throw Object.assign(geometry(),{diagnostics:{bodyIds:['small']}});return {radius:r};},onFailure:f=>failures.push(f)});assert.equal(diagnosed.limiting.radius,.51);assert.deepEqual(diagnosed.limiting.diagnostics.bodyIds,['small']);assert.ok(failures.length);

// An oversized native Build may trap before OCCT can report a geometry failure.
// A small seed brackets the thin-wall limit without touching that unsafe range.
const safeTrials=[],safe=searchFilletRadius({upperRadius:2,initialRadius:.1,expand:true,trial:r=>{safeTrials.push(r);if(r>=1)throw new WebAssembly.RuntimeError('oversized native trial');if(r>.11)throw geometry();return {radius:r};}});
assert.equal(safeTrials[0],.1);assert.equal(safe.radius,.11);assert.equal(safe.limiting.radius,.12);assert(safeTrials.every(r=>r<=.2));
const tiny=searchFilletRadius({upperRadius:2,initialRadius:.1,trial:r=>{if(r>.04)throw geometry();return {radius:r};}});assert.equal(tiny.radius,.04);
const seededBound=searchFilletRadius({upperRadius:.25,initialRadius:.1,trial:r=>({radius:r})});assert.equal(seededBound.radius,.25);assert.equal(seededBound.limitReason,undefined);

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const slab=R.makeBox([0,0,0],[20,12,2]),cube=R.makeBox([30,0,0],[40,10,10]),other=R.makeBox([60,0,0],[65,5,5]);
const features=[{id:'seed',kind:'cadop',name:'原型',outputs:[['slab',slab],['cube',cube],['other',other]].map(([id,s])=>({id,brep:s.serialize(),...s.mesh()})),remove:[]}];[slab,cube,other].forEach(s=>s.delete());
const original=JSON.stringify(features),operation={id:'machining-preview',type:'fillet',target:'slab',targets:['slab','cube'],radius:2,partialMode:'offer'},progress=[];
const result=runOperation(features,{type:'filletRadiusSearch',operation},p=>progress.push(p)),info=result.analysis.filletRadiusSearch;
assert.ok(info.radius>=.9&&info.radius<1);assert.equal(info.bodies,2);assert.equal(info.edges,24);assert.equal(result.analysis.partialFillet,undefined);assert.deepEqual(result.outputs.map(o=>o.id),['slab','cube']);assert.equal(result.remove.length,0);
assert.equal(info.limiting.radius,1);assert.deepEqual(info.limiting.diagnostics.bodyIds,['slab']);assert.ok(info.limiting.diagnostics.edges.length);assert.ok(info.limiting.diagnostics.edges.every(e=>e.bodyId==='slab'));
const expandedNative=runOperation(features,{type:'filletRadiusSearch',expand:true,operation:{...operation,radius:.25}});assert.equal(expandedNative.analysis.filletRadiusSearch.radius,.99);assert.equal(expandedNative.analysis.filletRadiusSearch.expanded,true);assert.deepEqual(expandedNative.analysis.filletRadiusSearch.limiting.diagnostics.bodyIds,['slab']);
assert.ok(progress.some(p=>p.filletRadiusCheckpoint));for(const p of progress.filter(p=>p.filletRadiusCheckpoint)){const checked=p.filletRadiusCheckpoint;assert.equal(checked.outputs.length,2);assert.equal(checked.analysis.fillets.reduce((n,f)=>n+f.edges,0),24);}
for(const output of result.outputs){const shape=R.deserializeShape(output.brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();shape.delete();}}
const confirmed={...operation,radius:info.radius},direct=runOperation(features,{...confirmed,partialMode:undefined});
for(let i=0;i<2;i++){const a=R.deserializeShape(result.outputs[i].brep).asShape3D(),b=R.deserializeShape(direct.outputs[i].brep).asShape3D();try{assert.ok(Math.abs(R.measureVolume(a)-R.measureVolume(b))<1e-5);}finally{a.delete();b.delete();}}
const cache=new MachiningPreviewCache();cache.store(features,confirmed,result);assert.ok(cache.get(features,{...confirmed,id:'confirmed'}));assert.equal(cache.get(features,{...confirmed,radius:info.radius+.01}),null);
const onlyEdge={type:'fillet',target:'cube',radius:2,edges:[{bodyId:'cube',point:[30,0,5],a:[30,0,0],b:[30,0,10]}]},one=runOperation(features,{type:'filletRadiusSearch',operation:onlyEdge});assert.equal(one.analysis.filletRadiusSearch.radius,2);assert.equal(one.analysis.filletRadiusSearch.edges,1);assert.ok(one.analysis.filletRadiusSearch.attempts>1);
const face=runOperation(features,{type:'filletRadiusSearch',operation:{type:'fillet',target:'cube',radius:1,face:{plane:'XY',offset:10}}});assert.equal(face.analysis.filletRadiusSearch.edges,4);
assert.equal(JSON.stringify(features),original);const bodies=kernelBodies([...features,{kind:'cadop',id:'rounded',spec:{...confirmed,partialMode:undefined},...result}]);try{assert.equal(bodies.size,3);assert.ok(Math.abs(R.measureVolume(bodies.get('other'))-125)<1e-6);}finally{bodies.forEach(s=>s.delete());}
assert.throws(()=>runOperation(features,{type:'filletRadiusSearch',operation:{...operation,targets:['slab','missing']}}),/対象/);
// Projects saved by the previous sampled-arc pipeline receive the same safe
// sketch-provenance recovery as the regular fillet command, once per search.
const sketch=(id,points,arc=false)=>({...defaults,id,name:id,kind:'sketch',profile:'polyline',closed:false,points,...(arc?{arc:{endTangent:[1,0]}}:{})});
const sketches=[sketch('bottom',[[-30,-20],[30,-20]]),sketch('right',Array.from({length:65},(_,i)=>[30+20*Math.cos(-Math.PI/2+i*Math.PI/64),20*Math.sin(-Math.PI/2+i*Math.PI/64)]),true),sketch('top',[[30,20],[-30,20]]),sketch('left',Array.from({length:65},(_,i)=>[-30+20*Math.cos(Math.PI/2+i*Math.PI/64),20*Math.sin(Math.PI/2+i*Math.PI/64)]),true)];
const extrusion={...defaults,id:'capsule',kind:'extrusion',profile:'region',name:'カプセル',region:findRegions(sketches)[0],depth:50},old=featureSolid(extrusion),history=[...sketches,{...extrusion,cadResult:{outputs:[{id:'capsule',brep:old.serialize(),...old.mesh()}],remove:[]}}];old.delete();
const shellSpec={type:'shell',target:'capsule',id:'shell',thickness:2,direction:'内側',faces:[{bodyId:'capsule',point:[0,0,50],normal:[0,0,1]}]};history.push({kind:'cadop',id:'shell',name:'シェル',spec:shellSpec,...runOperation(history,shellSpec)});
const oldHistory=JSON.stringify(history),recovered=runOperation(history,{type:'filletRadiusSearch',operation:{type:'fillet',target:'capsule',radius:.5,partialMode:'offer'}});assert.ok(recovered.analysis.filletRadiusSearch.attempts>1);assert.equal(recovered.analysis.filletRadiusSearch.radius,.5);assert.equal(recovered.analysis.filletRadiusSearch.edges,16);assert.equal(recovered.analysis.fillets[0].arcRecovery.beforeFaces,263);assert.equal(recovered.analysis.fillets[0].arcRecovery.afterFaces,11);assert.equal(JSON.stringify(history),oldHistory);
console.log(JSON.stringify({radius:info.radius,bodies:info.bodies,edges:info.edges,attempts:info.attempts}));
console.log('PASS full-selection radius search, common multi-body limit, exact edge/face scope, valid native results, cache reuse, unchanged input and unrelated bodies, budget and selection failures');
