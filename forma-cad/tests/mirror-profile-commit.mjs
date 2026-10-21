import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {runOperation,kernelBodies} from '../src/kernel.js';
import {defaults,rebuild} from '../src/geometry.js';
import {planarFace} from '../src/frames.js';
import {selectedProfilePlanarFaces} from '../src/cad-planar-face.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/mirror-profile-commit/';await fs.mkdir(dir,{recursive:true});
const proof=[];
for(const seam of [0,.000001,.0001,5]){
 const outer=[[seam,0],[seam+10,-6],[seam+20,0],[seam+20,12],[seam+10,18],[seam,12]],features=[{...defaults,kind:'extrusion',profile:'region',id:'right',name:'右半分',depth:10,region:{id:'hexagon',plane:'XY',offset:0,outer,holes:[],area:360,sourceIds:[]}}];
 for(const spec of [{type:'mirror',id:'left',target:'right',plane:'YZ',offset:0,mirrorMode:'複製'},{type:'join',id:'joined',target:'right',others:['left'],combineMode:'結合'}])features.push({kind:'cadop',name:spec.id,id:spec.id,spec,...runOperation(features,spec)});
 const bodies=kernelBodies(features),base=bodies.get('right'),mesh=rebuild(features).get('right').geometry;
 for(const side of [-1,1]){
  let triangle;for(let i=0;i<mesh.index.count;i+=3){const points=[0,1,2].map(j=>mesh.index.getX(i+j)),p=mesh.attributes.position;if(points.every(j=>Math.abs(p.getZ(j)-10)<1e-6)&&points.reduce((s,j)=>s+p.getX(j),0)*side>0){triangle=i/3;break;}}
  const region=planarFace(mesh,triangle),point=[side*(seam+10),5,10];region.bodyId='right';region.cadFace={bodyId:'right',point,normal:[0,0,1]};
  const faces=selectedProfilePlanarFaces(base,region.cadFace,region),area=faces.reduce((s,f)=>s+R.measureArea(f),0);faces.forEach(f=>f.delete());const both=seam<1;
  assert(Math.abs(area-(both?720:360))<1e-6,'all and only faces represented by the displayed profile');
  for(const [operation,depth] of [['join',3],['cut',-2],['new',3]]){
   const feature={...defaults,kind:'extrusion',profile:'region',id:'extrude',name:'全面押し出し',target:'right',operation,depth,region},result=runOperation(features,{type:'extrusionBatch',features:[feature]}),cad=result.features[0].cadResult;
   const output=cad.outputs[0],s=R.deserializeShape(output.brep).asShape3D();try{const expected=(operation==='new'?0:7200)+area*depth;assert(Math.abs(R.measureVolume(s)-expected)<1e-5,operation+' retains the whole preview');}finally{s.delete();}
   if(operation==='join'){const saved=JSON.parse(JSON.stringify([...features,...result.features])),reloaded=kernelBodies(saved);try{assert(Math.abs(R.measureVolume(reloaded.get('right'))-(7200+area*depth))<1e-5);}finally{for(const b of reloaded.values())b.delete();}}
  }
  proof.push({seam,side,selectedArea:area});
 }
 if(seam===.000001)await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features}));
 for(const b of bodies.values())b.delete();mesh.dispose();
}
await fs.writeFile(dir+'kernel-proof.json',JSON.stringify(proof,null,2));console.log('PASS mirror profile commit: native shared and unshared seams, both sides, join/cut/new, save/reload, real gaps excluded');
