import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,rebuild,validateProject,validateFeature} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const solids=new Map([['far',R.makeBox([50,-10,0],[70,10,10])],['a',R.makeBox([-10,-10,0],[10,10,10])],['b',R.makeBox([-10,-10,15],[10,10,25])]]);
const base={kind:'cadop',id:'import',name:'three solids',outputs:[...solids].map(([id,solid])=>({id,...solid.mesh(),brep:solid.serialize()})),remove:[]};
const volume=o=>{const shape=R.deserializeShape(o.brep).asShape3D();try{return R.measureVolume(shape);}finally{shape.delete();}};
const run=(feature,history=[base])=>runOperation(history,{type:'extrusionBatch',features:[feature]}).features[0];
try{
 const cut={...defaults,id:'cut',kind:'extrusion',name:'全て切り取り',profile:'circle',diameter:8,z:-1,depth:30,operation:'cut',target:'far',targetAllBodies:true};
 const result=run(cut);assert.deepEqual(result.cadResult.outputs.map(o=>o.id),['a','b']);for(const o of result.cadResult.outputs)assert.ok(Math.abs(volume(o)-(4000-Math.PI*16*10))<.01);assert.equal(rebuild([base,result]).size,3);validateProject({format:'forma-cad',version:1,features:[base,result]});
 const through=run({...cut,depth:1,throughAll:true});assert.deepEqual(through.cadResult.outputs.map(o=>o.id),['a','b']);
 const single=run({...cut,target:'a',targetAllBodies:false});assert.deepEqual(single.cadResult.outputs.map(o=>o.id),['a']);
 const join={...defaults,id:'bridge',kind:'extrusion',name:'全て結合',width:8,height:8,z:9,depth:7,operation:'join',target:'far',targetAllBodies:true};
 const joined=run(join);assert.deepEqual(joined.cadResult.outputs.map(o=>o.id),['a']);assert.deepEqual(joined.cadResult.remove,['b']);assert.ok(Math.abs(volume(joined.cadResult.outputs[0])-8320)<.01);assert.deepEqual([...rebuild([base,joined]).keys()],['far','a']);validateProject({format:'forma-cad',version:1,features:[base,joined]});
 const touching=run({...join,z:10,depth:5});assert.ok(Math.abs(volume(touching.cadResult.outputs[0])-8320)<.01,'face-only contacts are joined');
 const preferred=run({...join,target:'b'});assert.deepEqual(preferred.cadResult.outputs.map(o=>o.id),['b']);assert.deepEqual(preferred.cadResult.remove,['a']);
 const oneJoin=run({...join,target:'a',targetAllBodies:false});assert.deepEqual(oneJoin.cadResult.remove,[]);assert.ok(Math.abs(volume(oneJoin.cadResult.outputs[0])-4384)<.01);
 assert.throws(()=>run({...join,x:100}),/接していません/);
 // An all-target operation remains valid after its old anchor was consumed by a join.
 const subsequent=run({...cut,id:'after',target:'b',diameter:4,depth:1,throughAll:true},[base,joined]);assert.deepEqual(subsequent.cadResult.outputs.map(o=>o.id),['a']);assert.ok(Math.abs(volume(subsequent.cadResult.outputs[0])-(8320-Math.PI*4*25))<.02);validateProject({format:'forma-cad',version:1,features:[base,joined,subsequent]});
 assert.throws(()=>validateProject({format:'forma-cad',version:1,features:[base,joined,{...subsequent,targetAllBodies:false}]}),/参照/,'single-body references must not target a consumed body');
 const before=[base,joined],proposed=structuredClone(before);proposed[1].width=10;delete proposed[1].cadResult;const replayed=runOperation(proposed,{type:'replay',before,start:1}).features;assert.ok(Math.abs(volume(replayed[1].cadResult.outputs[0])-8400)<.01);validateProject({format:'forma-cad',version:1,features:replayed});
 assert.throws(()=>validateFeature({...cut,targetAllBodies:'yes'}),/対象ボディ設定/);
 console.log('PASS all-target cut/through-all, concrete target, touching/bridging joins, untouched distant body, preferred stable body ID, no contact, removed anchor, save and replay');
}finally{for(const shape of solids.values())shape.delete();}
