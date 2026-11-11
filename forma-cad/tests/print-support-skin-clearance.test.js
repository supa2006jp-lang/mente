import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as THREE from 'three';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {runOperation} from '../src/kernel.js';
import {printSupport3mf} from '../src/print-support-3mf.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';
import {supportBatchPackage,supportHistoryFeature} from '../src/print-support-batch.js';
import {savedSupportExportGroups} from '../src/print-support-export-choice.js';
import {inspectSupportRemoval} from '../src/print-support-removal.js';

test('an obstructed ceiling does not prevent automatic rib support under other ceilings',async()=>{
 const wasmBinary=await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
 R.setOC(await init({wasmBinary}));
 const parts=[
  R.makeBox([0,0,30],[24,18,33]),
  R.makeBox([0,0,0],[2,18,30]),
  R.makeBox([-12,0,15],[0,18,18]),
 ];
 const obstacle=R.makeBox([-13,-1,0],[-.05,19,14.5]);
 const partialObstacle=R.makeBox([-13,-1,0],[-.05,4,14.5]);
 let model=parts[0].clone();
 try{
  for(const part of parts.slice(1)){const next=model.fuse(part);model.delete();model=next;}
  const feature=(id,shape)=>({id,kind:'cadop',outputs:[{id,...cadMesh(shape),brep:serializeCadShape(shape)}],remove:[]});
  const features=[feature('model',model),feature('obstacle',obstacle)],original=JSON.stringify(features);
  const spec={id:'ribs',type:'printSupport',target:'model',style:'walls',mode:'auto',baseMode:'bedOrModel',
   wallDirection:'x',wallPitch:8,edgeRibs:true,wallRoof:true,roofLayers:2,wallBottomSkin:true,bottomSkinLayers:1,
   layerHeight:.3,topGap:.3,preview:true};
  const result=runOperation(features,spec),analysis=result.analysis.printSupport;
  assert.equal(analysis.faceCount,1);
  assert.equal(analysis.components,1);
  assert.equal(analysis.roof.count,1);
  assert.equal(analysis.bottomSkin.count,1);
  assert.deepEqual(analysis.skippedCeilings,[{height:15,reason:'support-skin-clearance'}]);
  assert.ok(analysis.clearanceRegions.some(region=>region.role==='lower'&&!region.partial
   &&Math.abs(region.available-.2)<1e-6&&Math.abs(region.thickness-.3)<1e-6));
  assert.deepEqual(result.supportPackage.bodies.map(body=>body.id),['model','ribs']);
  assert.equal(result.supportPackage.blockers.length,1);
  assert.ok(result.supportPackage.blockers[0].vertices.every((v,i)=>i%3!==0||v>=2-1e-6),'only the successful ceiling blocks slicer supports');
  assert.ok(result.supportPreview.exportStatus.ok);
  assert.ok(printSupport3mf(result.supportPackage).length>0);
  assert.ok(inspectCadStl(result.outputs[0]).report.ok);
  const face={bodyId:'model',point:[-6,9,15],normal:[0,0,-1]};
  assert.throws(()=>runOperation(features,{...spec,mode:'face',faces:[face]}),/底面の薄皮を置く高さが足りない/);
  const topOnly=runOperation(features,{...spec,wallBottomSkin:false});
  assert.deepEqual(topOnly.analysis.printSupport.skippedCeilings,analysis.skippedCeilings);
  assert.throws(()=>runOperation(features,{...spec,mode:'face',faces:[face],wallBottomSkin:false}),/上面の薄皮が.*干渉/);
  assert.equal(JSON.stringify(features),original);
  const partialFeatures=[features[0],feature('obstacle',partialObstacle)];
  const partial=runOperation(partialFeatures,spec),partialAnalysis=partial.analysis.printSupport;
  assert.equal(partialAnalysis.faceCount,2);
  assert.equal(partialAnalysis.roof.count,2);
  assert.equal(partialAnalysis.skippedCeilings,undefined);
  assert.ok(partialAnalysis.clearanceRegions.some(region=>region.partial));
  assert.ok(partial.supportPreview.exportStatus.ok);
  const coverage=partial.supportPreview.coverage;
  const small=coverage.find(item=>item.selection.point[2]===15);
  const large=coverage.find(item=>item.selection.point[2]===30);
  assert.ok(small.supported.vertices.length,'the partially covered ceiling has a clipped blocker cap');
  assert.equal(large.supported,true);
  const changed=runOperation(partialFeatures,{...spec,edgeRibs:false,faceOverrides:[{selection:large.selection,wallPitch:4,roofLayers:1,bottomSkinLayers:2}]});
  const changedLarge=changed.supportPreview.coverage.find(item=>item.selection.point[2]===30);
  const changedSmall=changed.supportPreview.coverage.find(item=>item.selection.point[2]===15);
  assert.deepEqual(changedLarge.settings,{wallPitch:4,roofLayers:1,bottomSkinLayers:2});
  assert.deepEqual(changedSmall.settings,{wallPitch:8,roofLayers:2,bottomSkinLayers:1});
  assert.ok(changedLarge.caution?.triangles.length);
  const thinner=R.deserializeShape(changed.outputs[0].brep).asShape3D();
  const originalSkin=R.deserializeShape(partial.outputs[0].brep).asShape3D();
  const sample=R.makeBox([9.9,6.9,29.2],[10.1,7.1,29.3]);
  const before=originalSkin.intersect(sample),after=thinner.intersect(sample);
  try{
   assert.ok(R.measureVolume(before)>.001);
   assert.ok(R.measureVolume(after)<1e-6,'the overridden ceiling actually has a thinner skin');
  }finally{before.delete();after.delete();thinner.delete();originalSkin.delete();sample.delete();}
  const selected=runOperation(partialFeatures,{...spec,mode:'face',faces:[large.selection]});
  assert.equal(selected.supportPreview.coverage.find(item=>item.selection.point[2]===15).supported,null);
  const smallBlocker=partial.supportPackage.blockers.find(mesh=>mesh.vertices.some((v,i)=>i%3===0&&v<0));
  assert.ok(smallBlocker);
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(smallBlocker.vertices,3)).setIndex(smallBlocker.triangles);
  const material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
  try{
   const covered=y=>new THREE.Raycaster(new THREE.Vector3(-6,y,20),new THREE.Vector3(0,0,-1)).intersectObject(mesh).length>0;
   assert.equal(covered(2),false,'the 3MF blocker leaves the excluded column open for automatic supports');
   assert.equal(covered(10),true,'the successful part of the ceiling still blocks automatic supports');
  }finally{geometry.dispose();material.dispose();}
  assert.ok(printSupport3mf(partial.supportPackage).length>0);

  const contacts={...spec,contactLines:true,wallTies:true,tieInterval:12,bottomContactLines:false};
  const first=runOperation(partialFeatures,contacts);
  const stages=[];
  const adjusted={...contacts,interfaceSpacing:.8};
  const second=runOperation(partialFeatures,adjusted,update=>stages.push(update.stage));
  const fresh=runOperation(partialFeatures,{...adjusted,id:'other-support'});
  assert.equal(first.analysis.printSupport.reusedStructure,undefined);
  assert.equal(second.analysis.printSupport.reusedStructure,true);
  assert.equal(second.analysis.printSupport.contactInterface.spacing,.8);
  assert.equal(second.analysis.printSupport.contactInterface.slots,fresh.analysis.printSupport.contactInterface.slots);
  assert.ok(Math.abs(second.outputs[0].shapeMetrics.volume-fresh.outputs[0].shapeMetrics.volume)<1e-6);
  assert.ok(second.supportPreview.exportStatus.ok);
  assert.ok(stages.includes('リブ本体と横つなぎを再利用しています'));
  assert.ok(!stages.some(stage=>stage?.startsWith('薄壁サポートを作成しています')));
  const changedGeometry=runOperation(features,{...adjusted,id:'other-support'});
  assert.equal(changedGeometry.analysis.printSupport.reusedStructure,undefined);
  assert.equal(changedGeometry.analysis.printSupport.faceCount,1);
  const changedPitch=runOperation(features,{...adjusted,id:'other-support',wallPitch:6});
  assert.equal(changedPitch.analysis.printSupport.reusedStructure,undefined);
 }finally{model.delete();obstacle.delete();partialObstacle.delete();parts.forEach(part=>part.delete());}
});

