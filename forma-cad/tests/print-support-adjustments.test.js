import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {validatePrintSupport} from '../src/print-support.js';
import {adjustSupportPreview,supportAdjustmentError,supportAdjustmentFields} from '../src/print-support-adjustments.js';
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
 const wider=await preview(broad,dense,{allowedFields:['wallPitch']});
 assert(wider.input.wallPitch>2);
 assert(wider.result.analysis.printSupport.count<=96);
 assert(wider.result.supportPreview.exportStatus.ok);
 const ready=await preview(broad,wider.input);
 assert.equal(ready.attempts,0);
 assert.equal(ready.adjustment,undefined);
});

test('skin clearance is recovered only on the obstructed face and survives replay',async()=>{
 const parts=[R.makeBox([0,0,30],[24,18,33]),R.makeBox([0,0,0],[2,18,30]),R.makeBox([-12,0,15],[0,18,18])];
 const joined=parts[0].fuse(parts[1]),channel=joined.fuse(parts[2]);
 parts.forEach(shape=>shape.delete());joined.delete();
 const features=[record('top',channel),record('obstacle',R.makeBox([-13,-1,0],[-.05,19,14.5]))];
 const input=spec({baseMode:'bedOrModel',sideGap:0,wallBottomSkin:true,bottomSkinLayers:1});
 const original=runOperation(features,input);
 assert.equal(original.analysis.printSupport.faceCount,1);
 let report;
 const repaired=await preview(features,input,{onReport:value=>{report=value;}});
 assert.equal(repaired.input.wallRoof,true);
 assert.equal(repaired.input.wallBottomSkin,true);
 assert.equal(repaired.input.faceOverrides.length,1);
 const [override]=repaired.input.faceOverrides;
 assert.equal(override.selection.point[2],15);
 assert.equal(override.wallRoof,false);
 assert.equal(override.wallBottomSkin,false);
 assert.equal(repaired.result.analysis.printSupport.faceCount,2);
 assert.equal(repaired.result.analysis.printSupport.roof.count,1);
 assert.equal(repaired.result.analysis.printSupport.bottomSkin.count,1);
 assert.equal(repaired.result.supportPreview.coverage.find(row=>row.selection.point[2]===30).skin.upper.present,true);
 assert.equal(repaired.result.supportPreview.coverage.find(row=>row.selection.point[2]===15).skin.upper.present,false);
 assert(repaired.result.supportPreview.exportStatus.ok);
 assert(report.trials[0].faces.some(face=>!face.placed&&face.selection.point[2]===15));
 assert(report.trials.find(trial=>trial.number===report.selected).faces.some(face=>face.placed&&face.selection.point[2]===15));
 const {supportPackage,supportPreview,...stored}=repaired.result;
 const saved=[...features,{kind:'cadop',id:input.id,spec:{...repaired.input,preview:false},...stored}];
 const replay=runOperation(saved,{type:'replay',before:saved,start:features.length,forceFull:true}).features.at(-1);
 assert.equal(replay.spec.faceOverrides[0].wallRoof,false);
 assert.equal(replay.analysis.printSupport.faceCount,2);
 const held=await preview(features,input,{allowedFields:supportAdjustmentFields.filter(key=>key!=='wallRoof')});
 assert.equal(held.adjustment,undefined);
 assert.equal(held.result.analysis.printSupport.roof.count,1);
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

test('fixed settings exclude candidates and keep the original failed-face report',async()=>{
 const selection={bodyId:'top',point:[1,2,8],normal:[0,0,-1]};
 const blocked=supportAdjustmentError('ベッドから遮られています',{kind:'base-blocked',selection});
 let calls=0,report;
 await assert.rejects(adjustSupportPreview(spec(),{
  allowedFields:['roofLayers'],
  run:()=>{calls++;throw blocked;},
  onReport:value=>{report=value;},
 }),error=>error===blocked);
 assert.equal(calls,1);
 assert.equal(report.selected,null);
 assert.deepEqual(report.trials[0].faces[0].selection,selection);
});

test('the comparison ranks later verified candidates by skin area and unsupported width',async()=>{
 const input=spec();
 const selection={bodyId:'top',point:[1,2,8],normal:[0,0,-1]};
 let report;
 const reportFor=(width,gap)=>{
  const result=complete();
  result.supportPreview.coverage=[{ceilingId:'original',selection,
   bridges:{max:gap,unbraced:1},skinSupport:{face:{vertices:[0,0,8,width,0,8,0,2,8],triangles:[0,1,2]}}}];
  return result;
 };
 const result=await adjustSupportPreview(input,{
  initial:()=>{throw supportAdjustmentError('薄壁の本数が多すぎます',{kind:'rib-limit',total:120,selection});},
  run:settings=>settings.wallDirection==='y'?reportFor(12,4):settings.wallPitch>11?reportFor(12,7):reportFor(9,7),
  onReport:value=>{report=value;},
 });
 assert.equal(result.input.wallDirection,'y');
 assert.equal(report.selected,3);
 assert.deepEqual(report.trials.slice(1).map(row=>row.quality.roofArea),[9,12,12]);
 assert(report.trials.slice(1).every(row=>row.status==='ready'));
});
