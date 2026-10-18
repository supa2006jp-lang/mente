import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {filletSolid,planPartialFillet,resolveFilletEdges} from '../src/solid-fillet.js';

const oc=await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')});R.setOC(oc);
const outside=R.drawRoundedRectangle(120,45,22.5).sketchOnPlane('XY').extrude(50),shell=outside.shell(2,f=>f.inPlane('XY',50));
const volume=R.measureVolume(shell),area=R.measureArea(shell),bounds=shell.boundingBox;
const originalBounds=bounds.bounds;bounds.delete();
const topology=shape=>{const edges=shape.edges,faces=shape.faces;try{return [edges.length,faces.length];}finally{[...edges,...faces].forEach(item=>item.delete());}};
const originalTopology=topology(shell),counts={},constructors={};
for(const name of ['BRepCheck_Analyzer','ShapeUpgrade_UnifySameDomain','BRepFilletAPI_MakeFillet']){
 constructors[name]=oc[name];oc[name]=new Proxy(oc[name],{construct(target,args){counts[name]=(counts[name]||0)+1;return Reflect.construct(target,args);}});
}
try{
 const started=performance.now(),result=planPartialFillet(shell,2),ms=performance.now()-started;
 try{
  assert.equal(result.partial.accepted,12);assert.equal(result.partial.skipped,12);assert.equal(result.partial.untested,0);
  assert.equal(result.partial.attempts,6,'four tangent contours must not become 24 independent edge trials');
  assert.equal(counts.ShapeUpgrade_UnifySameDomain,1,'same-domain normalization is reused for the whole inspection');
  assert.ok(counts.BRepCheck_Analyzer<=6,'input validity is not rechecked for each subset');
  assert.ok(counts.BRepFilletAPI_MakeFillet<=15,'native builders are bounded by contours, not display arc fragments');
  assert.equal(result.radius,2);assert.equal(result.references.length,12);
  const replay=filletSolid(shell,2,{references:result.references}),check=new oc.BRepCheck_Analyzer(result.shape.wrapped,true,false);
  try{assert.ok(check.IsValid());assert.ok(Math.abs(R.measureVolume(replay.shape)-R.measureVolume(result.shape))<1e-6);assert.ok(R.measureVolume(result.shape)<volume);}
  finally{replay.shape.delete();check.delete();}
  console.log(JSON.stringify({fixture:'arc-and-line thin shell',milliseconds:Math.round(ms),attempts:result.partial.attempts,accepted:12,skipped:12}));
 }finally{result.shape.delete();}
 // A soft time limit is checked between synchronous native trials. Unchecked
 // contours remain untouched and are not misreported as geometrically invalid.
 let elapsed=0;
 const limited=planPartialFillet(shell,2,{},progress=>{if(progress.current)elapsed=100;},{maxDurationMs:10,now:()=>elapsed});
 try{assert.equal(limited.partial.limitReason,'time');assert.equal(limited.partial.attempts,1);assert.ok(limited.partial.untested>0);assert.equal(limited.partial.accepted+limited.partial.skipped+limited.partial.untested,24);}
 finally{limited.shape.delete();}
 const edges=resolveFilletEdges(shell,{plane:{normal:[0,0,1],offset:50}});
 // Explicit tangent arc selection is still matched exactly and replayable.
 try{
  const e=edges.find(edge=>edge.geomType!=='LINE'),p=e.pointAt(.5);let point;
  try{point=p.toTuple();}finally{p.delete();}
  const single=planPartialFillet(shell,2,{references:[{point}]});
  try{assert.equal(single.partial.accepted,0);assert.equal(single.partial.skipped,1);assert.equal(single.partial.attempts,0,'a failed native contour is not retried as its constituent tangent edges');}
  finally{single.shape.delete();}
 }finally{edges.forEach(e=>e.delete());}
 const complete=planPartialFillet(shell,.4);
 try{assert.equal(complete.partial,undefined);assert.equal(complete.radius,.4);assert.equal(complete.edgeCount,24);}
 finally{complete.shape.delete();}
 // OCCT may append cached surface curves to the in-memory source during a
 // blend (also true before this optimization). Its geometry stays unchanged.
 assert.equal(R.measureVolume(shell),volume);assert.equal(R.measureArea(shell),area);
 const afterBounds=shell.boundingBox;try{assert.deepEqual(afterBounds.bounds,originalBounds);}finally{afterBounds.delete();}
 assert.deepEqual(topology(shell),originalTopology);
 console.log('PASS tangent contour inspection, one-time normalization/validation, exact replay, time budget, explicit arc and complete-success path');
}finally{for(const [name,ctor]of Object.entries(constructors))oc[name]=ctor;shell.delete();outside.delete();}
