import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {featureSolid,runOperation,kernelBodies} from '../src/kernel.js';import {defaults} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const body={...defaults,id:'b',profile:'circle',diameter:20,depth:30,x:0,y:0,z:0};
const hole={...body,id:'h',diameter:10,z:30,depth:-30.01,operation:'cut',target:'b',hole:true};
const threaded=runOperation([body,hole],{type:'thread',target:'b',surfacePoint:[5,0,20],pitch:1.5,profile:'metric60',threadVersion:2,fullLength:true});
const ring=r=>Array.from({length:128},(_,i)=>[r*Math.cos(i*Math.PI/64),r*Math.sin(i*Math.PI/64)]);
const f={...defaults,id:'plug',profile:'region',mode:'solid',operation:'new',holesOnly:true,depth:-15,region:{plane:'XY',offset:30,outer:ring(10),holes:[ring(5).reverse()],cadFace:{bodyId:'b',point:[7,0,30],normal:[0,0,1]}}};

const history=[body,hole,{kind:'cadop',id:'thread',name:'ねじ',spec:{type:'thread',profile:'metric60'},...threaded}];
const copy=runOperation(history,{type:'extrusion',feature:f});assert.equal(copy.outputs[0].threadSource.spec.type,'copiedThread');
const extrusion={...f,kind:'extrusion',cadResult:copy};history.push(extrusion);
const {threadSource}=await import('../src/thread-source.js');assert.ok(threadSource(history,'plug'));assert.ok(threadSource(history,'b'));
const move={type:'move',target:'plug',rotation:[90,0,0],pivot:[0,0,30],x:30,y:0,z:10};const moved=runOperation(history,move);history.push({kind:'cadop',id:'move',spec:move,...moved});
const before=R.deserializeShape(moved.outputs[0].brep).asShape3D();
const pulled=runOperation(history,{type:'pull',target:'plug',allThreadFaces:true,distance:-.1});
assert.deepEqual(pulled.outputs.map(o=>o.id),['plug']);assert.deepEqual(pulled.remove,[]);
const after=R.deserializeShape(pulled.outputs[0].brep).asShape3D();assert.ok(R.measureVolume(after)<R.measureVolume(before)-1);assert.ok(Math.abs(R.measureVolume(after.cut(before)))<.001,'Shrunk copy stays inside transformed original');
assert.equal(after.solids.length,1);const check=new (R.getOC().BRepCheck_Analyzer)(after.wrapped,true,false);assert.ok(check.IsValid());check.delete();
const final=kernelBodies([...history,{kind:'cadop',id:'pull',spec:{type:'pull'},...pulled}]);const original=R.deserializeShape(threaded.outputs[0].brep).asShape3D();assert.ok(Math.abs(R.measureVolume(final.get('b'))-R.measureVolume(original))<1e-7);assert.deepEqual(final.get('b').boundingBox.bounds,original.boundingBox.bounds);
const restored=JSON.parse(JSON.stringify([...history,{kind:'cadop',id:'pull',spec:{type:'pull'},...pulled}]));assert.equal(threadSource(restored,'plug').spec.copyDistance,-.1);assert.equal(threadSource(restored,'plug').transforms.length,1);
const legacy=structuredClone(history);delete legacy.at(-1).outputs[0].threadSource;delete legacy.at(-2).cadResult.outputs[0].threadSource;assert.equal(threadSource(legacy,'plug').spec.type,'copiedThread');
console.log('PASS independent copied thread, rotated/translated pull, source unchanged, saved and legacy metadata');

await fs.writeFile('.sites-runtime/copied-thread-test.json',JSON.stringify({format:'forma-cad',version:1,features:restored.map(f=>({...f,name:f.name||f.id,kind:f.kind||'extrusion'}))}));
