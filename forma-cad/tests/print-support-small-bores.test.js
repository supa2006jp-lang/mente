import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as R from 'replicad';
import init from 'replicad-opencascadejs';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {smallSupportBoreFloor,tinyRibAtSupportHole} from '../src/print-support-bores.js';
import {supportShapeBounds} from '../src/print-support-solid-groups.js';
import {printSupportNewDefaults} from '../src/print-support-new-defaults.js';
import {validatePrintSupportPreset} from '../src/print-support-presets.js';

async function boreFixture(){
 const wasm=new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url);
 R.setOC(await init({wasmBinary:await readFile(wasm)}));
 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const roof=hold(R.makeBox([0,0,40],[64,40,53]));
  const wall=hold(R.makeBox([0,0,0],[2,40,40]));
  let body=hold(roof.fuse(wall));
  for(const [x,y] of [[18,10],[18,29],[43,10],[43,29]]){
   body=hold(body.cut(hold(R.makeCylinder(3.8,4.1,[x,y,39.9]))));
   body=hold(body.cut(hold(R.makeCylinder(2,8.1,[x,y,39.9]))));
  }
  body=hold(body.cut(hold(R.makeCylinder(2.1,14,[31,20,39.8]))));
  body=hold(body.cut(hold(R.makeCylinder(3.2,14,[52,20,39.8]))));
  return [{id:'model',kind:'cadop',remove:[],outputs:[{id:'model',...cadMesh(body),brep:body.serialize()}]}];
 }finally{owned.reverse().forEach(shape=>shape.delete());}
}

test('automatic ribs omit small circular recesses, keep the main roof, and reuse checked previews',async()=>{
 const history=await boreFixture();
 const spec={...printSupportNewDefaults,type:'printSupport',id:'ribs',target:'model',mode:'auto',preview:true,skipSmallBores:true,
  wallDirection:'y',wallPitch:9,fallbackPosts:true,sideGap:.5,keepRibThickness:true,alignSideGapRibs:true,sectionSideGapRibs:true,
  wallRoof:false,wallBottomSkin:false,connectFeet:false,contactLines:false};
 const result=runOperation(history,spec);
 const {printSupport}=result.analysis;
 const {ribs,coverage,columns,exportStatus}=result.supportPreview;
 assert.equal(printSupport.omittedBoreFaces,8);
 assert.equal(coverage.filter(row=>row.suppressedReason==='bore').length,8);
 assert.equal(ribs.length,14);
 assert(ribs.every(rib=>Math.abs(rib.ceiling-40)<1e-5),'all the ribs are under the main ceiling');
 assert(!columns?.length,'column fallback respects bore omission');
 assert(exportStatus.ok,JSON.stringify(exportStatus.issues));
 assert(result.supportPackage.blockers.some(mesh=>{
  const heights=mesh.vertices.filter((_,i)=>i%3===2);
  return Math.abs(Math.min(...heights)-47.4)<1e-5&&Math.abs(Math.max(...heights)-48.3)<1e-5;
 }),'3MF blocks slicer-generated support at the bore floor');

 const stages=[];
 const again=runOperation(history,spec,event=>stages.push(event.stage));
 assert(stages.includes('検査済みのリブプレビューを再利用しています'));
 assert.deepEqual(again,result);
 assert.notEqual(again.outputs[0].vertices,result.outputs[0].vertices);

 const selected=runOperation(history,{...spec,mode:'face',faces:[{bodyId:'model',point:[18,10,48],normal:[0,0,-1]}],
  sideGap:0,wallTies:false,wallPitch:2,edgeRibs:false});
 assert(!selected.analysis.printSupport.omittedBoreFaces);
 assert(selected.supportPreview.ribs.some(rib=>Math.abs(rib.ceiling-48)<1e-5),'manual selection can still support the bore');

 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const plate=hold(R.makeBox([0,0,20],[38,26,28]));
  const boss=hold(R.makeCylinder(2,4.2,[31,20,16]));
  const wideBore=hold(R.makeCylinder(5,5.1,[26,9,19.9]));
  const blank=hold(plate.fuse(boss)),body=hold(blank.cut(wideBore));
  for(const height of [16,25]){
   const faces=body.faces.map(hold);
   const floor=faces.find(face=>supportShapeBounds(face).every(corner=>Math.abs(corner[2]-height)<1e-5));
   assert(floor);
   assert(!smallSupportBoreFloor(floor,supportShapeBounds(floor),body),'a projecting boss and a wider bore stay eligible');
  }
 }finally{owned.reverse().forEach(shape=>shape.delete());}
});

test('fragment filtering requires a nearby hole and a footprint narrower than one line',()=>{
 const holes=[[[5,4,20],[9,8,20]]],settings={lineWidth:.4,wallThickness:.8,sideGap:.5};
 assert(tinyRibAtSupportHole([[6,8.1,0],[6.8,8.4,20]],holes,settings));
 assert(!tinyRibAtSupportHole([[6,8.1,0],[6.8,8.9,20]],holes,settings));
 assert(!tinyRibAtSupportHole([[6,18,0],[6.8,18.3,20]],holes,settings));
 assert.equal(validatePrintSupportPreset({style:'walls',topGap:.3,skipSmallBores:false}).skipSmallBores,false);
});