test('a batch exports independent successful supports once and rejects overlapping supports',()=>{
 const makeTarget=(id,position)=>{const shape=R.makeBox([position,0,12],[position+18,18,15]);
  try{return {id,kind:'cadop',outputs:[{id,...cadMesh(shape),brep:serializeCadShape(shape)}],remove:[]};}
  finally{shape.delete();}
 };
 const features=[makeTarget('a',0),makeTarget('b',35)];
 const settings={type:'printSupport',style:'walls',batch:true,mode:'auto',baseMode:'bed',wallPitch:8,layerHeight:.3,topGap:.3};
 const a={...settings,id:'support-a',target:'a'},b={...settings,id:'support-b',target:'b'};
 const first=runOperation(features,{...a,preview:true}),history=[...features,supportHistoryFeature(a,first)];
 const second=runOperation(history,{...b,preview:true});
 assert.equal(second.analysis.printSupport.baseBodyIds.length,0);
 assert.throws(()=>runOperation(history,{...a,id:'overlap',preview:true}),/作成済みのサポートと重なります/);
 const pkg=supportBatchPackage([{result:first},{result:second},{result:first}]);
 assert.deepEqual(pkg.bodies.map(body=>body.id),['a','support-a','b','support-b']);
 assert.ok(printSupport3mf(pkg).length>0);
 const saved=[...history,supportHistoryFeature(b,second)];
 const moved={type:'move',id:'move',target:'a',rotation:[0,0,90],pivot:[0,0,0],x:6,y:11,z:0};
 const result=runOperation(saved,moved);
 assert.deepEqual(result.outputs.map(output=>output.id).sort(),['a','support-a']);
 const relocated=[...saved,{kind:'cadop',id:moved.id,spec:moved,...result}];
 const exportSpec={type:'printSupportSavedExport',ids:[a.id,b.id]};
 const legacy=structuredClone(relocated);delete legacy[2].analysis.supportExport;
 const restored=runOperation(legacy,exportSpec);
 assert.deepEqual(savedSupportExportGroups(relocated,['support-a','support-b']),[{ids:[a.id,b.id],index:2}]);
 const placed=runOperation(relocated,exportSpec);
 const xs=mesh=>mesh.vertices.filter((_,i)=>i%3===0);
 assert.ok(Math.abs(Math.min(...xs(placed.blockers[0]))+12)<1e-6);
 assert.ok(Math.abs(Math.min(...xs(placed.bodies.find(body=>body.id==='a')))+12)<1e-6);
 assert.deepEqual(restored.blockers[0],placed.blockers[0]);
 assert.ok(printSupport3mf(placed).length>0);
 const unlocked=structuredClone(saved);unlocked[2].analysis.supportLinks=[];
 const solo={...moved,id:'solo',target:'support-a'};
 assert.throws(()=>runOperation([...unlocked,{kind:'cadop',id:solo.id,spec:solo,...runOperation(unlocked,solo)}],exportSpec),/位置がずれています/);
});

