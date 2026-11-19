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

test('thin rib and bridge faces retain CAD precision when fused away from the origin',async()=>{
 R.setOC(await init({wasmBinary:await readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
 const ceiling=R.makeBox([83,80,85],[97,140,88]);
 try{
  const outputs=[{id:'ceiling',...cadMesh(ceiling),brep:serializeCadShape(ceiling)}];
  const features=[{id:'ceiling',name:'Ceiling',kind:'cadop',outputs,remove:[]}];
  const snapshot=JSON.stringify(features);
  const result=runOperation(features,{
   type:'printSupport',id:'support',target:'ceiling',style:'walls',mode:'auto',
   wallDirection:'x',wallPitch:10,edgeMargin:.1,edgeRibs:true,
   wallRoof:true,wallBottomSkin:true,bottomSkinLayers:1,wallTies:true,tieInterval:20,
   contactLines:true,topContactRim:true,topContactRimWidth:2,interfaceSpacing:.2,
   layerHeight:.3,topGap:.3,preview:true
  });
  const analysis=result.analysis.printSupport;
  assert.equal(analysis.count,7);
  assert.equal(analysis.components,1);
  assert.equal(analysis.wallTies.count,48);
  assert.equal(analysis.roof.count,1);
  assert.equal(analysis.bottomSkin.count,1);
  assert.ok(inspectCadStl(result.outputs[0]).report.ok);
  assert.ok(result.supportPreview.exportStatus.ok);
  assert.ok(printSupport3mf(result.supportPackage).length>0);
  assert.equal(JSON.stringify(features),snapshot);
 }finally{ceiling.delete();}
});
