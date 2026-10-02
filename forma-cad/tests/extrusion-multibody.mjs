import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation} from '../src/kernel.js';
import {defaults,rebuild,validateProject} from '../src/geometry.js';
import {findRegions} from '../src/regions.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const solids=new Map([
 ['a',R.makeBox([-10,-10,0],[10,10,10])],
 ['b',R.makeBox([-10,-10,15],[10,10,25])],
 ['far',R.makeBox([30,-10,0],[40,10,10])]
]);
const base={kind:'cadop',id:'import',name:'three solids',outputs:[...solids].map(([id,solid])=>({id,...solid.mesh(),brep:solid.serialize()})),remove:[]};
const feature={...defaults,kind:'extrusion',id:'cut',name:'cut all',profile:'circle',diameter:8,depth:30,z:-1,operation:'cut',target:'a',cutAllBodies:true};
const volumeOf=output=>{const shape=R.deserializeShape(output.brep).asShape3D();try{return R.measureVolume(shape);}finally{shape.delete();}};
const expected=4000-Math.PI*16*10;

const result=runOperation([base],{type:'extrusionBatch',features:[feature]}).features[0];
assert.deepEqual(result.cadResult.outputs.map(o=>o.id),['a','b']);
assert.deepEqual(result.cadResult.remove,[]);
for(const output of result.cadResult.outputs)assert.ok(Math.abs(volumeOf(output)-expected)<.01);
assert.equal(rebuild([base,result]).size,3);
validateProject({format:'forma-cad',version:1,features:[base,result]});

const one=runOperation([base],{type:'extrusionBatch',features:[{...feature,cutAllBodies:false}]}).features[0];
assert.deepEqual(one.cadResult.outputs.map(o=>o.id),['a']);
const full=runOperation([base],{type:'extrusionBatch',features:[{...feature,profile:'rect',width:24,height:24}]}).features[0];
assert.deepEqual(full.cadResult.outputs,[]);
assert.deepEqual(full.cadResult.remove,['a','b']);
assert.deepEqual([...rebuild([base,full]).keys()],['far']);
const through=runOperation([base],{type:'extrusionBatch',features:[{...feature,depth:1,throughAll:true}]}).features[0];
assert.deepEqual(through.cadResult.outputs.map(o=>o.id),['a','b']);
for(const output of through.cadResult.outputs)assert.ok(Math.abs(volumeOf(output)-expected)<.01);
const throughOne=runOperation([base],{type:'extrusionBatch',features:[{...feature,depth:1,throughAll:true,cutAllBodies:false}]}).features[0];
assert.deepEqual(throughOne.cadResult.outputs.map(o=>o.id),['a']);
assert.throws(()=>runOperation([base],{type:'extrusionBatch',features:[{...feature,x:100}]}),/重なって/);

const before=[base,result],proposed=structuredClone(before);
proposed[1].diameter=10;
delete proposed[1].cadResult;
const replayed=runOperation(proposed,{type:'replay',before,start:1}).features[1];
assert.deepEqual(replayed.cadResult.outputs.map(o=>o.id),['a','b']);
for(const output of replayed.cadResult.outputs)assert.ok(Math.abs(volumeOf(output)-(4000-Math.PI*25*10))<.01);
validateProject({format:'forma-cad',version:1,features:[base,replayed]});
const sketch={...defaults,kind:'sketch',id:'s',name:'上面の輪郭',profile:'circle',diameter:8,z:25};
const region=findRegions([sketch])[0];
const gridCut={...feature,id:'grid-cut',profile:'region',region,plane:region.plane,z:25,depth:-25,gridExtentPlane:'XY'};
const gridResult=runOperation([base,sketch],{type:'extrusionBatch',features:[gridCut]}).features[0];
assert.deepEqual(gridResult.cadResult.outputs.map(o=>o.id),['a','b']);
const gridBefore=[base,sketch,gridResult],gridEdited=structuredClone(gridBefore);
gridEdited[1].z=30;
const gridReplay=runOperation(gridEdited,{type:'replay',before:gridBefore,start:1}).features[2];
assert.equal(gridReplay.depth,-30);
assert.deepEqual(gridReplay.cadResult.outputs.map(o=>o.id),['a','b']);
for(const solid of solids.values())solid.delete();
console.log('PASS extrusion all-body cut, through-all extent, untouched body, no intersection, save and replay');