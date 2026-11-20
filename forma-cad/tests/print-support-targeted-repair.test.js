import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {proposeSupportSliceRepair,supportSliceRepairApplied} from '../src/print-support-slice-repair.js';
import {validatePrintSupportPreset} from '../src/print-support-presets.js';

let engine;
function native(){
 return engine??=(async()=>{
  const wasmBinary=await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
  R.setOC(await init({wasmBinary}));
 })();
}
const record=(id,shape)=>({id,kind:'cadop',outputs:[{id,...cadMesh(shape),brep:shape.serialize()}],remove:[]});
const settings={type:'printSupport',id:'ribs',target:'top',mode:'auto',style:'walls',layerHeight:.3,topGap:.3,
 baseMode:'bedOrModel',wallDirection:'y',wallPitch:8,wallThickness:.8,lineWidth:.4,edgeMargin:.5,sideGap:.5,connectFeet:false,
 wallRoof:false,wallTies:false,wallBottomSkin:false,skipSmallExterior:false,keepRibThickness:true,alignSideGapRibs:true,
 sectionSideGapRibs:true,preview:true,fallbackDiameter:.8};
const layouts=result=>result.supportPreview.ribs.filter(rib=>!rib.automatic).map(({id,bounds})=>({id,bounds}));

test('slicer repair thickens the selected rib and obeys side clearance on replay',async()=>{
 await native();
 const top=R.makeBox([0,0,20],[36,36,23]),wall=R.makeBox([18.96,12,0],[20,19,19.9]);
 const other=R.makeBox([16,12,0],[17.04,19,19.9]);
 try{
  const features=[record('top',top)],result=runOperation(features,settings),rib=result.supportPreview.ribs.find(rib=>rib.center===18);
  const issue={kind:'rib',id:rib.id,number:rib.number,ceilingId:rib.ceilingId,missingPoints:[[18,15,10]]};
  const plan=proposeSupportSliceRepair(issue,{input:settings,result},{lineWidth:.55});
  assert.equal(plan.value,1.1);
  assert.equal(plan.settings.wallThickness,.8);
  assert.equal(plan.settings.sideGap,.5);
  const fixed=runOperation(features,plan.settings);
  assert(supportSliceRepairApplied(plan,fixed));
  assert(fixed.supportPreview.exportStatus.ok);
  assert.deepEqual(layouts(fixed).filter(rib=>rib.id!==plan.id),layouts(result).filter(rib=>rib.id!==plan.id));
  const changed=fixed.supportPreview.ribs.find(rib=>rib.id===plan.id);
  assert(Math.abs(changed.bounds[1][0]-changed.bounds[0][0]-1.1)<1e-6);
  const replay=runOperation(features,{...plan.settings,preview:false,saveSupportExport:true});
  assert(Math.abs(replay.analysis.printSupport.material.volume-fixed.analysis.printSupport.material.volume)<1e-6);

  const edgeInput={...settings,edgeRibs:true};
  const edgeBefore=runOperation(features,edgeInput);
  const edge=edgeBefore.supportPreview.ribs[0];
  const edgePlan=proposeSupportSliceRepair({...issue,id:edge.id,ceilingId:edge.ceilingId},{input:edgeInput,result:edgeBefore},{lineWidth:.55});
  const edgeAfter=runOperation(features,edgePlan.settings);
  assert(supportSliceRepairApplied(edgePlan,edgeAfter));
  assert(Math.abs(edgeAfter.supportPreview.ribs[0].bounds[0][0]-edge.bounds[0][0])<1e-6);

  const nearby=[...features,record('wall',wall),record('other',other)],before=runOperation(nearby,settings);
  const current=before.supportPreview.ribs.find(rib=>rib.center===18&&!rib.excluded);
  const rejected=proposeSupportSliceRepair({...issue,id:current.id},{input:settings,result:before},{lineWidth:.55});
  const safe=runOperation(nearby,rejected.settings);
  assert(!supportSliceRepairApplied(rejected,safe));
  assert.deepEqual(layouts(safe),layouts(before));
 }finally{[top,wall,other].forEach(shape=>shape.delete());}
});

