import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {makeHoneycomb,honeycombBodyInfo} from '../src/honeycomb-solid.js';
import {honeycombLayout,honeycombSettings} from '../src/honeycomb-layout.js';
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
await fs.writeFile(out+'/proof.json',JSON.stringify({pass:true,syntheticFixturesOnly:true,proofs,selectedFace:true,invalidSettings:true,kernelIntegration:true,historyReplay:true},null,2));
