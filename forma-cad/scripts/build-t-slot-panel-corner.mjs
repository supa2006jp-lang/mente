import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {unzipSync,zipSync} from 'three/addons/libs/fflate.module.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runOperation} from '../src/kernel.js';
import {createPreciseStl} from '../src/stl-export-mesh.js';
import {allThreadPullSpec} from '../src/thread-pull-spec.js';

// Regenerate the print mesh and the native stock from the very same threaded solid.
// The original stock is retained so an existing assembly can still be reprinted.
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const stockPath='src/t-slot-fixtures.json',packPath='assets/t-slot-m8.dat';
const stock=JSON.parse(await fs.readFile(stockPath,'utf8')),archive=unzipSync(await fs.readFile(packPath));
const corner=R.deserializeShape(stock.corner).asShape3D(),owned=[corner];
const keep=shape=>(owned.push(shape),shape);
try{
  // The panel sits on z=0. Thicken only the back of the 3.6 mm triangular web.
  const depth=8,center=[14,14],radius=4;
  const boss=keep(R.makeCylinder(6.5,depth-3.4,[...center,3.4]));
  const thickened=keep(corner.fuse(boss));
  const tool=keep(R.makeCylinder(radius,depth+2,[...center,-1]));
  const bored=keep(thickened.cut(tool));
  const id='corner-panel',body={id,brep:bored.serialize(),...cadMesh(bored)};
  const spec=allThreadPullSpec({type:'thread',target:id,profile:'metric60',threadVersion:2,modeled:true,
    designation:'M8 × 1.25',pitch:1.25,leftHand:false,fullLength:true,surfacePoint:[center[0]+radius,center[1],5]},-.2);
  const {outputs}=runOperation([{kind:'cadop',id,name:id,outputs:[body],remove:[]}],spec);
  if(!outputs[0].threadSource?.spec.threadInternal)throw Error('Expected an internal M8 thread');
  const threaded=keep(R.deserializeShape(outputs[0].brep).asShape3D());
  // A tapered lead-in on the panel face starts the screw without changing the flat seat.
  const chamfer=keep(R.draw([0,-.05]).lineTo([4.75,-.05]).lineTo([3.35,1.35]).lineTo([0,1.35])
    .close().sketchOnPlane(new R.Plane([0,0,0],[1,0,0],[0,-1,0])).revolve([0,0,1]));
  const placed=keep(chamfer.translate([...center,0])),result=keep(threaded.cut(placed));
  const brep=result.serialize(),stl=await createPreciseStl([{id,brep}],(history,operation)=>runOperation(history,operation));
  const solids=result.solids;
  try{if(solids.length!==1)throw Error('Expected one solid');}finally{solids.forEach(s=>s.delete());}
  stock[id]=brep;
  archive[id+'.stl']=new Uint8Array(stl.buffer,stl.byteOffset,stl.byteLength);
  const packed=zipSync(archive,{level:6,mtime:new Date(2020,0,1)});
  await fs.writeFile(stockPath,JSON.stringify(stock)+'\n');
  await fs.writeFile(packPath,packed);
  console.log('Panel bracket: '+stl.getUint32(80,true)+' print triangles; '+brep.length+' BREP characters.');
}finally{owned.reverse().forEach(shape=>shape.delete());}
