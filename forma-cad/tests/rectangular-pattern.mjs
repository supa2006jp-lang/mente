import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {rectangularOffsets,patternDragValue} from '../src/rectangular-pattern.js';
import {patternTransforms} from '../src/patterns.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {validateProject} from '../src/geometry.js';
const near=(a,b,eps=1e-5)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`),nearPoint=(a,b)=>a.forEach((v,i)=>near(v,b[i]));
const sourceCenter=[15,25,5],p={type:'rectangular',distribution:'between',count:6,count2:1,startPoint:[100,-20,10],endPoint:[130,20,60],patternAnchor:sourceCenter};
for(const spec of [p,{...p,count:2},{...p,count:60},{...p,startPoint:p.endPoint,endPoint:p.startPoint}]){
 const offsets=rectangularOffsets(spec),positions=offsets.map(o=>o.map((v,i)=>v+sourceCenter[i])),matrices=patternTransforms(spec);assert.equal(offsets.length,spec.count);assert.equal(matrices.length,spec.count);nearPoint(positions[0],spec.startPoint);nearPoint(positions.at(-1),spec.endPoint);
 for(let i=0;i<positions.length;i++){nearPoint(new THREE.Vector3(...sourceCenter).applyMatrix4(matrices[i]).toArray(),positions[i]);if(i)near(Math.hypot(...positions[i].map((v,k)=>v-positions[i-1][k])),Math.hypot(...spec.endPoint.map((v,k)=>v-spec.startPoint[k]))/(spec.count-1));}
}
for(const invalid of [{count:1},{count:61},{count:2.5},{startPoint:[0,NaN,0]},{endPoint:p.startPoint},{patternAnchor:null}])assert.throws(()=>rectangularOffsets({...p,...invalid}));
assert.deepEqual(JSON.parse(JSON.stringify(rectangularOffsets({type:'rectangular',count:2,count2:3,spacing:-12,spacing2:7}))),[[0,0,0],[0,7,0],[0,14,0],[-12,0,0],[-12,7,0],[-12,14,0]]);
assert.equal(patternDragValue(19.8,{snap:true,step:10,pixelsPerMm:10}),20);assert.equal(patternDragValue(19.8,{snap:true,step:10,pixelsPerMm:10,fine:true}),19.8);assert.equal(patternDragValue(-18.12345),-18.12);
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const box=R.makeBox([10,20,0],[20,30,10]),features=[{kind:'cadop',id:'seed',name:'原型',outputs:[{id:'body',...box.mesh({tolerance:.1,angularTolerance:.2}),brep:box.serialize()}],remove:[]}];box.delete();
const spec={...p,id:'distribution',target:'body',operation:'新規ボディ'},snapshot=JSON.stringify(features),result=runOperation(features,spec);assert.equal(result.outputs.length,p.count);assert.equal(result.outputs[0].id,'body');assert.equal(JSON.stringify(features),snapshot);
const centers=result.outputs.map(output=>{const shape=R.deserializeShape(output.brep).asShape3D();try{near(R.measureVolume(shape),1000);const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(check.IsValid());}finally{check.delete();}const bounds=shape.boundingBox;try{return bounds.center;}finally{bounds.delete();}}finally{shape.delete();}});nearPoint(centers[0],p.startPoint);nearPoint(centers.at(-1),p.endPoint);
for(let i=1;i<centers.length;i++)nearPoint(centers[i],p.startPoint.map((v,k)=>v+(p.endPoint[k]-v)*i/(p.count-1)));
const history=validateProject(JSON.parse(JSON.stringify({format:'forma-cad',version:1,features:[...features,{kind:'cadop',id:spec.id,name:'矩形状パターン',spec,...result}]})));const bodies=kernelBodies(history);assert.equal(bodies.size,p.count);for(const body of bodies.values())body.delete();
const touching={...spec,id:'joined',count:3,startPoint:[0,0,5],endPoint:[20,0,5],operation:'結合'},joined=runOperation(features,touching);assert.deepEqual(joined.outputs.map(o=>o.id),['body']);const fused=R.deserializeShape(joined.outputs[0].brep).asShape3D();near(R.measureVolume(fused),3000);const solids=fused.solids;assert.equal(solids.length,1);solids.forEach(s=>s.delete());fused.delete();
// A stale saved preview anchor must not shift the result after the source changes.
const moved=R.makeBox([30,40,10],[40,50,20]),changed=[{...features[0],outputs:[{id:'body',brep:moved.serialize()}]}];moved.delete();const refreshed=runOperation(changed,spec),first=R.deserializeShape(refreshed.outputs[0].brep).asShape3D(),bounds=first.boundingBox;nearPoint(bounds.center,p.startPoint);bounds.delete();first.delete();
console.log('PASS 2-point centers including moved original, diagonal/negative XYZ directions, 2–60 bodies, exact preview matrices, invalid input, native solid validity/volume/IDs, union, source updates and saved project reload');
