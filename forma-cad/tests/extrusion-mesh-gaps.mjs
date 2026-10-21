import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as R from 'replicad';
import * as THREE from 'three';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import {defaults,rebuild} from '../src/geometry.js';
import {runOperation} from '../src/kernel.js';
import {planarFace} from '../src/frames.js';
import {cadPosition} from '../src/cad-coordinates.js';
import {repairStraightPlanarMesh} from '../src/planar-mesh-repair.js';
import {cadMesh} from '../src/cad-mesh.js';
import {solidMeshComplete} from '../src/solid-mesh.js';

R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/extrusion-mesh-gaps/';await fs.mkdir(dir,{recursive:true});
function metrics(output){
 const p=output.vertices,t=output.triangles;let area=0,volume=0;
 for(let i=0;i<t.length;i+=3){const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3(...p.slice(t[i+j]*3,t[i+j]*3+3)));area+=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;volume+=a.dot(b.clone().cross(c))/6;}
 const shape=R.deserializeShape(output.brep).asShape3D();try{const exactArea=R.measureArea(shape),exactVolume=R.measureVolume(shape);assert(Math.abs(area-exactArea)<.001,'render surface matches exact surface without missing caps');assert(Math.abs(volume-exactVolume)<.001,'render volume matches exact volume');return {area,volume,exactArea,exactVolume};}finally{shape.delete();}
}
function regionAt(features,normal,point){
 const mesh=rebuild(features).get('mirror').geometry,p=cadPosition(mesh),ix=mesh.index,n=new THREE.Vector3(...normal);let triangle;
 try{
  for(let i=0;i<ix.count;i+=3){const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+j)));if(b.clone().sub(a).cross(c.clone().sub(a)).normalize().dot(n)>.999999&&Math.abs(n.dot(a)-n.dot(new THREE.Vector3(...point)))<1e-5){triangle=i/3;break;}}
  assert.notEqual(triangle,undefined);const region=planarFace(mesh,triangle);return {...region,bodyId:'mirror',cadFace:{bodyId:'mirror',point,normal}};
 }finally{mesh.dispose();}
}
const outer=Array.from({length:6},(_,i)=>[20*Math.cos((i*60-90)*Math.PI/180),20*Math.sin((i*60-90)*Math.PI/180)]),features=[{...defaults,id:'seed',kind:'extrusion',profile:'region',name:'六角形',depth:12.020725388601036,region:{id:'hexagon',plane:'XY',offset:0,outer,holes:[],area:600*Math.sqrt(3),sourceIds:[]}}];
for(const spec of [{type:'mirror',id:'mirror',target:'seed',mirrorMode:'コピー',plane:'FACE',mirrorNormal:[1,0,0],mirrorOrigin:[Math.fround(10*Math.sqrt(3)),0,0]},{type:'join',id:'join',target:'mirror',others:['seed'],combineMode:'結合'}])features.push({kind:'cadop',id:spec.id,name:spec.id,spec,...runOperation(features,spec)});
function feature(id,normal,point,depth){const region=regionAt(features,normal,point);return {...defaults,id,name:'押し出し',kind:'extrusion',profile:'region',operation:'join',target:'mirror',targetAllBodies:true,joinSourceContacts:true,plane:region.plane,frame:region.frame,region,depth};}
for(const f of [feature('raise',[0,0,1],[35,0,12.020725388601036],20)])features.push(...runOperation(features,{type:'extrusionBatch',features:[f]}).features);
const right=feature('right',[-.5,-Math.sqrt(3)/2,0],[25,-25/Math.sqrt(3),16],12.553442728291433);features.push(...runOperation(features,{type:'extrusionBatch',features:[right]}).features);
const last=feature('last',[.5,-Math.sqrt(3)/2,0],[5,-20+5/Math.sqrt(3),16],38.36489004418456),proof=[];
for(const round of [0,1])for(const depth of [1,5,10,20,30,35,38,38.36489004418456,40]){
 const f={...last,depth};runOperation(features,{type:'extrusionJoinInspect',features:[f]});runOperation(features,{type:'extrusionToolPreview',feature:f});const result=runOperation(features,{type:'extrusionBatch',features:[f]}),output=result.features[0].cadResult.outputs[0];proof.push({round,depth,...metrics(output)});
 if(round===1&&depth===38.36489004418456)await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,units:'mm',features:[...features,...result.features]}));
}
// A polygonal annulus is a real opening and must survive the repair path.
const box=R.makeBox([0,0,0],[30,30,10]),hole=R.makeBox([10,10,-1],[20,20,11]),ring=box.cut(hole),ringMesh=cadMesh(ring),repaired=repairStraightPlanarMesh(ring,ringMesh);assert(solidMeshComplete(ring,repaired));metrics({...repaired,brep:ring.serialize()});assert(Math.abs(R.measureVolume(ring)-8000)<1e-6);box.delete();hole.delete();ring.delete();
await fs.writeFile(dir+'kernel-proof.json',JSON.stringify({proof,realOpeningPreserved:true},null,2));console.log('PASS repeated mirror-side extrusions: checked cap areas and volume at 18 drag distances; real openings preserved');
