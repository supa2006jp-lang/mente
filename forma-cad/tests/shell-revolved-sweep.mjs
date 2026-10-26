import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {selectedCadFaces} from '../src/face-pull.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const doc=JSON.parse(await fs.readFile('tests/fixtures/shell-revolved-sweep-failure.forma.json','utf8'));
const features=doc.failure.request.features,p=doc.failure.request.spec.operation,snapshot=JSON.stringify(features),out='.sites-runtime/shell-revolved-sweep';
await fs.mkdir(out,{recursive:true});
const bodies=kernelBodies(features),base=bodies.get(p.target),originalVolume=R.measureVolume(base),originalArea=R.measureArea(base),bbox=base.boundingBox,originalBounds=bbox.bounds;
bbox.delete();
const distance=(point,shape)=>{const v=R.makeVertex(point);try{return R.measureDistanceBetween(v,shape);}finally{v.delete();}};
const faces=selectedCadFaces(base,p.faces);
assert.throws(()=>base.shell(.1,ff=>ff.inList(faces)),'reproduce default offset failure at the original thickness');
faces.forEach(f=>f.delete());
const samples=[],surfaceFaces=base.faces;
try{for(const face of surfaceFaces){if(face.geomType==='PLANE'||R.measureArea(face)<100)continue;for(const u of [.25,.5,.75]){const point=face.pointOnSurface(u,.5),at=point.toTuple();point.delete();if(distance(at,face)>1e-6)continue;const normal=face.normalAt(at),n=normal.toTuple(),length=Math.hypot(...n);samples.push({at,normal:n.map(v=>v/length)});normal.delete();}}}finally{surfaceFaces.forEach(f=>f.delete());}
assert(samples.length>=6,'several points on the actual trimmed revolution surfaces');
const rows=[];
try{
 for(const thickness of [.1,.4])for(const both of [false,true]){
  const spec={...p,id:'shell',thickness,faces:[...p.faces,...(both?[{bodyId:p.target,point:[0,-30,0],normal:[0,-1,0]}]:[])]},started=Date.now(),result=runOperation(features,{type:'preview',operation:spec}),shape=R.deserializeShape(result.outputs[0].brep).asShape3D(),check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),solids=shape.solids;
  try{
   assert(check.IsValid());assert.equal(solids.length,1);assert.equal(result.outputs[0].id,p.target);assert.deepEqual(result.remove,[]);
   const volume=R.measureVolume(shape);assert(volume>0&&volume<originalVolume*.2);assert(result.removed.length>0,'the preview includes the actual removed cavity');
   const bounds=shape.boundingBox;try{for(let i=0;i<2;i++)for(let j=0;j<3;j++)assert(Math.abs(bounds.bounds[i][j]-originalBounds[i][j])<1e-5,'outside dimensions preserved');}finally{bounds.delete();}
   assert(distance([0,30,0],shape)>3,'selected top face is open');
   if(both)assert(distance([0,-30,0],shape)>3,'second selected face is open');
   else{assert(distance([0,-30,0],shape)<1e-5,'bottom outer cap retained');assert(Math.abs(distance([0,-30+thickness+.02,0],shape)-.02)<1e-5,'bottom wall is the requested thickness');}
   for(const {at,normal}of samples){const inside=at.map((v,i)=>v-normal[i]*(thickness+.02)),d=distance(inside,shape);assert(Math.abs(d-.02)<.001,'curved wall keeps the requested normal thickness: '+JSON.stringify({at,normal,thickness,d}));assert(distance(at,shape)<1e-5,'original outer curve remains');}
   const audited=inspectCadStl(result.outputs[0]);assert(audited.report.ok,JSON.stringify(audited.report.issues));
   if(thickness===.1&&!both){await fs.writeFile(out+'/original-result.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[...features,{kind:'cadop',id:'shell',name:'シェル',spec,...result}]}));}
   rows.push({thickness,openings:spec.faces.length,volume,wallSamples:samples.length,stlClosed:true,elapsedMs:Date.now()-started});console.log(rows.at(-1));
  }finally{check.delete();solids.forEach(s=>s.delete());shape.delete();}
 }
 assert.throws(()=>runOperation(features,{...p,thickness:1001}),/壁厚/);
 assert.equal(JSON.stringify(features),snapshot,'history and other body remain unchanged');
 assert(Math.abs(R.measureVolume(base)-originalVolume)<1e-6);assert(Math.abs(R.measureArea(base)-originalArea)<1e-6,'native source geometry retained');
 const proof={pass:true,originalFailureReproduced:true,exactRequestedThickness:true,outerGeometryPreserved:true,oneAndTwoOpenings:true,validSingleSolid:true,closedStl:true,removedCavityPreview:true,sourceUnchanged:true,rows};
 await fs.writeFile(out+'/native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{for(const shape of bodies.values())shape.delete();}
