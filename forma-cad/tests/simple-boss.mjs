import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeSimpleBoss,simpleBossDefaults} from '../src/simple-boss.js';
import {runOperation} from '../src/kernel.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {validateProject} from '../src/geometry.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const base=R.makeBox([-20,-20,0],[20,20,10]),spec={...simpleBossDefaults,type:'simpleBoss',id:'boss',target:'base',role:'male',point:[0,0,10],normal:[0,0,1]},before=base.serialize();
const male=makeSimpleBoss(base,spec),socketBase=R.makeBox([-20,-20,10],[20,20,20]),female=makeSimpleBoss(socketBase,{...spec,role:'female'});
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.ok(solidMeshComplete(shape));}finally{check.delete();solids.forEach(s=>s.delete());}}
valid(male.shape);valid(female.shape);assert.equal(base.serialize(),before);
assert.equal(male.analysis.diameter,6);assert.equal(female.analysis.holeDiameter,6.4);assert.equal(female.analysis.holeDepth,4.2);assert.deepEqual(female.analysis.normal.map(v=>v||0),[0,0,-1]);
assert.ok(R.measureVolume(male.shape)>R.measureVolume(base));assert.ok(Math.abs(R.measureVolume(socketBase)-R.measureVolume(female.shape)-Math.PI*3.2**2*4.2)<1e-5);
const overlap=male.shape.intersect(female.shape);assert.ok(R.measureVolume(overlap)<1e-6);overlap.delete();
for(const [point,normal] of [[[0,0,0],[0,0,1]],[[20,0,5],[1,0,0]],[[-20,0,5],[1,0,0]]]){const result=makeSimpleBoss(base,{...spec,point,normal});valid(result.shape);result.shape.delete();}
const rotated=base.clone().rotate(30,[0,0,0],[1,0,0]);const tilted=makeSimpleBoss(rotated,{...spec,point:[0,-5,10*Math.cos(Math.PI/6)],normal:[0,-.5,Math.cos(Math.PI/6)]});valid(tilted.shape);tilted.shape.delete();rotated.delete();
for(const patch of [{role:'other'},{diameter:0},{length:NaN},{normal:[0,0,2]},{point:[40,0,10]},{point:[19,0,10]},{role:'female',length:9,extendInside:false},{role:'female',point:[17,0,10]}])assert.throws(()=>makeSimpleBoss(base,{...spec,...patch}));
const plate=R.makeBox([-20,-20,0],[20,20,2]),plateBrep=plate.serialize(),extended=makeSimpleBoss(plate,{...spec,role:'female',point:[0,0,2]});valid(extended.shape);assert.ok(extended.analysis.extendedInside);assert.equal(extended.analysis.receiverWall,1.6);assert.equal(extended.analysis.receiverDepth,5.4);assert.equal(extended.analysis.holeDepth,4.2);assert.ok(Math.abs(extended.shape.boundingBox.bounds[0][2]+3.4)<1e-5);assert.equal(plate.serialize(),plateBrep);assert.throws(()=>makeSimpleBoss(plate,{...spec,role:'female',point:[0,0,2],extendInside:false}));extended.shape.delete();plate.delete();
assert.equal(base.serialize(),before);
const history=[{kind:'cadop',id:'source',name:'元形状',outputs:[{id:'base',...base.mesh(),brep:before}],remove:[]}];
const result=runOperation(history,spec);assert.equal(result.outputs.length,1);assert.equal(result.outputs[0].id,'base');assert.equal(result.remove.length,0);assert.ok(result.outputs[0].brep);
const feature={kind:'cadop',id:'boss',name:'簡易ボス',spec,...result};const project=[...history,feature];validateProject({format:'forma-cad',version:1,features:project});
const encoded=await encodeProjectDocument({format:'forma-cad',version:1,features:project},{compress:true});const loaded=await decodeProjectDocument(encoded.text);assert.deepEqual(loaded.document.features[1].spec,spec);
const replay=runOperation(project,{type:'replay',before:project,start:1});validateProject({format:'forma-cad',version:1,features:replay.features});assert.ok(replay.features[1].outputs[0].triangles.length);
const femaleResult=runOperation(history,{...spec,role:'female'});assert.equal(femaleResult.analysis.holeDiameter,6.4);
male.shape.delete();female.shape.delete();base.delete();socketBase.delete();
console.log('Simple boss: male/female fit, all face directions, tilted placement, validation, native solids, save and replay passed');