test('skin repair applies the number of layers only to the corresponding underside',async()=>{
 await native();
 const left=R.makeBox([0,0,14],[28,14,17]),right=R.makeBox([40,0,20],[68,14,23]),model=R.makeCompound([left,right]);
 try{
  const features=[record('top',model)],input={...settings,wallRoof:true,roofLayers:1},result=runOperation(features,input);
  const skin=result.supportPreview.skins.flat().find(skin=>skin.side==='upper');
  const triangles=Array.from({length:skin.triangles.length/3},(_,i)=>skin.triangles.slice(i*3,i*3+3).map(index=>skin.vertices.slice(index*3,index*3+3)));
  const area=([a,b,c])=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]));
  const triangle=triangles.sort((a,b)=>area(b)-area(a))[0];
  const center=[0,1,2].map(axis=>(triangle[0][axis]+triangle[1][axis]+triangle[2][axis])/3);
  const issue={kind:'upper',ceilingId:skin.ceilingId,missingPoints:[center]};
  const plan=proposeSupportSliceRepair(issue,{input,result},{layerHeight:.3});
  assert.equal(plan.value,2);
  const prepared=runOperation(features,plan.settings);
  assert(supportSliceRepairApplied(plan,prepared));
  const rows=prepared.supportPreview.coverage;
  assert.equal(rows.find(row=>row.ceilingId===skin.ceilingId).settings.roofLayers,2);
  assert.equal(rows.find(row=>row.ceilingId!==skin.ceilingId).settings.roofLayers,1);
 }finally{[left,right,model].forEach(shape=>shape.delete());}
});

test('interrupted ribs auto-fill the local gap with checked ribs and columns on the same ceiling',async()=>{
 await native();
 const top=R.makeBox([0,0,20],[36,36,23]),wall=R.makeBox([17.6,12,0],[18.6,19,19.9]);
 const guard=R.makeBox([17.1,12,0],[19.1,19,19.7]);
 try{
  const features=[record('top',top),record('wall',wall)];
  const before=runOperation(features,settings);
  const input={...settings,fillGaps:true};
  const after=runOperation(features,input),fill=after.analysis.printSupport.gapFill;
  assert(before.supportPreview.exportStatus.ok&&after.supportPreview.exportStatus.ok);
  assert.equal(fill.faces,1);
  assert(fill.ribs>0&&fill.columns>0);
  assert.deepEqual(layouts(after),layouts(before));
  const row=after.supportPreview.coverage[0];
  assert(row.gapFill.before>row.gapFill.after+3);
  assert(after.supportPreview.columns.every(column=>column.local&&column.top===19.7));
  const body=R.deserializeShape(after.outputs[0].brep).asShape3D(),overlap=body.intersect(guard);
  try{assert(Math.abs(R.measureVolume(overlap))<1e-6);}finally{body.delete();overlap.delete();}
  const replay=runOperation(features,{...input,preview:false,saveSupportExport:true});
  assert.deepEqual(replay.analysis.printSupport.gapFill,fill);
  const autoRib=after.supportPreview.ribs.find(rib=>rib.automatic);
  const excluded=runOperation(features,{...input,excludedRibs:[autoRib.id]});
  assert(excluded.supportPreview.ribs.find(rib=>rib.id===autoRib.id)?.excluded);
  assert(excluded.supportPreview.exportStatus.ok);
  assert.equal(validatePrintSupportPreset(input).fillGaps,true);
  const plain=runOperation([record('top',top)],input);
  assert.deepEqual(plain.analysis.printSupport.gapFill,{ribs:0,columns:0,faces:0});
 }finally{[top,wall,guard].forEach(shape=>shape.delete());}
});
