import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeHoneycomb,honeycombBodyInfo} from '../src/honeycomb-solid.js';
import {honeycombLayout,honeycombSettings,planHoneycomb} from '../src/honeycomb-layout.js';
import {honeycombTargetHistory} from '../src/honeycomb-history.js';
import {cadMesh} from '../src/cad-mesh.js';
import {binaryStlReport} from './stl-topology.mjs';
import {runOperation} from '../src/kernel.js';
import {defaults,validateProject} from '../src/geometry.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
assert.throws(()=>honeycombSettings({rib:0}),/格子/);
const layout=honeycombLayout(40,40,{cell:8,rib:2});
assert(layout.centers.length>0);
for(const [x,y]of layout.centers)for(const [a,b]of layout.hex){assert(x+a>=3-1e-6&&x+a<=37+1e-6);assert(y+b>=3-1e-6&&y+b<=37+1e-6);}
const out='.sites-runtime/honeycomb';await fs.mkdir(out,{recursive:true});
const proofs=[];
for(const kind of ['box','cylinder','rotatedBox','rotatedCylinder']){
 let base=kind.toLowerCase().includes('box')?R.makeBox([0,0,0],[32,28,32]):R.makeCylinder(16,32);
 if(kind.startsWith('rotated')){const moved=base.rotate(37,[0,0,0],[1,1,0]).translate([12,-7,4]);base.delete();base=moved;}
 const start=performance.now(),before={volume:R.measureVolume(base),area:R.measureArea(base)},made=makeHoneycomb(base,{cell:10,rib:2,thickness:2,border:3});
 try{
  const check=new (R.getOC().BRepCheck_Analyzer)(made.shape.wrapped,true,false),parts=made.shape.solids;
  try{assert(check.IsValid());assert.equal(parts.length,1);}finally{check.delete();parts.forEach(p=>p.delete());}
  assert(Math.abs(R.measureVolume(base)-before.volume)<1e-6,'source volume unchanged');assert(Math.abs(R.measureArea(base)-before.area)<1e-6,'source surface unchanged');assert(R.measureVolume(made.shape)<R.measureVolume(base));
  const mesh=cadMesh(made.shape),stl=await made.shape.blobSTL({binary:true,tolerance:.03,angularTolerance:.1}).arrayBuffer(),report=binaryStlReport(Buffer.from(stl));
  for(const key of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(report[key],0,kind+' '+key);
  await fs.writeFile(out+'/'+kind+'.stl',Buffer.from(stl));
  proofs.push({kind,...made.info,triangles:mesh.triangles.length/3,stl:report,seconds:(performance.now()-start)/1000});
  console.log('PASS '+kind+' '+made.info.holeCount+' holes '+proofs.at(-1).seconds.toFixed(2)+'s');
 }finally{made.shape.delete();base.delete();}
}
const box=R.makeBox([0,0,0],[32,28,32]);
try{
 const a=makeHoneycomb(box,{cell:10,rib:2,scope:'selected',faceNormal:[0,-1,0]});
 try{assert(a.info.holeCount>0&&a.info.holeCount<proofs[0].holeCount);}finally{a.shape.delete();}
 assert.throws(()=>makeHoneycomb(box,{thickness:20}),/厚み/);
 assert.throws(()=>makeHoneycomb(box,{cell:100}),/配置/);
 assert.throws(()=>makeHoneycomb(box,{scope:'selected',faceNormal:[0,0,1]}),/側面/);
}finally{box.delete();}
const base={...defaults,id:'b',name:'箱',kind:'extrusion',width:32,height:28,depth:32};
const spec={type:'honeycomb',target:'b',id:'hc',cell:10,rib:2,thickness:2,border:3,hollow:true,scope:'all',heightAxis:'Z'};
const result=runOperation([base],spec),feature={kind:'cadop',id:'hc',name:'ハニカム格子',spec,...result};
validateProject({format:'forma-cad',version:1,features:[base,feature]});
const replay=runOperation([{...base,width:36},feature],{type:'replay',before:[base,feature],start:0});
assert(replay.features[1].analysis.honeycomb.holeCount>0);
const compact=honeycombTargetHistory([base,feature,{...base,id:'unrelated'}],'b');assert.equal(compact.length,1);assert.equal(compact[0].outputs[0].vertices,undefined);assert(compact[0].outputs[0].brep);assert.equal(honeycombTargetHistory([base,{...base,id:'other'}],'b').length,1);
const capProofs=[];
for(const kind of ['box','cylinder']){
 const source=kind==='box'?R.makeBox([0,0,0],[32,28,32]):R.makeCylinder(16,32),info=honeycombBodyInfo(source),countPlan=planHoneycomb(info,{layout:'count',columns:kind==='box'?4:8,rows:3});
 assert.equal(countPlan.rows,3);assert.equal(countPlan.columns,kind==='box'?4:8);assert(countPlan.cell>=1);
 for(const grid of countPlan.grids)if(kind==='box')for(const [x,y]of grid.centers)for(const [a,b]of grid.hex){assert(x+a>=3-1e-6&&x+a<=grid.width-3+1e-6);assert(y+b>=3-1e-6&&y+b<=29+1e-6);}
 let suggestion;try{planHoneycomb(info,{layout:'count',columns:100,rows:100});assert.fail('Reject impossible counts');}catch(error){suggestion=error.diagnostics?.honeycombSuggestion;assert(suggestion);assert(suggestion.holeCount<=240);assert(planHoneycomb(info,{...suggestion}).holeCount<=240);}
 const closed=makeHoneycomb(source,{layout:'count',columns:kind==='box'?4:8,rows:3}),closedVolume=R.measureVolume(closed.shape);closed.shape.delete();
 const capArea=kind==='box'?28*24:Math.PI*14**2;
 for(const [topOpen,bottomOpen]of [[true,false],[false,true],[true,true]]){
  const made=makeHoneycomb(source,{layout:'count',columns:kind==='box'?4:8,rows:3,topOpen,bottomOpen});
  try{const volume=R.measureVolume(made.shape);assert(Math.abs(closedVolume-volume-capArea*2*(Number(topOpen)+Number(bottomOpen)))<.001,'Only requested caps removed');const stl=binaryStlReport(Buffer.from(await made.shape.blobSTL({binary:true,tolerance:.03,angularTolerance:.1}).arrayBuffer()));for(const key of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(stl[key],0,kind+' cap '+key);capProofs.push({kind,topOpen,bottomOpen,stl});}finally{made.shape.delete();}
 }
 source.delete();
}
assert.throws(()=>honeycombSettings({hollow:false,topOpen:true}),/空洞/);assert.throws(()=>honeycombSettings({columns:1.5}),/整数/);
const opened=runOperation([base],{...spec,layout:'count',columns:4,rows:3,topOpen:true}),openedFeature={kind:'cadop',id:'hc',name:'ハニカム格子',spec:{...spec,layout:'count',columns:4,rows:3,topOpen:true},...opened};
validateProject({format:'forma-cad',version:1,features:[base,openedFeature]});const reopened=runOperation([{...base,width:36},openedFeature],{type:'replay',before:[base,openedFeature],start:0});assert.equal(reopened.features[1].analysis.honeycomb.topOpen,true);assert.equal(reopened.features[1].analysis.honeycomb.rows,3);
const asymmetricProofs=[];
for(const kind of ['box','cylinder']){
 const body=kind==='box'?R.makeBox([0,0,0],[32,28,32]):R.makeCylinder(16,32),info=honeycombBodyInfo(body),common={layout:'count',columns:kind==='box'?4:8,rows:2,rib:2};
 const upper=planHoneycomb(info,{...common,topBorder:3,bottomBorder:11}),lower=planHoneycomb(info,{...common,topBorder:11,bottomBorder:3});
 assert.equal(upper.cell,lower.cell);assert.equal(upper.holeCount,lower.holeCount);
 for(const grid of upper.grids)for(const [x,z]of grid.centers)for(const [dx,dz]of grid.hex)assert(z+dz>=11-1e-6&&z+dz<=29+1e-6,'separate lower/upper clear bands');
 for(let i=0;i<upper.grids[0].centers.length;i++)assert(Math.abs(upper.grids[0].centers[i][1]-lower.grids[0].centers[i][1]-8)<1e-6);
 const legacy=planHoneycomb(info,{cell:8,border:7}),explicit=planHoneycomb(info,{cell:8,border:7,topBorder:7,bottomBorder:7});assert.deepEqual(legacy.grids,explicit.grids,'old custom border retained');
 const made=makeHoneycomb(body,{...common,topBorder:3,bottomBorder:11,topOpen:true,bottomOpen:true});
 try{assert.equal(made.info.topBorder,3);assert.equal(made.info.bottomBorder,11);const stl=binaryStlReport(Buffer.from(await made.shape.blobSTL({binary:true,tolerance:.03,angularTolerance:.1}).arrayBuffer()));for(const key of ['degenerate','boundary','nonmanifold','orientation'])assert.equal(stl[key],0);asymmetricProofs.push({kind,stl});}finally{made.shape.delete();body.delete();}
}
assert.throws(()=>honeycombSettings({topBorder:NaN}),/上側/);assert.throws(()=>honeycombSettings({bottomBorder:0}),/下側/);
const inspect=runOperation([base],{type:'honeycombInspect',target:'b',heightAxis:'Z'});assert.equal(inspect.info.kind,'box');assert.equal(inspect.info.height,32);assert.equal(inspect.outputs,undefined);
const asymmetricSpec={...spec,layout:'count',columns:4,rows:2,topBorder:3,bottomBorder:11};const asymmetric=runOperation([base],asymmetricSpec),asymmetricFeature={kind:'cadop',id:'hc',name:'ハニカム格子',spec:asymmetricSpec,...asymmetric};validateProject({format:'forma-cad',version:1,features:[base,asymmetricFeature]});const replayed=runOperation([{...base,depth:40},asymmetricFeature],{type:'replay',before:[base,asymmetricFeature],start:0});assert.equal(replayed.features[1].analysis.honeycomb.bottomBorder,11);
await fs.writeFile(out+'/proof.json',JSON.stringify({pass:true,syntheticFixturesOnly:true,proofs,capProofs,asymmetricProofs,selectedFace:true,invalidSettings:true,kernelIntegration:true,historyReplay:true,capChoices:true,countLayout:true,retainedFrames:true,fittingSuggestion:true,compactTargetHistory:true,countCapSaveReplay:true,separateTopBottomFrames:true,legacyFrameMigration:true,asymmetricFrameReplay:true,inspectWithoutCut:true},null,2));console.log('PASS cap choices, count fitting, suggestion, compact history, separate frames and replay');
