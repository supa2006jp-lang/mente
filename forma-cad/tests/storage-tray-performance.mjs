import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults} from '../src/geometry.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {storageTrayHistory} from '../src/storage-tray-history.js';
import {makeStorageTray,storageTrayOutlineStats} from '../src/part-workshop.js';
import {binaryStlReport} from './stl-topology.mjs';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const original=[{...defaults,kind:'extrusion',id:'box',name:'箱',width:20,height:30,depth:15,x:-25},{...defaults,kind:'extrusion',id:'round',name:'丸棒',profile:'circle',diameter:18,depth:20,x:25},{...defaults,kind:'extrusion',id:'obstacle',name:'別の部品',width:100,height:100,depth:10,x:150}],bodies=kernelBodies(original),out='.sites-runtime/storage-tray-performance';await fs.mkdir(out,{recursive:true});
const bounds=shape=>{const b=shape.boundingBox;try{return b.bounds;}finally{b.delete();}};
const snapshot=()=>[...bodies].map(([id,s])=>({id,volume:R.measureVolume(s),bounds:bounds(s)})),before=snapshot();
async function stl(shape){const report=binaryStlReport(Buffer.from(await shape.blobSTL({binary:true,tolerance:.02,angularTolerance:.1}).arrayBuffer()));for(const k of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[k],0,k);return report;}
try{
 const outputs=[...bodies].map(([id,s])=>({id,brep:s.serialize(),...s.mesh()})),history=[...original,...Array.from({length:16},(_,i)=>({kind:'cadop',id:'snapshot-'+i,name:'CAD工程',spec:{type:'import'},outputs,remove:[]}))],compact=storageTrayHistory(history);
 assert.equal(compact.length,1);assert.equal(compact[0].outputs.length,3,'Placement must retain unselected bodies');assert(!JSON.stringify(compact).includes('triangles'));assert(JSON.stringify(compact).length<JSON.stringify(history).length/10);
 const rebuilt=kernelBodies(compact);try{assert.deepEqual([...rebuilt.keys()],[...bodies.keys()]);for(const [id,s]of rebuilt){assert(Math.abs(R.measureVolume(s)-R.measureVolume(bodies.get(id)))<1e-7);assert.deepEqual(bounds(s),bounds(bodies.get(id)));}}finally{rebuilt.forEach(s=>s.delete());}
 const legacy={kind:'cadop',id:'legacy',spec:{type:'enclose',target:'box'},outputs:[outputs[0]],remove:[]};assert.equal(storageTrayHistory([...original,legacy]).at(-1).spec.type,'enclose','Legacy boundary repair retains its input history');
 const texts=['L','O'],patterns=[{text:'L',aspect:1,regions:[{outer:[[0,0],[1,0],[1,.2],[.2,.2],[.2,1],[0,1]],holes:[]}]},{text:'O',aspect:1,regions:[{outer:[[0,0],[1,0],[1,1],[0,1]],holes:[[[.3,.3],[.3,.7],[.7,.7],[.7,.3]]]}]}],p={id:'tray',type:'storageTray',targets:['box','round'],columns:2,clearance:.4,wall:2,floor:2,depth:10,gap:3,fingerAccess:true,fingerRadius:4,labels:true,labelTexts:texts,labelPatterns:patterns};
 const misses=storageTrayOutlineStats.misses,first=makeStorageTray(bodies,p);let second;
 try{assert.equal(storageTrayOutlineStats.misses-misses,2);const hits=storageTrayOutlineStats.hits;second=makeStorageTray(bodies,{...p,columns:1,depth:12});assert.equal(storageTrayOutlineStats.hits-hits,2);const a=await stl(first.shape),b=await stl(second.shape);assert.equal(first.info.pockets.length,2);assert.equal(second.info.pockets.length,2);assert.notEqual(a.volume,b.volume);}
 finally{first.shape.delete();second?.shape.delete();}
 const moved=bodies.get('round').clone().translate([10,0,0]);try{const count=storageTrayOutlineStats.misses,result=makeStorageTray(new Map([...bodies,['round',moved]]),p);try{assert.equal(storageTrayOutlineStats.misses,count+1,'Changed geometry invalidates its outline');await stl(result.shape);}finally{result.shape.delete();}}finally{moved.delete();}
 const full=runOperation(history,p),reduced=runOperation(compact,p);const a=R.deserializeShape(full.outputs[0].brep).asShape3D(),b=R.deserializeShape(reduced.outputs[0].brep).asShape3D();try{assert(Math.abs(R.measureVolume(a)-R.measureVolume(b))<1e-6);assert.deepEqual(full.analysis.storageTray.offset,reduced.analysis.storageTray.offset);await stl(b);}finally{a.delete();b.delete();}
 assert.deepEqual(snapshot(),before);const proof={pass:true,syntheticFixturesOnly:true,currentExactBodies:true,unselectedPlacementBodiesPreserved:true,legacyEnclosureFallback:true,smallPayload:true,outlinesReused:true,changedGeometryInvalidates:true,sourceGeometryPreserved:true,closedStl:true};await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(proof);
}finally{bodies.forEach(s=>s.delete());}
