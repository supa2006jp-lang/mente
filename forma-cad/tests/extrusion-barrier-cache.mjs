import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {clearBodyCache} from '../src/body-cache.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const obstacle={...defaults,id:'obstacle',name:'障害物',profile:'circle',diameter:6,depth:12};
const f={...defaults,kind:'extrusion',id:'barrier',name:'すき間',width:20,height:20,depth:10,barrier:true,barrierGap:.4};
const counts={cut:0,distance:0,mesh:0},restores=[];
function count(proto,method,key){while(!Object.hasOwn(proto,method))proto=Object.getPrototypeOf(proto);const original=proto[method],wrapped=function(...args){counts[key]++;return original.apply(this,args);};Object.assign(wrapped,original);proto[method]=wrapped;restores.push(()=>proto[method]=original);}
count(R.Solid.prototype,'cut','cut');count(R.Solid.prototype,'mesh','mesh');count(R.getOC().BRepExtrema_DistShapeShape.prototype,'Perform','distance');
try{
 const first=runOperation([obstacle],{type:'extrusionToolPreview',feature:f}),snapshot={...counts};
 assert.equal(first.barrierClearance.length,1);
 // A new ID/name and different property order do not change native geometry.
 const renamed=Object.fromEntries(Object.entries({...f,id:'renamed',name:'別名'}).reverse());
 const repeat=runOperation([obstacle],{type:'extrusionToolPreview',feature:renamed});
 assert.equal(counts.cut,snapshot.cut,'repeated previews must reuse the clearance colour');
 assert.equal(counts.distance,snapshot.distance,'validated geometry must not repeat distance checks');
 assert.deepEqual(repeat.outputs.map(({id,...mesh})=>mesh),first.outputs.map(({id,...mesh})=>mesh),'cached preview geometry remains identical after renaming');
 assert.deepEqual(repeat.barrierClearance,first.barrierClearance);
 const stages=[],result=runOperation([obstacle],{type:'extrusion',feature:renamed},step=>stages.push(step.stage));assert.equal(result.outputs[0].id,'renamed');
 assert.equal(counts.cut,snapshot.cut);assert.ok(!stages.includes('障害物とのすき間を検査しています'),'commit reuses the clearance assessment; general geometry health checks may still measure distances');
 const validate=(history,feature,gap)=>{const output=runOperation(history,{type:'extrusion',feature}),shape=R.deserializeShape(output.outputs[0].brep).asShape3D(),body=R.makeCylinder(3,12,[history[0].x||0,0,0]);try{assert.ok(Math.abs(R.measureDistanceBetween(shape,body)-gap)<1e-5);}finally{shape.delete();body.delete();}};
 let before=counts.distance;validate([obstacle],{...f,barrierGap:.8},.8);assert.ok(counts.distance>before,'gap changes must be revalidated');
 before=counts.distance;validate([{...obstacle,x:2}],f,.4);assert.ok(counts.distance>before,'obstacle changes must be revalidated');
 before=counts.cut;runOperation([obstacle],{type:'extrusionToolPreview',feature:{...f,depth:9}});assert.ok(counts.cut>before,'depth changes must update the preview');
 clearBodyCache();before=counts.distance;runOperation([obstacle],{type:'extrusionToolPreview',feature:f});assert.ok(counts.distance>before,'clearing native bodies must invalidate assessments');
}finally{restores.reverse().forEach(restore=>restore());clearBodyCache();}
console.log('PASS validated barrier reuse across preview/commit, ID/name/property order changes, cached gap meshes and invalidation after gap/depth/obstacle/cache changes');
