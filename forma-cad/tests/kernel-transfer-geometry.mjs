import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {compactExtrusionRequest} from '../src/kernel-transfer.js';
import {clearBodyCache} from '../src/body-cache.js';
import {clearClearanceCache} from '../src/cut-clearance.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const cylinder={...defaults,id:'bolt',name:'M10',profile:'circle',diameter:10,depth:5};
const thread={type:'thread',target:'bolt',profile:'metric60',threadVersion:2,pitch:1.5,fullLength:true,surfacePoint:[5,0,3]};
const before=[cylinder,{kind:'cadop',id:'thread',name:'thread',spec:thread,...runOperation([cylinder],thread)}];
const move={type:'move',target:'bolt',id:'copy',copy:true,moveMode:'複製して移動',x:15,y:0,z:0,rotation:[0,0,20]};
const moved={kind:'cadop',id:'copy-op',name:'copy',spec:move,...runOperation(before,move)},history=[...before,moved],snapshot=JSON.stringify(history);
const source=moved.outputs.find(o=>o.threadSource);assert.ok(source,'copied thread provenance is required');
const spec={type:'barrierPreparedPreview',features:[{...defaults,id:'female',name:'female',kind:'extrusion',x:7.5,width:45,height:20,depth:5,barrier:true,barrierGap:.6}],showBarrierGap:false};
const packed=compactExtrusionRequest(history,spec);assert.equal(packed.features.at(-1).outputs.find(o=>o.id===source.id).threadSource.features[0].id,'bolt');
const run=(features,operation)=>{clearBodyCache();clearClearanceCache();const result=runOperation(features,operation);return R.deserializeShape(result.features[0].cadResult.outputs[0].brep).asShape3D();};
const full=run(history,spec),slim=run(packed.features,packed.spec),male=R.deserializeShape(source.brep).asShape3D();
try{
 assert.ok(Math.abs(R.measureVolume(full)-R.measureVolume(slim))<1e-6);
 assert.ok(Math.abs(R.measureDistanceBetween(slim,male)-.6)<.003,'copied thread must keep the actual requested gap');
 const check=new (R.getOC().BRepCheck_Analyzer)(slim.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}
}finally{full.delete();slim.delete();male.delete();clearClearanceCache();clearBodyCache();}
assert.equal(JSON.stringify(history),snapshot);const sizes={before:Buffer.byteLength(JSON.stringify({features:history,spec})),after:Buffer.byteLength(JSON.stringify(packed))};
assert.ok(sizes.after<sizes.before);await fs.writeFile('.sites-runtime/kernel-transfer-size-proof.json',JSON.stringify(sizes,null,2));
console.log('PASS exact native geometry from lean payload, copied/rotated thread provenance, 0.6mm clearance and immutable history; bytes '+sizes.before+' → '+sizes.after);
