import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {before,test} from 'node:test';
import * as R from 'replicad';
import init from 'replicad-opencascadejs';
import {makeWallTies} from '../src/print-support-wall-ties.js';
import {makePrintSupport,printSupportDefaults} from '../src/print-support.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {cadMesh} from '../src/cad-mesh.js';

before(async()=>{
 const wasm=new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url);
 R.setOC(await init({wasmBinary:await readFile(wasm)}));
});

test('tall stacks of ties use each valid height when an obstruction interrupts the stack',()=>{
 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const prism=hold(R.makeBox([0,0,0],[12,10,102]));
  const left=hold(R.makeBox([1.6,0,0],[2.4,10,101]));
  const right=hold(R.makeBox([9.6,0,0],[10.4,10,101]));
  const oneLevel=hold(R.makeBox([5,2.8,40.1],[7,3.8,41]));
  const between=hold(R.makeBox([5,2.8,46],[7,3.8,49]));
  const fins=[{id:'left',axis:0,center:2,shape:left,span:[0,10]},{id:'right',axis:0,center:10,shape:right,span:[0,10]}];
  const spec={...printSupportDefaults,wallPitch:8,tieInterval:20,layerHeight:.3};
  for(const [obstacle,count,skipped] of [[null,8,0],[oneLevel,7,1],[between,8,0]]){
   const bodies=new Map(obstacle?[['obstacle',obstacle]]:[]);
   const ties=makeWallTies(fins,prism,bodies,spec,undefined,[{span:[0,10]}]);
   ties.shapes.forEach(hold);
   assert.equal(ties.shapes.length,count);
   assert.equal(ties.skipped,skipped);
   assert.deepEqual(ties.levels,[20.1,40.2,60,80.1]);
   if(obstacle)for(const tie of ties.shapes){
    const collision=hold(tie.intersect(obstacle));
    assert(Math.abs(R.measureVolume(collision))<1e-8);
   }
  }
 }finally{owned.reverse().forEach(shape=>shape.delete());}
});

test('changing tie spacing reuses the fins and skins and computes the new ties',()=>{
 const ceiling=R.makeBox([0,0,44],[32,26,47]);
 try{
  const features=[{kind:'cadop',id:'ceiling',remove:[],outputs:[{id:'ceiling',...cadMesh(ceiling),brep:serializeCadShape(ceiling)}]}];
  const settings={type:'printSupport',id:'support',style:'walls',target:'ceiling',mode:'auto',
   wallPitch:10,wallDirection:'x',wallRoof:true,wallTies:true,tieInterval:12,topGap:.3,preview:true,
   contactLines:true,topContactRim:true,edgeRibs:true};
  const before=runOperation(features,settings),stages=[];
  const revised={...settings,tieInterval:19};
  const after=runOperation(features,revised,update=>stages.push(update.stage));
  const analysis=after.analysis.printSupport;
  assert.deepEqual(analysis.ceilingReuse,{reused:1,rebuilt:0});
  assert.ok(stages.includes('計算済みの線状接触層を再利用しています'));
  assert.ok(!stages.some(stage=>stage?.startsWith('薄壁サポートを作成しています')));
  assert.notDeepEqual(analysis.wallTies.levels,before.analysis.printSupport.wallTies.levels);
  const nativeBodies=kernelBodies(features);
  try{
   const cold=makePrintSupport(nativeBodies,revised);
   try{
    assert.deepEqual(analysis.wallTies,cold.analysis.wallTies);
    assert.deepEqual(analysis.contactInterface,cold.analysis.contactInterface);
    assert.ok(Math.abs(analysis.material.volume-R.measureVolume(cold.shape))<1e-6);
    assert.ok(after.supportPreview.exportStatus.ok);
   }finally{cold.shape?.delete();cold.blockers.forEach(s=>s.delete());}
  }finally{for(const shape of nativeBodies.values())shape.delete();}
 }finally{ceiling.delete();}
});
