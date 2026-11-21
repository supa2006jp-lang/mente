import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {Vector3} from 'three';
import {unzipSync,zipSync} from 'three/addons/libs/fflate.module.js';
import {nominalMaleThread} from '../src/nominal-male-thread.js';
import {framePartBounds,framePartKey} from '../src/t-slot-frame.js';
import {readFrameStock} from '../src/t-slot-frame-print.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const part={kind:'bolt',length:10},stockPath='assets/t-slot-m8.dat';
// Same thread fit, hex head and lead-in as the kit's M8×16. The origin here is the tip.
const radius=3.94,pitch=1.25,headHeight=5.6,hexRadius=13/Math.sqrt(3);
const shapes=[],keep=shape=>(shapes.push(shape),shape);
try{
  const blank=keep(R.makeCylinder(radius,part.length));
  const shaft=keep(nominalMaleThread(blank,{normal:new Vector3(0,0,1),origin:new Vector3(),radius},
    {pitch,leftHand:false},part.length));
  const tip=keep(R.draw([0,-1]).lineTo([3.12,-1]).lineTo([3.12,0]).lineTo([radius+.1,.92])
    .lineTo([radius+.1,part.length+.1]).lineTo([0,part.length+.1]).close().sketchOnPlane('XZ').revolve([0,0,1]));
  const tapered=keep(shaft.intersect(tip));
  const hex=R.draw([hexRadius,0]);
  for(let i=1;i<6;i++)hex.lineTo([hexRadius*Math.cos(i*Math.PI/3),hexRadius*Math.sin(i*Math.PI/3)]);
  const headBlank=keep(hex.close().sketchOnPlane('XY',part.length).extrude(headHeight));
  const head=keep(headBlank.chamfer(.45));
  const printed=keep(tapered.fuse(head).rotate(180,[0,0,0],[1,0,0]).translateZ(part.length+headHeight));
  const archive=unzipSync(await fs.readFile(stockPath));
  const stl=printed.blobSTL({binary:true,tolerance:.009,angularTolerance:.085});
  archive[framePartKey(part)+'.stl']=new Uint8Array(await stl.arrayBuffer());
  const packed=zipSync(archive,{level:6,mtime:new Date(2020,0,1)});
  const health=inspectStlMesh(readFrameStock(packed).mesh(part),{includeComponents:true});
  assert.ok(health.ok&&health.removedDegenerate===0&&health.components.length===1,'Expected one closed print mesh');
  assert.ok(Math.abs(health.volume/R.measureVolume(printed)-1)<.004,'Print mesh volume differs from the solid');
  const bounds=framePartBounds(part);
  for(const [i,point] of health.components[0].bounds.entries())
    point.forEach((value,k)=>assert.ok(Math.abs(value-bounds[i][k])<.0001,'Print bounds differ from plate layout'));
  await fs.writeFile(stockPath,packed);
  console.log('M8×10 print stock: '+health.triangles+' triangles, '+health.volume.toFixed(2)+' mm³');
}finally{shapes.reverse().forEach(shape=>shape.delete());}
