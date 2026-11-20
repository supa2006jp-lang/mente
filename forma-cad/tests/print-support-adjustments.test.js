import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {validatePrintSupport} from '../src/print-support.js';
import {adjustSupportPreview,supportAdjustmentError} from '../src/print-support-adjustments.js';
import {printSupport3mf} from '../src/print-support-3mf.js';

const spec=values=>validatePrintSupport({type:'printSupport',id:'ribs',target:'top',style:'walls',mode:'auto',baseMode:'bed',
 wallDirection:'x',wallPitch:8,wallThickness:.8,layerHeight:.3,topGap:.3,sideGap:.5,wallRoof:true,roofLayers:2,
 edgeRibs:true,wallTies:false,preview:true,...values});
const record=(id,shape)=>{
 try{return {id,kind:'cadop',outputs:[{id,...cadMesh(shape),brep:shape.serialize()}],remove:[]};}
 finally{shape.delete();}
};
const preview=(features,settings,options={})=>adjustSupportPreview(settings,{run:input=>runOperation(features,input),...options});

test('real rib previews rescue model landings, limited roof height and excessive rib counts',async()=>{
 const wasmBinary=await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
 R.setOC(await init({wasmBinary}));
 const stacked=[
  record('top',R.makeBox([0,0,8],[25,20,11])),
  record('base',R.makeBox([-1,-1,0],[26,21,5])),
 ];
 const bed=spec(),snapshot=JSON.stringify(bed);
 assert.throws(()=>runOperation(stacked,bed),error=>error.supportAdjustmentHints.some(hint=>hint.kind==='base-blocked'));
 await assert.rejects(preview(stacked,bed,{enabled:false}));
 const recovered=await preview(stacked,bed);
 assert.equal(recovered.input.baseMode,'bedOrModel');
 assert.equal(recovered.input.sideGap,.5);
 assert.equal(recovered.input.topGap,.3);
 assert.equal(recovered.input.wallThickness,.8);
 assert.deepEqual(recovered.result.analysis.printSupport.baseBodyIds,['base']);
 assert.equal(JSON.stringify(bed),snapshot);
 assert(printSupport3mf(recovered.result.supportPackage).length>0);

 const low=[record('top',R.makeBox([0,0,1.6],[25,20,4]))];
 const tall=spec({roofLayers:6,mode:'face',faces:[{bodyId:'top',point:[8,8,1.6],normal:[0,0,-1]}]});
 assert.throws(()=>runOperation(low,tall),/薄皮を置く高さが足りません/);
 const thinner=await preview(low,tall);
 assert.equal(thinner.input.roofLayers,3);
 assert.deepEqual(thinner.input.faces,tall.faces);
 assert.equal(thinner.result.analysis.printSupport.roof.count,1);
 assert(thinner.result.supportPreview.exportStatus.ok);
 const autoThin=await preview(low,spec({roofLayers:6}));
 assert.equal(autoThin.input.roofLayers,3,'a single ceiling displays the new value in the common field');
 const slabs=[R.makeBox([0,0,1.6],[25,20,4]),R.makeBox([35,0,12],[60,20,15])];
 let mixed;
 try{mixed=[record('top',R.makeCompound(slabs))];}finally{slabs.forEach(shape=>shape.delete());}
 const oneCeiling=await preview(mixed,spec({roofLayers:6}));
 assert.equal(oneCeiling.input.roofLayers,6);
 assert.equal(oneCeiling.input.faceOverrides.length,1);
 assert.equal(oneCeiling.input.faceOverrides[0].roofLayers,3);
 assert.equal(oneCeiling.result.analysis.printSupport.roof.count,2);

 const broad=[record('top',R.makeBox([0,0,7],[12,198,9]))];
 const dense=spec({wallPitch:2,wallRoof:false});
 assert.throws(()=>runOperation(broad,dense),error=>error.supportAdjustmentHints[0].kind==='rib-limit');
 const wider=await preview(broad,dense);
 assert(wider.input.wallPitch>2);
 assert(wider.result.analysis.printSupport.count<=96);
 assert(wider.result.supportPreview.exportStatus.ok);
 const ready=await preview(broad,wider.input);
 assert.equal(ready.attempts,0);
 assert.equal(ready.adjustment,undefined);
});

const complete=(metrics={})=>({
 outputs:[{}],analysis:{printSupport:{faceCount:1,roof:{count:1},bottomSkin:{count:0},...metrics}},
 supportPreview:{exportStatus:{ok:true},ribs:[{ceilingId:'original'}]},
});

test('failed trials preserve the initial diagnostics and previously supported ceilings',async()=>{
 const settings=spec({mode:'face',faces:[{bodyId:'top',point:[0,0,5],normal:[0,0,-1]}]});
 const permanent=Error('水平な下面がありません');
 let calls=0;
 await assert.rejects(adjustSupportPreview(settings,{run:()=>{calls++;throw permanent;}}),error=>error===permanent);
 assert.equal(calls,1);
 const blocked=complete({skippedCeilings:[{height:7}]});
 blocked.supportPreview.adjustmentHints=[{kind:'skin-clearance',role:'upper',available:.4}];
 const poorer=complete({roof:{count:0},faceCount:2});
 const result=await adjustSupportPreview(settings,{initial:()=>blocked,run:()=>poorer});
 assert.equal(result.result,blocked);
 assert.equal(result.input,settings);
 assert.equal(result.adjustment,undefined);
});

test('changing the draft while a trial is in progress discards that trial',async()=>{
 const input=spec(),blocked=supportAdjustmentError('blocked',{kind:'base-blocked'});
 let active=true;
 await assert.rejects(adjustSupportPreview(input,{
  initial:()=>{throw blocked;},
  run:()=>{active=false;return complete();},
  current:()=>active,
 }),error=>error===blocked);
});
