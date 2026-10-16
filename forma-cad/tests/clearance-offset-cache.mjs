import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {defaults} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {clearBodyCache} from '../src/body-cache.js';
import {clearClearanceCache,clearanceCacheStats,cutWithClearance} from '../src/cut-clearance.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
clearBodyCache();clearClearanceCache();
const obstacle={...defaults,id:'obstacle',name:'obstacle',profile:'circle',diameter:6,depth:30},feature={...defaults,id:'e',name:'e',kind:'extrusion',width:20,height:20,depth:10,barrier:true,barrierGap:.6};
for(const depth of [10,12,14]){
 const result=runOperation([obstacle],{type:'barrierPreparedPreview',features:[{...feature,depth}],showBarrierGap:false}),shape=R.deserializeShape(result.features[0].cadResult.outputs[0].brep).asShape3D(),original=R.makeCylinder(3,30);
 try{assert.ok(Math.abs(R.measureDistanceBetween(shape,original)-.6)<1e-5);}finally{shape.delete();original.delete();}
 assert.equal(clearanceCacheStats.builds,1,'depth changes must reuse the same obstacle offset');
}
assert.equal(clearanceCacheStats.hits,2);
runOperation([obstacle],{type:'barrierPreparedPreview',features:[{...feature,depth:14,barrierGap:.8}],showBarrierGap:false});assert.equal(clearanceCacheStats.builds,2);
runOperation([{...obstacle,x:2}],{type:'barrierPreparedPreview',features:[feature],showBarrierGap:false});assert.equal(clearanceCacheStats.builds,3,'moved obstacle must build a new offset');
clearBodyCache();runOperation([obstacle],{type:'barrierPreparedPreview',features:[feature],showBarrierGap:false});assert.equal(clearanceCacheStats.builds,4,'native token reset must not reuse an unrelated body');
clearClearanceCache();const base=R.makeBox([-15,-15,0],[15,15,20]),a=R.makeCylinder(2,25,[-5,0,0]),b=R.makeCylinder(3,25,[5,0,0]),compound=R.makeCompound([a.clone(),b.clone()]).asShape3D(),snapshot=compound.serialize();
try{
 const first=cutWithClearance(base,[compound],.4);first.delete();const second=cutWithClearance(base,[compound],.4);
 try{assert.ok(Math.abs(R.measureVolume(second)-(18000-Math.PI*(2.4**2+3.4**2)*20))<1e-5);}finally{second.delete();}
 assert.equal(clearanceCacheStats.builds,2);assert.equal(clearanceCacheStats.hits,2);assert.equal(compound.serialize(),snapshot,'cached tools cannot mutate the input');
 clearClearanceCache();
 for(let i=0;i<17;i++){const body=R.makeCylinder(1+i/50,25),cut=cutWithClearance(base,[body],.2);cut.delete();body.delete();}
 assert.equal(clearanceCacheStats.builds,17);
 const old=R.makeCylinder(1,25),cut=cutWithClearance(base,[old],.2);cut.delete();old.delete();assert.equal(clearanceCacheStats.builds,18,'LRU evicts the oldest offset after 16 entries');
}finally{compound.delete();a.delete();b.delete();base.delete();clearClearanceCache();clearBodyCache();}
console.log('PASS obstacle-only offset reuse across depth changes, exact clearances, moved/gap/token invalidation, compound isolation and bounded eviction');
