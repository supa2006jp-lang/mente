import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
import {splitSolidSections} from '../src/solid-section-split.js';
import {solidMeshComplete} from '../src/solid-mesh.js';
import {inspectCadStl} from '../src/stl-cad-inspection.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const doc=JSON.parse(await fs.readFile('tests/fixtures/joined-revolution-section-failure.forma.json','utf8')),features=doc.failure.request.features,p=doc.failure.request.spec,bodies=kernelBodies(features),base=bodies.get(p.target),snapshot=base.serialize(),oc=R.getOC(),out='.sites-runtime/joined-revolution-section',rows=[];
await fs.mkdir(out,{recursive:true});
function valid(s){const c=new oc.BRepCheck_Analyzer(s.wrapped,true,false);try{return c.IsValid();}finally{c.delete();}}
function volume(s){const properties=new oc.GProp_GProps();try{oc.BRepGProp.VolumeProperties(s.wrapped,properties,1e-10,true,false);return properties.Mass();}finally{properties.delete();}}
const expected=volume(base),epsilon=expected*1e-8;
// Reproduce the former failure without touching the cached document shape.
const independent=R.deserializeShape(snapshot).asShape3D(),plane=new R.Plane([p.offset,0,0],[0,0,-1],[1,0,0]),raw=independent.split(plane);
assert(valid(raw.positive));const simplified=raw.positive.simplify();assert(!valid(simplified),'old unconditional simplify corrupts the supplied split');simplified.delete();raw.positive.delete();raw.negative.delete();raw.on?.delete();independent.delete();plane.delete();
for(const [axis,offset]of [['YZ',p.offset],['XZ',12.345],['XY',7.5]]){
 const splitSpec={...p,plane:axis,offset};if(axis!=='YZ')delete splitSpec.splitFrame;
 const both=runOperation(features,{...splitSpec,keep:'both'}),parts=both.outputs.map(o=>R.deserializeShape(o.brep).asShape3D());
 try{
  assert.equal(both.outputs.length,2);assert.deepEqual(both.remove,[]);assert(Math.abs(parts.reduce((v,s)=>v+volume(s),0)-expected)<epsilon);
  for(const [i,s]of parts.entries()){assert(valid(s));assert(solidMeshComplete(s));const audit=inspectCadStl(both.outputs[i]);assert(audit.report.ok,JSON.stringify(audit.report.issues));}
  if(axis==='YZ'){
   const counts=parts.map(s=>{const solids=s.solids;try{return solids.length;}finally{solids.forEach(s=>s.delete());}});assert.deepEqual(counts,[2,1],'all disconnected pieces on the retained side survive');
   for(const [keep,i]of [['positive',1],['negative',0]]){const result=runOperation(features,{...splitSpec,keep}),shape=R.deserializeShape(result.outputs[0].brep).asShape3D();try{assert.equal(result.outputs.length,1);assert.equal(result.outputs[0].id,p.target);assert(Math.abs(volume(shape)-volume(parts[i]))<epsilon);assert(valid(shape));assert(inspectCadStl(result.outputs[0]).report.ok);}finally{shape.delete();}}
   const resultFeature={kind:'cadop',id:p.id,name:'断面で分離',spec:{...splitSpec,keep:'both'},...both},saved=[...features,resultFeature];
   const replayed=kernelBodies(saved);try{assert.equal(replayed.size,2);assert(Math.abs([...replayed.values()].reduce((v,s)=>v+volume(s),0)-expected)<epsilon);}finally{replayed.forEach(s=>s.delete());}
   await fs.writeFile(out+'/split.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:saved}));
  }
  rows.push({plane:axis,offset,volume:parts.reduce((v,s)=>v+volume(s),0),valid:true,closedStl:true});
 }finally{parts.forEach(s=>s.delete());}
 assert.equal(base.serialize(),snapshot,'successful split leaves cached source geometry and triangulations unchanged');
}
assert.throws(()=>splitSolidSections(base,'YZ',500),/横切/);assert.equal(base.serialize(),snapshot,'rejected split leaves source unchanged');
const repeated=runOperation(features,p);assert.equal(repeated.outputs.length,1);assert.equal(base.serialize(),snapshot,'repeated use of the same cached source remains safe');
bodies.forEach(s=>s.delete());
const proof={pass:true,originalFailure:true,oldSimplifyFailureReproduced:true,volumePreserved:true,allSideModes:true,disconnectedPiecesPreserved:true,sourceUnchanged:true,repeatedSplit:true,closedStl:true,reload:true,rows};await fs.writeFile(out+'/proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
