import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {unzipSync,zipSync} from 'three/addons/libs/fflate.module.js';
import {cadMesh} from '../src/cad-mesh.js';
import {runInternalThreadShape} from '../src/kernel.js';
import {inspectStlMesh} from '../src/stl-mesh-health.js';
import {framePrintPlates,framePlate3mf,readFrameStock} from '../src/t-slot-frame-print.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const packPath='assets/t-slot-m8.dat',output=process.argv[2],pitch=1.25,inset=.10,height=6.4;
const archive=unzipSync(await fs.readFile(packPath)),parts=[];
if(output)await fs.mkdir(output,{recursive:true});
function draw(points){
  const pen=R.draw(points[0]);
  for(const p of points.slice(1))pen.lineTo(p);
  return pen.close();
}
// Offset the original straight faces along their normals. Intersect adjacent
// offset lines to retain the T shoulders, chamfers and the re-entrant V mark.
function insetOutline(points){
  const lines=points.map(([x,y],i)=>{
    const [u,v]=points[(i+1)%points.length],length=Math.hypot(u-x,v-y);
    const a=(y-v)/length,b=(u-x)/length;return {a,b,c:a*x+b*y+inset};
  });
  return lines.map((next,i)=>{
    const prev=lines[(i+lines.length-1)%lines.length],det=prev.a*next.b-prev.b*next.a;
    return [(prev.c*next.b-prev.b*next.c)/det,(prev.a*next.c-prev.c*next.a)/det];
  });
}
function nut(root,marked){
  const owned=[],keep=shape=>(owned.push(shape),shape);
  try{
    const side=[[-5.05,0],[5.05,0],[6.95,1.9],[6.95,4.8],[5,4.8],[5,height],[-5,height],[-5,4.8],[-6.95,4.8],[-6.95,1.9]];
    const plan=[[-5.55,-10],[5.55,-10],[6.95,-8.6],[6.95,8.6],[5.55,10],...(marked?[[1.3,10],[0,8.7],[-1.3,10]]:[]),[-5.55,10],[-6.95,8.6],[-6.95,-8.6]];
    const sideBlank=keep(draw(insetOutline(side)).sketchOnPlane('XZ',-11).extrude(22));
    const planBlank=keep(draw(insetOutline(plan)).sketchOnPlane('XY',-1).extrude(9));
    const outside=keep(sideBlank.intersect(planBlank));
    // Cut the unpulled M8 thread on its original axial datum before trimming
    // the top and bottom. This preserves its pitch and phase with both bolts.
    const block=keep(R.makeBox([-8,-11,0],[8,11,height])),bore=keep(R.makeCylinder(root,8,[0,0,-.5]));
    const blank=keep(block.cut(bore)),id='stock',body={id,brep:blank.serialize(),...cadMesh(blank)};
    const thread=keep(runInternalThreadShape([{kind:'cadop',id,name:id,outputs:[body],remove:[]}],
      {type:'thread',target:id,surfacePoint:[root,0,3.2],profile:'metric60',threadVersion:2,pitch,fullLength:true}));
    const cropped=keep(thread.intersect(outside));
    // The entrance chamfers keep their previous pull, independently of the thread.
    const entry=root+.25+Math.SQRT2*inset;
    const mouth=keep(draw([[0,-1],[entry,-1],[entry,0],[entry-1.15,1.15],[0,1.15]]).sketchOnPlane('XZ').revolve([0,0,1]));
    const top=keep(mouth.clone().rotate(180,[0,0,0],[1,0,0]).translateZ(height));
    const lowerCut=keep(cropped.cut(mouth)),finished=keep(lowerCut.cut(top));
    return finished.clone().translateZ(-inset);
  }finally{owned.reverse().forEach(shape=>shape.delete());}
}
for(const [kind,root,label] of [['nut',4.18,'標準'],['wideNut',4.28,'広め_V印']]){
  const shape=nut(root,kind==='wideNut');
  try{
    const mesh=await shape.blobSTL({binary:true,tolerance:.009,angularTolerance:.085}).arrayBuffer();
    archive[kind+'.stl']=new Uint8Array(mesh);
    const part={kind,key:kind,count:1};parts.push(part);
    const check=inspectStlMesh(cadMesh(shape),{includeComponents:true});
    assert.ok(check.ok&&check.components.length===1,kind+' must be one solid');
    if(output){
      const step=R.exportSTEP([{name:kind,shape}],{unit:'MM',modelUnit:'MM'});
      await fs.writeFile(path.join(output,'M8_T溝ナット_'+label+'.step'),new Uint8Array(await step.arrayBuffer()));
    }
  }finally{shape.delete();}
}
const packed=zipSync(archive,{level:6,mtime:new Date(2020,0,1)}),stock=readFrameStock(packed);
for(const part of parts){
  const check=inspectStlMesh(stock.mesh(part),{includeComponents:true});
  assert.ok(check.ok&&check.components.length===1&&check.removedDegenerate===0,part.kind+' print mesh');
  const [lo,hi]=check.components[0].bounds;
  [13.7,19.8,6.2].forEach((size,i)=>assert.ok(Math.abs(hi[i]-lo[i]-size)<.0001));
  console.log(part.kind,check.triangles+' triangles',check.volume.toFixed(2)+' mm³');
}
await fs.writeFile(packPath,packed);
if(output){
  const [plate]=framePrintPlates(parts),cache=new Map();
  for(const nozzle of [.4,.6])await fs.writeFile(path.join(output,'M8ナット_標準とV印_'+nozzle+'mm.3mf'),framePlate3mf(plate,stock,cache,nozzle));
}
