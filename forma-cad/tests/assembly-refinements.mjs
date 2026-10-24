import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {assemblySnap,assemblyFastMatrix} from '../src/assembly-placement.js';
import {inspectAssemblyContact} from '../src/assembly-contact.js';
import {validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const record=(id,shape)=>{try{return {kind:'cadop',id,name:id,outputs:[{id,brep:shape.serialize(),...shape.mesh()}],remove:[]};}finally{shape.delete();}};
const box=(id,a,b)=>record(id,R.makeBox(a,b)),feature=(spec,result)=>({kind:'cadop',id:spec.id,name:'位置合わせ',spec,...result});
const near=(a,b,t=1e-5)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<t,`${a} != ${b}`));};
const bounds=(features,id)=>{const bodies=kernelBodies(features);try{const box=bodies.get(id).boundingBox;try{return box.bounds;}finally{box.delete();}}finally{bodies.forEach(s=>s.delete());}};
const before=[box('a',[0,0,0],[20,30,10]),box('b',[50,80,40],[90,130,50])],snapshot=JSON.stringify(before),spec={type:'assemblyMate',id:'mate',mode:'plane',planeAlignment:'boundary',sourceAnchor:'u-v-',destinationAnchor:'u-v-',source:{bodyId:'a',point:[2,3,10],normal:[0,0,1]},destination:{bodyId:'b',point:[60,95,40],normal:[0,0,-1]},offset:0};
let result=runOperation(before,{...spec,preview:true}),next=[...before,feature(spec,result)];
near(result.analysis.assembly.source.anchor,[0,30,10]);near(result.analysis.assembly.destination.anchor,[50,130,40]);near(bounds(next,'a')[0],[50,100,30]);near(bounds(next,'a')[1],[70,130,40]);assert.equal(result.analysis.assemblyContact.status,'contact');assert(result.analysis.assemblyContact.complete);
// Every source/destination position is independent; different-size faces align
// by their selected physical reference rather than their centers.
for(const key of ['u-','u+','v-','v+','u-v-','u+v-','u-v+','u+v+']){const input={...spec,sourceAnchor:key,destinationAnchor:key},out=runOperation(before,input),assembly=out.analysis.assembly;const moved=new THREE.Vector3(...assembly.source.anchor).sub(new THREE.Vector3(...assembly.transform.pivot)).applyEuler(new THREE.Euler(...assembly.transform.rotation.map(v=>v*Math.PI/180),'ZYX')).add(new THREE.Vector3(...assembly.transform.pivot)).add(new THREE.Vector3(assembly.transform.x,assembly.transform.y,assembly.transform.z));near(moved.toArray(),assembly.destination.anchor);}
const adjusted={...spec,slideU:7,slideV:-4,twist:35},out=runOperation(before,adjusted),a=out.analysis.assembly;near(a.contactAnchor,[57,134,40]);near(a.adjustment.u?[a.adjustment.u,a.adjustment.v,a.adjustment.angle]:[],[7,-4,35]);
const another=runOperation(before,{...adjusted,slideU:10,slideV:3,twist:15,offset:2}).analysis.assembly,fastMatrix=assemblyFastMatrix(a,{u:10,v:3,angle:15,offset:2});
const posed=(point,plan)=>new THREE.Vector3(...point).sub(new THREE.Vector3(...plan.transform.pivot)).applyEuler(new THREE.Euler(...plan.transform.rotation.map(v=>v*Math.PI/180),'ZYX')).add(new THREE.Vector3(...plan.transform.pivot)).add(new THREE.Vector3(plan.transform.x,plan.transform.y,plan.transform.z));
for(const point of [[0,0,0],[20,30,10],[2,3,10]])near(posed(point,a).applyMatrix4(fastMatrix).toArray(),posed(point,another).toArray());
const bodies=kernelBodies([...before,feature(adjusted,out)]);try{const output=bodies.get('a'),box=output.boundingBox;try{near([box.bounds[1][2]],[40]);}finally{box.delete();}const check=new (R.getOC().BRepCheck_Analyzer)(output.wrapped,true,false);assert(check.IsValid());check.delete();}finally{bodies.forEach(s=>s.delete());}
const centered={...spec,planeAlignment:'center'},gap=runOperation(before,{...centered,offset:2});assert.equal(gap.analysis.assemblyContact.status,'gap');near([gap.analysis.assemblyContact.nearest.distance],[2]);assert.ok(gap.analysis.assemblyContact.rows[0].points);
const overlap=runOperation(before,{...centered,offset:-2,preview:true});assert.equal(overlap.analysis.assemblyContact.status,'interference');near([overlap.analysis.assemblyContact.rows[0].volume],[1200],.001);assert(overlap.assemblyPreview.highlights.length);
const third=box('c',[65,100,35],[75,110,45]),three=runOperation([...before,third],{...centered,preview:true});assert.equal(three.analysis.assemblyContact.status,'interference');assert(three.analysis.assemblyContact.rows.some(r=>r.target==='c'&&r.status==='interference'));assert(three.analysis.assemblyContact.rows.some(r=>r.target==='b'&&r.status==='contact'));
const lock={...centered,id:'lock'},locked=[...before,feature(lock,runOperation(before,lock)),box('d',[160,90,40],[180,120,50])],grouped=runOperation(locked,{...centered,id:'grouped',source:{bodyId:'a',point:[70,105,40],normal:[0,0,1]},destination:{bodyId:'d',point:[170,105,40],normal:[0,0,-1]}});assert.equal(grouped.outputs.length,2);assert(grouped.analysis.assemblyContact.rows.some(r=>r.source==='b'&&r.target==='d'&&r.status==='interference'),'a fixed partner must be included in collision checks');
const sourceShapes=kernelBodies(before);try{const partial=inspectAssemblyContact(new Map([['a',sourceShapes.get('a')]]),new Map([['b',sourceShapes.get('b')]]),{maxPairs:0});assert.equal(partial.report.status,'unknown');assert.equal(partial.report.complete,false);}finally{sourceShapes.forEach(s=>s.delete());}
assert.deepEqual(assemblySnap(19.7,{step:10,enabled:true,pixelsPerUnit:5}),{value:20,snapped:true});assert.equal(assemblySnap(16,{step:10,enabled:true,pixelsPerUnit:5}).snapped,false);assert.equal(assemblySnap(19.7,{step:10,enabled:true,pixelsPerUnit:5,shift:true}).value,19.7);assert.equal(assemblySnap(28,{step:15,enabled:true,angle:true}).value,30);
for(const bad of [{slideU:NaN},{slideV:10001},{twist:Infinity},{sourceAnchor:'missing'}])assert.throws(()=>runOperation(before,{...spec,...bad}));
const saved=JSON.parse(JSON.stringify([...before,feature(adjusted,out)]));validateProject({format:'forma-cad',version:1,features:saved});const replay=runOperation(saved,{type:'replay',before:saved,start:2}).features;near(bounds(replay,'a')[0],bounds(saved,'a')[0]);assert.equal(replay.at(-1).spec.slideU,7);assert.equal(replay.at(-1).spec.twist,35);assert.equal(JSON.stringify(before),snapshot);
await fs.mkdir('.sites-runtime',{recursive:true});await fs.writeFile('.sites-runtime/assembly-refinements-fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:before}));
console.log('PASS all edge/corner anchors, face slides/twist, exact contact/gap/volume, other-body interference, partial-check honesty, grid/angle snap, input validation, save and replay');
