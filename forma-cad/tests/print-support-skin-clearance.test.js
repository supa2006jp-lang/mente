import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {cadMesh} from '../src/cad-mesh.js';
import {serializeCadShape} from '../src/cad-serialization.js';
import {runOperation} from '../src/kernel.js';
import {printSupport3mf} from '../src/print-support-3mf.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

test('an obstructed ceiling does not prevent automatic rib support under other ceilings',async()=>{
 const wasmBinary=await readFile(new URL('../node_modules/replicad-opencascadejs/dist/replicad_single.wasm',import.meta.url));
 R.setOC(await init({wasmBinary}));
 const parts=[
  R.makeBox([0,0,30],[24,18,33]),
  R.makeBox([0,0,0],[2,18,30]),
  R.makeBox([-12,0,15],[0,18,18]),
 ];
 const obstacle=R.makeBox([-13,-1,0],[-.05,19,14.5]);
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
 }finally{model.delete();obstacle.delete();parts.forEach(part=>part.delete());}
});