test('coverage measures warning lengths along holes and recessed contours',()=>{
 const outer=R.makeBox([0,0,12],[28,28,15]),hole=R.makeBox([10,10,11],[18,18,16]);
 const notch=R.makeBox([0,20,11],[8,26,16]),ring=outer.cut(hole),model=ring.cut(notch);
 try{
  const features=[{id:'ring',kind:'cadop',outputs:[{id:'ring',...cadMesh(model),brep:serializeCadShape(model)}],remove:[]}];
  const result=runOperation(features,{type:'printSupport',id:'ribs',target:'ring',style:'walls',wallDirection:'x',wallPitch:8,edgeRibs:true,
   layerHeight:.3,topGap:.3,preview:true});
  const warnings=result.supportPreview.coverage[0].boundaryWarnings;
  const points=warnings.flatMap(row=>Array.from({length:row.segments.length/3},(_,i)=>row.segments.slice(i*3,i*3+2)));
  assert.ok(points.some(([x,y])=>x>=10&&x<=18&&y>=10&&y<=18),'inner hole edge');
  assert.ok(points.some(([x,y])=>x===8&&y>20&&y<26),'concave notch edge');
  assert.ok(warnings.some(row=>row.length>1&&row.maxGap>1),'warning lengths and rib distances');
 }finally{outer.delete();hole.delete();notch.delete();ring.delete();model.delete();}
});

