import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {supportBatchPackage} from '../src/print-support-batch.js';
import {validatePrintSupportPreset} from '../src/print-support-presets.js';
import {inspectSupportSlicePaths,readSupportSliceLayers} from '../src/print-support-slice-paths.js';

let loading;
function native(){
 return loading??=(async()=>{
  const wasmBinary=await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
  R.setOC(await init({wasmBinary}));
 })();
}
const output=(id,shape)=>({id,...cadMesh(shape),brep:shape.serialize()});
const record=(id,shape)=>({id,kind:'cadop',outputs:[output(id,shape)],remove:[]});
const settings={type:'printSupport',id:'ribs',target:'top',style:'walls',mode:'auto',baseMode:'bed',wallDirection:'y',
 wallPitch:8,wallThickness:1.8,topGap:.3,layerHeight:.3,sideGap:.5,edgeMargin:.25,keepRibThickness:true,
 alignSideGapRibs:true,sectionSideGapRibs:true,connectFeet:false,skipSmallExterior:false,preview:true,fallbackDiameter:.8};

test('fallback columns fill a narrow ceiling without changing existing ribs, replay or main-body clearance',async()=>{
 await native();
 const wide=R.makeBox([0,0,18],[30,16,21]),narrow=R.makeBox([45,0,8],[47,20,10]),top=R.makeCompound([wide,narrow]);
 const other=R.makeBox([47.1,-2,0],[49,22,7.8]),features=[record('top',top),record('side',other)];
 try{
  const prior=runOperation(features,settings),input={...settings,fallbackPosts:true};
  const current=runOperation(features,input),analysis=current.analysis.printSupport;
  assert.equal(prior.analysis.printSupport.faceCount,1);
  assert.equal(analysis.faceCount,2);
  assert(analysis.columnFallback.count>=2);
  const geometry=result=>result.supportPreview.ribs.map(({id,bounds,vertices,triangles})=>({id,bounds,vertices,triangles}));
  assert.deepEqual(geometry(current),geometry(prior));
  for(const column of current.supportPreview.columns){
   assert(Math.abs(column.top-7.7)<1e-7);
   assert.equal(column.bottom,0);
   assert(column.point[0]+column.radius<=47.1-settings.sideGap+1e-6);
  }
  assert(current.supportPreview.exportStatus.ok);
  assert(supportBatchPackage([{input,result:current}]).blockers.length>prior.supportPackage.blockers.length);
  const applied=runOperation(features,{...input,preview:false,saveSupportExport:true});
  assert.deepEqual(applied.analysis.printSupport.columnFallback,analysis.columnFallback);
  assert.equal(validatePrintSupportPreset(input).fallbackPosts,true);
  assert.equal(validatePrintSupportPreset(input).fallbackDiameter,.8);
  assert(!Object.hasOwn(validatePrintSupportPreset({}),'fallbackPosts'));
 }finally{[wide,narrow,top,other].forEach(shape=>shape.delete());}
});

test('separating thin joints exposes individual removal paths in the real support geometry',async()=>{
 await native();
 const left=R.makeBox([0,0,0],[.8,8,5]),right=R.makeBox([3,0,0],[3.8,8,5]),tie=R.makeBox([.7,2,3],[3.1,3,3.6]);
 const body=left.fuse(tie),together=body.fuse(right),lid=R.makeBox([-1,-1,5.3],[5,9,6.3]);
 try{
  const result=runOperation([],{type:'printSupportRemovalSections',brep:together.serialize(),wallThickness:.8,
   ribs:[{axis:0,center:.4,bounds:[[0,0,0],[.8,8,5]]},{axis:0,center:3.4,bounds:[[3,0,0],[3.8,8,5]]}],
   obstacles:[output('lid',lid)]});
  assert.equal(result.parts.length,2);
  assert.equal(result.cuts.length,1);
  assert.equal(result.cuts[0].axis,0);
  assert.equal(result.remaining.length,0);
  assert.equal(new Set(result.steps.map(step=>step.id)).size,2);
  assert(result.steps.every(step=>step.direction.state==='clear'));
 }finally{[left,right,tie,body,together,lid].forEach(shape=>shape.delete());}
});

test('slice paths find missing material and measure the real blank layers across a registration transform',async()=>{
 await native();
 const printed=R.makeBox([0,0,0],[.4,4,.6]),missing=R.makeBox([1,0,0],[1.4,4,.6]);
 const thinSkin=R.makeBox([2,0,.59],[3,4,.6]);
 const relief=R.makeCompound([printed,missing,thinSkin]),top=R.makeBox([0,0,.9],[4,4,1.5]);
 try{
  const gc='G90\nM82\nG92 E0\n'+[.3,.6,.9,1.2,1.5].map((z,i)=>{
   const start='; Z_HEIGHT: '+z+'\n; LAYER_HEIGHT: .3\nG1 Z'+z+'\n; FEATURE: Outer wall\n; LINE_WIDTH: .4\n';
   if(i===2)return start;
   return start+'; OBJECT_ID: 1\nG0 X10 Y20.2\nG1 X6 Y20.2 E'+(i+1)+'\n';
  }).join('');
  assert.equal(readSupportSliceLayers(gc,'1',.4).layers.length,5);
  const columns=[{point:[.2,2,.9],radius:.2,top:.6,bottom:0}];
  const result=inspectSupportSlicePaths({gcode:gc,objectId:'1',matrix:[0,1,0,-1,0,0,0,0,1,10,20,0],
   sources:[{target:'top',mesh:output('ribs',relief),ribs:[
    {axis:0,id:'missing',number:2,center:1.2,bounds:[[1,0,0],[1.4,4,.6]],ceiling:.9},
   ],skins:[{side:'upper',ribs:[],bounds:[[2,0,.59],[3,4,.6]]}],columns,topGap:.3,bedZ:0,baseIds:['top'],wallThickness:.4,lineWidth:.4}],
   models:[output('top',top)]});
  const rib=result.rows.find(row=>row.kind==='rib'),column=result.rows.find(row=>row.kind==='column'),roof=result.rows.find(row=>row.kind==='upper');
  assert(rib.checked>0&&rib.found===0&&rib.missingPoints.length);
  assert(roof.unsliced>0&&roof.found===0);
  assert(column.checked>0&&column.checked===column.found);
  assert(column.contacts.some(item=>item.layers===1&&Math.abs(item.gap-.3)<1e-8));
 }finally{[printed,missing,thinSkin,relief,top].forEach(shape=>shape.delete());}
});
