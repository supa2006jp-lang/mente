import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
import {check} from './print-layout.mjs';
import {centerPrintPlacements,movePrintPlacement,planPrintPlates,printPlacementMatrix} from '../src/print-layout.js';
import {Vector3} from 'three';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const source=Array.from({length:4},(_,i)=>({...defaults,id:'b'+i,name:'ボディ'+i,kind:'extrusion',width:100,height:70,depth:10+i,z:i%2?-30:20,x:300+i*200,y:-600}));source.push({...defaults,id:'hidden',kind:'extrusion',name:'非表示のボディ',width:500,height:500,depth:10,x:800});
const spec={type:'printLayout',id:'plate',targets:source.slice(0,4).map(f=>f.id),margin:0,gap:0,allowRotation:true},input=JSON.stringify(source),result=runOperation(source,spec);assert.equal(JSON.stringify(source),input);check(result.analysis);assert.equal(result.outputs.length,4);assert.deepEqual(result.remove,[]);assert.ok(result.analysis.placements.some(p=>p.rotation===90));
const bodies=kernelBodies(source),after=kernelBodies([...source,{kind:'cadop',name:'印刷配置',id:'plate',spec,...result}]);
try{for(const p of result.analysis.placements){const shape=after.get(p.id),box=shape.boundingBox,valid=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.ok(valid.IsValid());const [min,max]=box.bounds;assert.ok(min[0]>=-90-1e-5&&min[1]>=-90-1e-5&&max[0]<=90+1e-5&&max[1]<=90+1e-5);assert.ok(Math.abs(min[2])<1e-5);assert.ok(Math.abs(R.measureVolume(shape)-R.measureVolume(bodies.get(p.id)))<1e-5);}finally{box.delete();valid.delete();}}assert.equal(bodies.get('hidden').serialize(),after.get('hidden').serialize());}finally{for(const b of bodies.values())b.delete();for(const b of after.values())b.delete();}
validateProject({format:'forma-cad',version:1,features:[...source,{kind:'cadop',name:'印刷配置',id:'plate',spec,...result}]});assert.throws(()=>runOperation(source,{...spec,targets:['hidden']}),/超えています/);assert.throws(()=>runOperation(source,{...spec,targets:['missing']}),/見つかりません/);
const next=structuredClone(source);next[0].depth=15;const operation={kind:'cadop',name:'印刷配置',id:'plate',spec,...result};const replay=runOperation([...next,operation],{type:'replay',before:[...source,operation],start:0});check(replay.features.at(-1).analysis);assert.ok(Math.abs(replay.features.at(-1).analysis.placements[0].max[2]-15)<1e-5);
const circle=[{...defaults,id:'round',name:'円柱',kind:'extrusion',profile:'circle',diameter:60,depth:25,z:-5,x:-400}],round=runOperation(circle,{...spec,targets:['round'],margin:2,gap:3});check(round.analysis);
console.log('PASS native rigid solids, unchanged volumes/hidden body, floor/bounds, saved model, history replay and cylinder');

const items=runOperation(source,{type:'printLayoutInfo',targets:['b0','b1']}).items;
const orientation={b0:'x+',b1:'y-'};
const [initial]=planPrintPlates(items,{orientations:orientation}).plates;
const shifted=[[-7,0],[7,0],[0,-7],[0,7]].map(([x,y])=>movePrintPlacement(initial,'b0',x,y)).find(Boolean);
assert.ok(shifted);
const centered=centerPrintPlacements(shifted);
for(const axis of [0,1])assert.ok(Math.abs(Math.min(...centered.placements.map(p=>p.min[axis]))+Math.max(...centered.placements.map(p=>p.max[axis])))<1e-6);
assert.equal(centerPrintPlacements({...shifted,placements:shifted.placements.map(p=>({...p,locked:true}))}).placements[0].min[0],shifted.placements[0].min[0]);
const offset=centered.placements[0].min[0]-shifted.placements[0].min[0];
assert.ok(Math.abs(offset-(centered.placements[1].min[0]-shifted.placements[1].min[0]))<1e-6);
const copySpec={...spec,id:'print-copy',copy:true,targets:['b0','b1'],margin:2,gap:3,orientations:orientation,placementOverrides:centered.placements.map(p=>({
 id:p.id,plate:0,x:(p.min[0]+p.max[0])/2,y:(p.min[1]+p.max[1])/2,rotation:p.rotation,locked:false,
}))};
const copy=runOperation(source,copySpec);
assert.deepEqual(copy.remove,[]);
assert.deepEqual(copy.outputs.map(p=>p.id),['print-copy','print-copy-copy-1']);
for(const p of copy.analysis.placements){
 const output=copy.outputs.find(o=>o.id===p.outputId);
 const expected=new Vector3(...items.find(o=>o.id===p.id).min).applyMatrix4(printPlacementMatrix(p)).toArray();
 assert.ok(output.vertices.some((_,i)=>i%3===0&&expected.every((value,j)=>Math.abs(output.vertices[i+j]-value)<1e-5)));
}
const copyFeature={kind:'cadop',id:copySpec.id,name:'印刷用に複製',spec:copySpec,...copy};
const copyProject=[...source,copyFeature];
validateProject({format:'forma-cad',version:1,features:copyProject});
const originals=kernelBodies(source),withCopies=kernelBodies(copyProject);
try{
 assert.equal(withCopies.size,originals.size+2);
 for(const [id,shape] of originals)assert.equal(withCopies.get(id).serialize(),shape.serialize());
}finally{for(const shape of [...originals.values(),...withCopies.values()])shape.delete();}
const replayedCopy=runOperation(copyProject,{type:'replay',before:copyProject,start:copyProject.length-1,refreshStart:true}).features.at(-1);
assert.deepEqual(replayedCopy.outputs.map(p=>p.id),copy.outputs.map(p=>p.id));
console.log('PASS centered group, position locks, separate rotated print copies, unchanged sources and stable replay IDs');
