import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,rebuild} from '../src/geometry.js';
import {bodyEdges} from '../src/body-edges.js';
import {solidReferencePoints} from '../src/reference-points.js';
import {runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
for(const [diameter,depth,pitch] of [[10,20,1.5],[10,30,1.5],[10,40,1.5],[20,30,3]]){
 const cylinder={...defaults,id:'c',profile:'circle',diameter,depth,x:20,y:20};
 const spec={type:'thread',target:'c',profile:'metric60',threadVersion:2,pitch,fullLength:true,surfacePoint:[20+diameter/2,20,depth*.7]};
 const output=runOperation([cylinder],spec).outputs[0],shape=R.deserializeShape(output.brep).asShape3D();
 const solids=shape.solids,faces=shape.faces;
 try{assert.equal(solids.length,1,'The ridge must be fused to the core');assert.ok(faces.some(f=>f.geomType==='BSPLINE_SURFACE'),'Helical faces must survive');}
 finally{[...solids,...faces].forEach(item=>item.delete());}
 const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);
 try{assert.ok(check.IsValid(),'Batched thread must remain a valid solid');}finally{check.delete();}
 const radius=diameter/2,root=radius-pitch*.561266,bands=[[],[],[]];
 for(let i=0;i<output.vertices.length;i+=3){
  const r=Math.hypot(output.vertices[i]-20,output.vertices[i+1]-20),z=output.vertices[i+2];
  assert.ok(r<=radius+.0002,'The thread must remain within nominal diameter');
  assert.ok(r>=root-.0002,'Buried ridge faces must not remain exposed');
  bands[Math.max(0,Math.min(2,Math.floor(z/depth*3)))].push(r);
 }
 for(const band of bands)assert.ok(Math.max(...band)>radius-.001,'Each third of the cylinder must have thread crests');
 if(diameter===10&&depth===40){
  const bodies=rebuild([cylinder,{kind:'cadop',id:'thread',spec,outputs:[output],remove:[]}]),geometry=bodies.get('c').geometry,edges=bodyEdges(geometry),refs=solidReferencePoints(geometry,edges);
  assert.ok(refs.length<20,'M10 x 40 must not produce thousands of fake helix center markers');
  assert.ok(refs.filter(ref=>ref.name==='円・円弧').every(ref=>Math.hypot(ref.point[0]-20,ref.point[1]-20)<.01),'Only real axial circle centers may be exposed');
  edges.dispose();for(const mesh of bodies.values())mesh.geometry.dispose();
 }
 shape.delete();
 console.log('PASS male thread',diameter,depth,pitch);
}
