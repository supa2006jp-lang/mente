import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {before,test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {runOperation} from '../src/kernel.js';
import {printSupport3mf} from '../src/print-support-3mf.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {createPrintSupportCache} from '../src/print-support-cache.js';
import {fuseSupportSolids} from '../src/print-support-solid-groups.js';
import {supportHistoryFeature} from '../src/print-support-batch.js';

before(async()=>{
 R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
});

test('thin rib and bridge faces retain CAD precision when fused away from the origin',()=>{
 const ceiling=R.makeBox([83,80,85],[97,140,88]);
 try{
  const outputs=[{id:'ceiling',...cadMesh(ceiling),brep:serializeCadShape(ceiling)}];
  const features=[{id:'ceiling',name:'Ceiling',kind:'cadop',outputs,remove:[]}];
  const snapshot=JSON.stringify(features);
  const settings={
   type:'printSupport',id:'support',target:'ceiling',style:'walls',mode:'auto',
   wallDirection:'x',wallPitch:10,edgeMargin:.1,edgeRibs:true,
   wallRoof:true,wallBottomSkin:true,bottomSkinLayers:1,wallTies:true,tieInterval:20,
   contactLines:true,topContactRim:true,topContactRimWidth:2,interfaceSpacing:.2,
   layerHeight:.3,topGap:.3,preview:true
  };
  const result=runOperation(features,settings);
  const analysis=result.analysis.printSupport;
  assert.equal(analysis.count,7);
  assert.equal(analysis.components,1);
  assert.equal(analysis.wallTies.count,48);
  assert.equal(analysis.roof.count,1);
  assert.equal(analysis.bottomSkin.count,1);
  assert.ok(inspectCadStl(result.outputs[0]).report.ok);
  assert.ok(result.supportPreview.exportStatus.ok);
  assert.ok(printSupport3mf(result.supportPackage).length>0);
  const changed=runOperation(features,{...settings,tieInterval:22});
  assert.notDeepEqual(changed.analysis.printSupport.wallTies.levels,analysis.wallTies.levels);
  const stages=[];
  const restored=runOperation(features,{...settings,wallPitch:10.1},update=>stages.push(update.stage));
  assert.equal(restored.analysis.printSupport.ceilingLayoutReuse?.reused,1);
  assert(stages.includes('作成済みの横つなぎを再利用しています'));
  assert(stages.includes('結合済みのリブを再利用しています'));
  assert(stages.includes('線状接触層とリブの表示を再利用しています'));
  assert.deepEqual(restored.analysis.printSupport.wallTies.levels,analysis.wallTies.levels);
  assert.equal(restored.outputs[0].brep,result.outputs[0].brep);
  assert.deepEqual(restored.supportPreview.contact,result.supportPreview.contact);
  assert(restored.supportPreview.exportStatus.ok);
  assert.equal(JSON.stringify(features),snapshot);
 }finally{ceiling.delete();}
});

test('an unchanged support group can be reused when another group changes',()=>{
 const shapes=[[0,10],[9,15],[30,40],[39,44],[39,46]]
  .map(([start,end])=>R.makeBox([start,0,0],[end,3,4]));
 const cache=createPrintSupportCache(200_000,8);
 let initial,revised;
 try{
  initial=fuseSupportSolids(shapes.slice(0,4),{cache});
  const stages=[];
  revised=fuseSupportSolids([...shapes.slice(0,3),shapes[4]],{cache,onProgress:update=>stages.push(update.stage)});
  assert.equal(stages.filter(stage=>stage==='結合済みのリブを再利用しています').length,1);
  const solids=revised.solids;
  try{assert.equal(solids.length,2);}finally{solids.forEach(shape=>shape.delete());}
  assert.ok(Math.abs(R.measureVolume(initial)-348)<1e-6);
  assert.ok(Math.abs(R.measureVolume(revised)-372)<1e-6);
 }finally{initial?.delete();revised?.delete();shapes.forEach(shape=>shape.delete());}
});

test('matching rib positions survive a body switch and checked previews recheck neighboring supports',()=>{
 const a=R.makeBox([0,0,32],[32,26,35]),b=R.makeBox([55,0,32],[87,26,35]);
 const conflict=R.makeBox([55,0,0],[87,26,20]);
 const feature=(id,shape)=>({kind:'cadop',id,remove:[],outputs:[{id,...cadMesh(shape),brep:serializeCadShape(shape)}]});
 try{
  const features=[feature('a',a),feature('b',b)];
  const settings={type:'printSupport',style:'walls',mode:'auto',topGap:.3,wallDirection:'x',wallPitch:10,edgeRibs:true,
   wallRoof:true,wallTies:false,preview:true,batch:true,batchGroup:'checked-supports'};
  const first={...settings,id:'ribs-a',target:'a'},second={...settings,id:'ribs-b',target:'b'};
  const original=runOperation(features,first);
  const firstFeature=supportHistoryFeature(first,original);
  const separate=runOperation([...features,firstFeature],second);
  const stages=[];
  const edited={...first,wallPitch:10.1};
  const same=runOperation(features,edited,update=>stages.push(update.stage));
  const ribCenters=preview=>preview.supportPreview.ribs.map(({center})=>center);
  assert.deepEqual(ribCenters(original),ribCenters(same));
  assert.equal(same.analysis.printSupport.ceilingLayoutReuse?.reused,1);
  assert.equal(same.supportPreview.coverage[0].settings.wallPitch,10.1);
  assert(!stages.some(stage=>stage.startsWith('薄壁サポートを作成しています')));
  assert(same.supportPreview.exportStatus.ok);
  const wider=runOperation(features,{...edited,wallPitch:7});
  assert.notDeepEqual(ribCenters(wider),ribCenters(same));
  assert.equal(wider.analysis.printSupport.ceilingLayoutReuse,undefined);
  const latest=[...features,supportHistoryFeature(edited,same)],neighborStages=[];
  const reused=runOperation(latest,second,update=>neighborStages.push(update.stage));
  assert(neighborStages.includes('検査済みのリブプレビューを再利用しています'));
  assert.deepEqual(reused.supportPackage,separate.supportPackage);
  const occupied={...firstFeature,outputs:[{...firstFeature.outputs[0],brep:serializeCadShape(conflict)}]};
  assert.throws(()=>runOperation([...features,occupied],second),/作成済みのサポートと重なります/);
 }finally{a.delete();b.delete();conflict.delete();}
});