test('automatic ribs omit the narrow exterior lip and disconnected pieces below an obstruction',()=>{
 const top=R.makeBox([-2,0,18],[26,20,21]),left=R.makeBox([0,0,0],[2,20,18]);
 const right=R.makeBox([24,0,0],[26,20,18]),shelf=R.makeBox([22,0,9],[24,20,11]);
 const first=top.fuse(left),second=first.fuse(right),model=second.fuse(shelf);
 const obstruction=R.makeBox([1.5,-1,5],[24.5,21,7]);
 const outside=R.makeBox([-2.5,-1,0],[-.05,21,18]);
 const covered=R.makeBox([9.1,1,.1],[13.9,19,4.9]);
 const solids=[top,left,right,shelf,first,second,model,obstruction,outside,covered];
 function volumeIn(output,probe){
  const shape=R.deserializeShape(output.brep).asShape3D(),common=shape.intersect(probe);
  try{return R.measureVolume(common);}finally{shape.delete();common.delete();}
 }
 try{
  const feature=(id,shape)=>({id,kind:'cadop',outputs:[{id,...cadMesh(shape),brep:serializeCadShape(shape)}],remove:[]});
  const features=[feature('cabinet',model),feature('obstruction',obstruction)];
  const spec={type:'printSupport',id:'support',target:'cabinet',style:'walls',mode:'auto',baseMode:'bedOrModel',
   wallDirection:'x',wallPitch:8,edgeRibs:true,wallRoof:true,wallBottomSkin:true,layerHeight:.3,topGap:.3,preview:true};
  const previous=runOperation(features,spec),next=runOperation(features,{...spec,skipSmallExterior:true});
  assert.ok(volumeIn(previous.outputs[0],outside)>1);
  assert.ok(volumeIn(next.outputs[0],outside)<1e-6);
  assert.ok(volumeIn(previous.outputs[0],covered)>1);
  assert.ok(volumeIn(next.outputs[0],covered)<1e-6);
  const analysis=next.analysis.printSupport;
  assert.equal(analysis.omittedExterior.faces,1);
  assert.ok(analysis.omittedExterior.ribPieces>0);
  assert.ok(next.supportPreview.coverage.some(row=>row.selection.point[0]<0&&row.suppressed&&!row.supported));
  assert.ok(next.supportPreview.coverage.some(row=>Math.abs(row.selection.point[2]-9)<1e-6&&row.supported&&!row.suppressed),'retain the interior shelf');
  assert.ok(next.supportPackage.blockers.some(mesh=>mesh.vertices.some((value,i)=>i%3===0&&value<-.1)));
  assert.ok(next.supportPreview.exportStatus.ok);
  const exterior={bodyId:'cabinet',point:[-1,10,18],normal:[0,0,-1]};
  const manual=runOperation(features,{...spec,mode:'face',faces:[exterior],skipSmallExterior:true});
  assert.ok(volumeIn(manual.outputs[0],outside)>1);
 }finally{solids.forEach(shape=>shape.delete());}
});

