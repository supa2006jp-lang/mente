import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {chamferSolid} from '../src/solid-chamfer.js';
import {runOperation} from '../src/kernel.js';
import {validateProject} from '../src/geometry.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());assert.ok(shape.mesh().triangles.length);}finally{check.delete();}}
function verify(base,distance,selection,edges,expectedVolume){const before=R.measureVolume(base),result=chamferSolid(base,distance,selection);try{valid(result.shape);assert.equal(result.distance,distance);assert.equal(result.edgeCount,edges);if(expectedVolume!==undefined)assert.ok(Math.abs(R.measureVolume(result.shape)-expectedVolume)<1e-5);assert.ok(Math.abs(R.measureVolume(base)-before)<1e-8);}finally{result.shape.delete();}}
const box=R.makeBox([0,0,0],[20,20,10]),cylinder=R.makeCylinder(10,10);
const edge={bodyId:'box',point:[10,0,10],a:[0,0,10],b:[20,0,10]};
verify(box,1,{references:[edge]},1,3990);
verify(box,1,{references:[edge,{point:[0,10,10]}]},2);
verify(box,1,{plane:{normal:[0,0,1],offset:10}},4);
verify(box,1,{},12);
const angle=.12345*Math.PI*2,rim={bodyId:'cylinder',point:[10*Math.cos(angle),10*Math.sin(angle),10]};
verify(cylinder,1,{references:[rim]},1,Math.PI*1000-Math.PI*(10-1/3));
verify(cylinder,1,{},2);
assert.throws(()=>chamferSolid(cylinder,1,{references:[{point:[10,0,5]}]}),e=>e.code==='chamfer-smooth'&&!e.message.includes('丸め'));
const bore=R.makeCylinder(4,10),ring=cylinder.cut(bore);
verify(ring,.5,{references:[{point:[4,0,10]}]},1,Math.PI*840-Math.PI*(4*.25+.125/3));
for(const distance of [0,-1,NaN,Infinity])assert.throws(()=>chamferSolid(box,distance),e=>e.code==='chamfer-distance');
assert.throws(()=>chamferSolid(box,1,{references:[{point:[100,100,100]}]}),e=>e.code==='chamfer-selection');
const original=box.serialize();assert.throws(()=>chamferSolid(box,30),e=>e.code==='chamfer-geometry');assert.equal(box.serialize(),original);
const source={kind:'cadop',id:'source',name:'元形状',outputs:[{id:'box',...box.mesh(),brep:box.serialize()},{id:'cylinder',...cylinder.mesh(),brep:cylinder.serialize()}],remove:[]};
const spec={id:'chamfer',type:'chamfer',target:'box',distance:1,edges:[edge,rim]},result=runOperation([source],spec);
assert.deepEqual(result.outputs.map(o=>o.id),['box','cylinder']);assert.deepEqual(result.analysis.chamfers.map(c=>[c.distance,c.edges]),[[1,1],[1,1]]);
const face=runOperation([source],{id:'face',type:'chamfer',target:'box',distance:1,face:{plane:'XY',offset:10}});assert.equal(face.analysis.chamfers[0].edges,4);
const preview=runOperation([source],{type:'preview',operation:{...spec,edges:[edge]}});assert.equal(preview.removed.length,1);
const document={format:'forma-cad',version:1,units:'mm',features:[source,{kind:'cadop',id:spec.id,name:'面取り',spec,...result}]};
const restored=(await decodeProjectDocument((await encodeProjectDocument(document,{compress:true})).text)).document;
validateProject(restored);const changed=runOperation(restored.features.slice(0,1),{...restored.features[1].spec,distance:2});assert.equal(changed.analysis.chamfers[0].distance,2);
const replay=runOperation(restored.features,{type:'replay',before:restored.features,start:1});assert.equal(replay.features[1].spec.type,'chamfer');
for(const shape of [box,cylinder,bore,ring])shape.delete();
console.log('PASS chamfer setbacks/volume, multiple edges/bodies, face/all edges, outer/inner circles, seam and width errors, preview, lossless save, replay and input preservation');
