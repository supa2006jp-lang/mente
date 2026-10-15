import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import {fuseSolids} from '../src/solid-fuse.js';
import {filletSolid,resolveFilletEdges} from '../src/solid-fillet.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const epsilon=5.35917e-7,cap=R.makeBox([0,-19,70],[20,0,74]),plate=R.makeBox([-epsilon,0,0],[20-epsilon,4,74]),body=fuseSolids([cap,plate]),bounds=body.boundingBox.bounds,area=R.measureArea(body),volume=R.measureVolume(body),references=[{a:[0,0,70],point:[10,0,70],b:[20,0,70]}];
function watertight(shape){
 const mesh=shape.mesh({tolerance:.08,angularTolerance:.15}),edges=new Map(),key=index=>mesh.vertices.slice(index*3,index*3+3).map(value=>Math.round(value*1e5)).join(',');
 for(let i=0;i<mesh.triangles.length;i+=3){const points=mesh.triangles.slice(i,i+3).map(key);if(new Set(points).size<3)continue;for(let j=0;j<3;j++){const edge=[points[j],points[(j+1)%3]].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);}}
 assert.ok(edges.size);for(const count of edges.values())assert.equal(count,2,'every welded mesh edge must have two adjacent triangles');
}
try{
 const edges=resolveFilletEdges(body,{references});try{assert.equal(edges.length,1,'one displayed edge must not create an extra microscopic contour');}finally{edges.forEach(e=>e.delete());}
 for(const radius of [.2,2]){
  const result=filletSolid(body,radius,{references}),check=new (R.getOC().BRepCheck_Analyzer)(result.shape.wrapped,true,false),solids=result.shape.solids;
  try{assert.ok(check.IsValid());assert.equal(solids.length,1);assert.equal(result.radius,radius);watertight(result.shape);const expectedGain=(20-epsilon)*radius**2*(1-Math.PI/4);assert.ok(Math.abs(R.measureVolume(result.shape)-volume-expectedGain)<1e-5,'blend must use the requested radius');}
  finally{solids.forEach(s=>s.delete());check.delete();result.shape.delete();}
 }
 const tinyReferences=[{a:[20-epsilon,0,70],point:[20-epsilon/2,0,70],b:[20,0,70]}],tiny=resolveFilletEdges(body,{references:tinyReferences});try{assert.equal(tiny.length,1,'explicit tiny selections are not silently discarded');}finally{tiny.forEach(e=>e.delete());}
 assert.equal(R.measureVolume(body),volume,'rounding preserves the source volume');assert.equal(R.measureArea(body),area);assert.deepEqual(body.boundingBox.bounds,bounds);
 console.log('PASS microscopic boolean tail, exact requested radii, one valid watertight solid and input preservation');
}finally{body.delete();cap.delete();plate.delete();}
