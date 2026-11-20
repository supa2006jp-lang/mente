import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import * as R from 'replicad';
import init from 'replicad-opencascadejs';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {listSupportHoleOpenings,validateSupportHoleProtections} from '../src/print-support-hole-protection.js';
import {printSupportNewDefaults} from '../src/print-support-new-defaults.js';
import {validatePrintSupport} from '../src/print-support.js';
import {printSupport3mf} from '../src/print-support-3mf.js';
import {supportFallbackColumns} from '../src/print-support-column-fallback.js';
import {supportShapeBounds} from '../src/print-support-solid-groups.js';

const wasm=new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url);
const initialize=readFile(wasm).then(wasmBinary=>init({wasmBinary})).then(R.setOC);
const settings={...printSupportNewDefaults,type:'printSupport',id:'ribs',target:'model',wallPitch:8,wallDirection:'x',wallTies:false,
 baseMode:'bed',wallRoof:true,wallBottomSkin:true,contactLines:true,skipSmallBores:false,skipSmallExterior:false};

function overlap(a,b){
 const common=a.intersect(b);
 try{return Math.abs(R.measureVolume(common));}
 finally{common.delete();}
}

test('opening recognition follows the CAD axis and suggests blind and through depths',async()=>{
 await initialize;
 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const box=hold(R.makeBox([0,0,0],[30,20,10]));
  const through=hold(R.makeCylinder(2,32,[-1,6,5],[1,0,0]));
  const blind=hold(R.makeCylinder(3,6,[20,12,-1]));
  const boss=hold(R.makeCylinder(2,2,[8,15,9]));
  const stock=hold(box.fuse(boss)),bored=hold(stock.cut(through)),model=hold(bored.cut(blind));
  const openings=listSupportHoleOpenings(model);
  assert.equal(openings.length,3,'a round boss is not a selectable hole');
  const boreInBoss=hold(R.makeCylinder(1,13,[8,15,-1]));
  const hollowBoss=hold(model.cut(boreInBoss));
  assert.equal(listSupportHoleOpenings(hollowBoss).length,5,'only the two actual bore mouths are added');
  const entry=openings.find(hole=>hole.axis[0]<-.9999);
  assert.deepEqual(entry.center,[0,6,5]);
  assert.equal(entry.depth,30);
  assert.equal(openings.find(hole=>hole.axis[2]<-.9999).depth,5);
  const angled=hold(model.rotate(35,[0,0,0],[0,1,0]));
  const tilted=listSupportHoleOpenings(angled).find(hole=>hole.axis[0]<-.7);
  assert.equal(tilted.depth,30);
  assert(Math.abs(tilted.axis[2]-.5735764)<1e-6);
  const protection={...entry,outside:3,margin:.5};
  assert.throws(()=>validateSupportHoleProtections([protection,protection]),/保護範囲/);
  assert.throws(()=>validateSupportHoleProtections([{...protection,margin:-1}]),/保護範囲/);
  assert.throws(()=>validateSupportHoleProtections([{...protection,axis:[0,0,0]}]),/保護範囲/);
 }finally{owned.reverse().forEach(shape=>shape.delete());}
});

test('hole protection clips ribs and skins, survives the warm cache, and exports a saved 3MF blocker',async()=>{
 await initialize;
 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const roof=hold(R.makeBox([0,0,20],[42,32,29]));
  const leg=hold(R.makeBox([0,0,0],[2,32,20]));
  const joined=hold(roof.fuse(leg)),bore=hold(R.makeCylinder(4,7,[22,15,19]));
  const model=hold(joined.cut(bore));
  const source={kind:'cadop',id:'model',remove:[],outputs:[{id:'model',...cadMesh(model),brep:model.serialize()}]};
  const history=[source];
  const {openings}=runOperation(history,{type:'printSupportHoleOpenings',target:'model'});
  assert.equal(openings.length,1);
  assert.equal(openings[0].depth,6);
  const input={...settings,mode:'face',faces:[{bodyId:'model',point:[30,14,20],normal:[0,0,-1]}],preview:true};
  const baseline=runOperation(history,input);
  assert(baseline.supportPreview.exportStatus.ok,JSON.stringify(baseline.supportPreview.exportStatus.issues));
  const baselineShape=hold(R.deserializeShape(baseline.outputs[0].brep).asShape3D());
  const hole={...openings[0],outside:20,margin:1.5};
  const cylinder=hold(R.makeCylinder(5.5,26,[22,15,0]));
  assert(overlap(baselineShape,cylinder)>20);
  const protectedInput={...input,holeProtections:[hole]};
  const result=runOperation(history,protectedInput);
  assert(result.supportPreview.exportStatus.ok,JSON.stringify(result.supportPreview.exportStatus.issues));
  assert.equal(result.analysis.printSupport.roof.count,1);
  assert(result.analysis.printSupport.bottomSkin.count>0);
  const protectedShape=hold(R.deserializeShape(result.outputs[0].brep).asShape3D());
  assert(overlap(protectedShape,cylinder)<1e-6);
  const beside=hold(R.makeBox([29,4,0],[37,29,20]));
  assert(overlap(protectedShape,beside)>50);
  const update=runOperation(history,{...protectedInput,holeProtections:[{...hole,outside:9,margin:.75}]});
  const shorter=hold(R.deserializeShape(update.outputs[0].brep).asShape3D());
  assert(overlap(shorter,cylinder)>20);
  const final=runOperation(history,{...protectedInput,preview:false});
  const feature={kind:'cadop',id:'ribs',spec:{...protectedInput,preview:false},...final};
  const exported=runOperation([...history,feature],{type:'printSupportSavedExport',ids:['ribs']});
  const pkg=exported.package||exported;
  assert(pkg.complete);
  assert(pkg.blockers.some(({vertices})=>{
   const xyz=[0,1,2].map(axis=>vertices.filter((_,index)=>index%3===axis));
   return Math.abs(Math.max(...xyz[0])-27.5)<.03&&Math.abs(Math.min(...xyz[2])+.3)<.01&&Math.abs(Math.max(...xyz[2])-26.3)<.01;
  }));
  assert(printSupport3mf(pkg).length>1000);
 }finally{owned.reverse().forEach(shape=>shape.delete());}
});

test('independent fallback columns also respect a finite hole protection volume',async()=>{
 await initialize;
 const owned=[],hold=shape=>(owned.push(shape),shape);
 try{
  const roof=hold(R.makeBox([0,0,20],[24,24,23]));
  const face=roof.faces.map(hold).find(surface=>supportShapeBounds(surface).every(corner=>Math.abs(corner[2]-20)<1e-6));
  const columnOptions={face,faceBounds:supportShapeBounds(face),height:20,bodies:new Map([['model',roof]]),
   settings:validatePrintSupport({...settings,fallbackDiameter:1.2,edgeMargin:.5}),limit:1,positions:[[12,12]]};
  const baseline=supportFallbackColumns(columnOptions);
  assert.equal(baseline.length,1);
  baseline.forEach(({shape,blocker})=>{hold(shape);hold(blocker);});
  const shape=hold(R.makeCylinder(2,4,[10,12,12],[1,0,0]));
  const protectedColumns=supportFallbackColumns({...columnOptions,protectionTools:[{shape,bounds:supportShapeBounds(shape)}]});
  protectedColumns.forEach(({shape,blocker})=>{hold(shape);hold(blocker);});
  assert.equal(protectedColumns.length,0);
 }finally{owned.reverse().forEach(shape=>shape.delete());}
});