test('a drawn exclusion clips every support layer and allows closer ribs inside its edges',()=>{
 const roof=R.makeBox([0,0,24],[30,24,27]),side=R.makeBox([28,0,0],[30,24,24]);
 const model=roof.fuse(side),area=R.makeBox([-.1,-.1,-.1],[8,12,24.3]);
 try{
  const features=[{id:'cabinet',kind:'cadop',outputs:[{id:'cabinet',...cadMesh(model),brep:serializeCadShape(model)}],remove:[]}];
  const zone={selection:{bodyId:'cabinet',point:[12,12,24],normal:[0,0,-1]},noSupport:[[0,0,8,12]]};
  const spec={type:'printSupport',id:'support',target:'cabinet',style:'walls',mode:'auto',baseMode:'bedOrModel',
   wallDirection:'y',wallPitch:10,wallRoof:true,wallBottomSkin:true,wallTies:true,tieInterval:8,
   layerHeight:.3,topGap:.3,faceOverrides:[zone],preview:true};
  const before=runOperation(features,spec);
  const after=runOperation(features,{...spec,faceOverrides:[{...zone,edgeAssist:true}]});
  for(const result of [before,after]){
   const shape=R.deserializeShape(result.outputs[0].brep).asShape3D(),hit=shape.intersect(area);
   try{assert.ok(R.measureVolume(hit)<1e-6);}finally{shape.delete();hit.delete();}
   const row=result.supportPreview.coverage[0];
   assert.ok(row.manualExcluded.length);
   assert.ok(row.boundaryWarnings.length);
   assert.ok(result.supportPreview.exportStatus.ok);
   assert.ok(result.supportPackage.blockers.some(mesh=>mesh.vertices.every((value,i)=>i%3!==2||value>=23.69)));
   assert.ok(printSupport3mf(result.supportPackage).length>0);
  }
  const nearBoundary=result=>result.supportPreview.ribs.some(rib=>rib.center>=8.4&&rib.center<=8.41);
  assert.equal(nearBoundary(before),false);
  assert.equal(nearBoundary(after),true);
  const feature=supportHistoryFeature({...spec,faceOverrides:[{...zone,edgeAssist:true}]},after);
  const saved=JSON.parse(JSON.stringify([...features,feature]));
  assert.deepEqual(saved.at(-1).spec.faceOverrides[0].noSupport,zone.noSupport);
  const replayed=runOperation(saved,{type:'replay',before:saved,start:1,forceFull:true}).features.at(-1);
  assert.equal(replayed.analysis.printSupport.count,after.analysis.printSupport.count);
 }finally{[roof,side,model,area].forEach(shape=>shape.delete());}
});

test('automatic removal searches all six directions and agrees with individual checks',()=>{
 const moving=R.makeBox([0,0,5],[1,1,6]),bed=R.makeBox([-10,-10,0],[10,10,5]),wall=R.makeBox([3,-1,4],[4,2,8]);
 try{
  const spec={moving:cadMesh(moving),obstacles:[{id:'bed',...cadMesh(bed)},{id:'wall',...cadMesh(wall)}]};
  const {directions}=inspectSupportRemoval({...spec,allDirections:true});
  assert.equal(directions.length,6);
  assert.deepEqual(directions.map(({axis,sign})=>[axis,sign]),[[0,-1],[0,1],[1,-1],[1,1],[2,-1],[2,1]]);
  assert.equal(directions[0].state,'clear');
  assert.equal(directions[1].firstContact,2);
  for(const {axis,sign} of directions)assert.deepEqual(directions.find(row=>row.axis===axis&&row.sign===sign),inspectSupportRemoval({...spec,axis,sign}));
 }finally{[moving,bed,wall].forEach(shape=>shape.delete());}
});
