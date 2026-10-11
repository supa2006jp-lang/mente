import assert from 'node:assert/strict';import fs from 'node:fs/promises';import * as R from 'replicad';import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';import {runOperation,kernelBodies} from '../src/kernel.js';import {threadMateSource} from '../src/thread-source.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const shape=o=>R.deserializeShape(o.brep).asShape3D();
for(const internal of [false,true]){
 const base={...defaults,kind:'extrusion',id:'base',name:'元の部品',profile:'circle',diameter:10,depth:5,mode:internal?'thin':'solid',side:'outside',wall:2};
 const spec={type:'thread',target:'base',surfacePoint:[5,0,2.5],profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,leftHand:internal,designation:'M10 × 1.5'};
 const threaded=runOperation([base],spec),history=[base,{kind:'cadop',id:'thread',name:'ねじ',spec,...threaded}];
 const before=JSON.stringify(history),info=runOperation(history,{type:'threadMateInfo',target:'base'}).analysis;assert.equal(info.internal,!internal);assert.equal(info.diameter,10);assert.equal(info.pitch,1.5);assert.equal(info.leftHand,internal);assert.equal(info.length,5);
 const settings={type:'threadMate',target:'base',id:'mate',length:5,wall:2,clearance:0};
 const result=runOperation(history,settings),mate=shape(result.outputs[0]),source=shape(threaded.outputs[0]),q=result.analysis;
 assert.equal(JSON.stringify(history),before,'source data remains unchanged');assert.deepEqual(result.remove,[]);assert.deepEqual(result.outputs.map(o=>o.id),['mate']);
 const checker=new (R.getOC().BRepCheck_Analyzer)(mate.wrapped,true,false);assert.ok(checker.IsValid());checker.delete();assert.equal(mate.solids.length,1);
 const bounds=mate.boundingBox;assert.ok(Math.abs(bounds.bounds[0][2])<1e-4);const sourceBounds=source.boundingBox;assert.ok(bounds.bounds[0][0]>=sourceBounds.bounds[1][0]+9.99);sourceBounds.delete();bounds.delete();
 const assembled=mate.clone().translate(q.position.map(v=>-v)),overlap=source.intersect(assembled);assert.ok(Math.abs(R.measureVolume(overlap))<.001,'matched profiles have no interference');overlap.delete();assembled.delete();
 const loose=runOperation(history,{...settings,id:'loose',clearance:.1}),looseShape=shape(loose.outputs[0]);assert.ok(R.measureVolume(looseShape)<R.measureVolume(mate)-.1,'negative pull creates fit allowance on either counterpart');
 assert.equal(loose.outputs[0].threadSource.spec.threadInternal,!internal);assert.equal(loose.outputs[0].threadSource.spec.leftHand,internal);
 const saved={format:'forma-cad',version:1,features:[...history,{kind:'cadop',id:'mate',name:'相手ねじ',spec:settings,...result}]};validateProject(JSON.parse(JSON.stringify(saved)));assert.ok(threadMateSource(saved.features,'mate'));
 const replay=runOperation(saved.features,{type:'replay',before:saved.features,start:2});assert.equal(replay.features.at(-1).analysis.internal,!internal);assert.equal(replay.features.at(-1).outputs[0].id,'mate');
 assert.throws(()=>runOperation(history,{...settings,clearance:1}),/逃がし量/);assert.throws(()=>runOperation(history,{...settings,id:'base'}),/重複/);
 await fs.writeFile('.sites-runtime/thread-mate-'+(internal?'female':'male')+'.forma.json',JSON.stringify({format:'forma-cad',version:1,features:history}));
 mate.delete();source.delete();looseShape.delete();console.log('PASS',internal?'female → left-handed male':'male → right-handed female','matching fit, allowance, source preservation, valid solid, placement and replay');
 if(internal){const moved=runOperation(history,{type:'move',target:'base',rotation:[90,0,0],x:30,y:10,z:15});const after=[...history,{kind:'cadop',id:'move',name:'移動',spec:{type:'move',target:'base',rotation:[90,0,0],x:30,y:10,z:15},...moved}];const movedInfo=runOperation(after,{type:'threadMateInfo',target:'base'}).analysis;assert.equal(movedInfo.leftHand,true);assert.equal(movedInfo.diameter,10);console.log('PASS moved source retains size and thread direction');}
}
assert.throws(()=>runOperation([],{type:'threadMateInfo',target:'missing'}),/通常のねじ/);
console.log('PASS missing or unsupported thread rejected');
