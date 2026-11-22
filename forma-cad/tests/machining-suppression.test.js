import assert from 'node:assert/strict';
import {before,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,validateProject} from '../src/geometry.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {historyImpact} from '../src/history-impact.js';
import {toggleMachiningSuppression} from '../src/machining-suppression.js';
import {captureSelectionHistory} from '../src/selection-history.js';

before(async()=>R.setOC(await init({wasmBinary:await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url))})));

const body={...defaults,kind:'extrusion',id:'plate',name:'プレート',width:40,height:30,depth:12};
const hole={...defaults,kind:'extrusion',id:'hole',name:'座ぐり穴',target:body.id,hole:true,operation:'cut',
 profile:'circle',diameter:5,depth:-7,z:12,counterbore:true,counterboreDiameter:8,counterboreDepth:2};
function cut(before,feature){
 return {...feature,cadResult:runOperation(before,{type:'extrusion',target:feature.target,feature})};
}
function toggle(before,id){
 const change=toggleMachiningSuppression(before,id);
 return runOperation(change.features,{type:'replay',before,start:change.start}).features;
}
function modelVolume(features){
 const bodies=kernelBodies(features);
 try{return R.measureVolume(bodies.get(body.id));}finally{for(const shape of bodies.values())shape.delete();}
}

test('a counterbored hole can be suppressed, saved, and restored with its parameters and its successor',()=>{
 const first=cut([body],hole);
 const second=cut([body,first],{...hole,id:'other',name:'右の穴',x:14});
 const before=[body,first,second],off=toggle(before,hole.id);
 assert.equal(off[1].machiningSuppressed,true);
 assert.deepEqual(off[1].cadResult,{outputs:[],remove:[]});
 const expected=modelVolume([body,first])-modelVolume(before);
 assert.ok(Math.abs(modelVolume(off)-modelVolume(before)-expected)<1e-5);
 assert.deepEqual(historyImpact(off,hole.id).steps.map(step=>[step.id,step.affected]),[['other',true]]);
 const saved=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:off})));
 assert.deepEqual(captureSelectionHistory(saved,[body.id],{}).features.map(f=>f.id),['plate','hole','other']);
 const restored=toggle(saved,hole.id);
 assert.equal(restored[1].machiningSuppressed,undefined);
 assert.equal(restored[1].counterboreDiameter,8);
 assert.ok(Math.abs(modelVolume(restored)-modelVolume(before))<1e-5);
});

test('suppressing a shell restores the solid and reapplying uses the original wall thickness',()=>{
 const spec={id:'shell',type:'shell',target:body.id,direction:'内側',thickness:2,
  faces:[{bodyId:body.id,point:[2,2,12],normal:[0,0,1]}]};
 const before=[body,{kind:'cadop',id:'shell',name:'シェル',spec,...runOperation([body],spec)}];
 const off=toggle(before,'shell');
 assert.equal(off[1].machiningSuppressed,true);
 assert.equal(off[1].spec.thickness,2);
 assert.ok(modelVolume(off)>modelVolume(before));
 assert.ok(Math.abs(modelVolume(off)-modelVolume([body]))<1e-5);
 assert.ok(Math.abs(modelVolume(toggle(off,'shell'))-modelVolume(before))<1e-5);
});

test('suppressing a hole identifies a downstream hole whose floor no longer exists',()=>{
 const first=cut([body],hole);
 const second=cut([body,first],{...hole,id:'floor',name:'底面の穴',diameter:2,z:5,depth:-2,counterbore:false,
  counterboreDiameter:undefined,counterboreDepth:undefined});
 const before=[body,first,second],original=JSON.stringify(before);
 assert.throws(()=>toggle(before,hole.id),error=>error.featureId==='floor'&&error.featureIndex===2&&
  error.message.includes('穴あけの基準面がなくなりました'));
 assert.equal(JSON.stringify(before),original);
});
