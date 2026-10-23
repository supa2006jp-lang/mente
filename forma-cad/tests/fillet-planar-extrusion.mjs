import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';
import * as THREE from 'three';
import {defaults,validateProject} from '../src/geometry.js';
import {planarFace} from '../src/frames.js';
import {cadMesh} from '../src/cad-mesh.js';
import {selectedProfilePlanarFaces,selectedConnectedPlanarFace} from '../src/cad-planar-face.js';
import {filletSolid} from '../src/solid-fillet.js';
import {kernelBodies,runOperation} from '../src/kernel.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const dir='outputs/fillet-planar-extrusion/';await fs.mkdir(dir,{recursive:true});
const tuple=v=>{try{return v.toTuple();}finally{v.delete();}},near=(a,b,tolerance=1e-5)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
let selections=0,operations=0;
function valid(shape){const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false),parts=shape.solids;try{assert.ok(check.IsValid());assert.equal(parts.length,1);}finally{check.delete();parts.forEach(p=>p.delete());}}
async function exercise(shape,{name,allFaces=true}){
 const mesh=cadMesh(shape),g=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float64Array(mesh.vertices),3));g.setIndex(mesh.triangles);
 const faces=shape.faces;const original={kind:'cadop',id:'seed',name,outputs:[{id:'body',brep:shape.serialize(),...mesh,cadCoordinatePrecision:true,planarFaces:faces.filter(f=>f.geomType==='PLANE').map(f=>f.hashCode)}],remove:[]},history=[original],snapshot=JSON.stringify(history);
 try{for(const face of faces){
  if(face.geomType!=='PLANE')continue;
  const normal=tuple(face.normalAt()),group=mesh.faceGroups.find(group=>group.faceId===face.hashCode),region={...planarFace(g,group.start/3),bodyId:'body'},sample=face.mesh().vertices.slice(0,3),area=R.measureArea(face);
  if(!allFaces&&normal[2]<.999999)continue;
  // At a tangent boundary both native faces have zero distance. Display-mesh
  // rounding must not turn a selected plane into its adjacent fillet surface.
  for(const offset of [0,1e-7,1e-5]){
   const point=sample.map((v,k)=>Math.fround(v+normal[k]*offset)),selected=selectedProfilePlanarFaces(shape,{point,normal},region);
   try{assert.ok(selected.every(f=>f.geomType==='PLANE'));near(selected.reduce((sum,f)=>sum+R.measureArea(f),0),area);selections++;}finally{selected.forEach(f=>f.delete());}
  }
  const point=sample.map(Math.fround),selection={bodyId:'body',point,normal};
  const connected=selectedConnectedPlanarFace(shape,selection);try{near(R.measureArea(connected),area);}finally{connected.delete();}
  for(const operation of ['join','cut','new']){
   const depth=operation==='cut'?-.5:2,feature={...defaults,id:'extrude',kind:'extrusion',name:'平面の加工',profile:'region',region:{...region,cadFace:selection},plane:region.plane,frame:region.frame,depth,operation,target:'body'},result=runOperation(history,{type:'extrusionBatch',features:[feature]}).features[0],output=result.cadResult.outputs[0],modified=R.deserializeShape(output.brep).asShape3D();
   try{valid(modified);const expected=operation==='new'?area*2:R.measureVolume(shape)+area*depth;near(R.measureVolume(modified),expected,1e-4);operations++;}finally{modified.delete();}
   const saved={format:'forma-cad',version:1,features:JSON.parse(JSON.stringify([...history,result]))};validateProject(saved);const loaded=kernelBodies(saved.features);try{valid(loaded.get(operation==='new'?'extrude':'body'));}finally{for(const s of loaded.values())s.delete();}
   assert.equal(JSON.stringify(history),snapshot,'face extrusion preserves the original filleted body and history');
   if(operation==='join'&&allFaces){const proposed=structuredClone(saved.features);proposed.at(-1).depth=3;const replay=runOperation(proposed,{type:'replay',before:saved.features,start:history.length}).features,rebuilt=kernelBodies(replay);try{valid(rebuilt.get('body'));near(R.measureVolume(rebuilt.get('body')),R.measureVolume(shape)+area*3,1e-4);}finally{for(const s of rebuilt.values())s.delete();}}
  }
  assert.throws(()=>selectedProfilePlanarFaces(shape,{point:point.map((v,i)=>v+normal[i]),normal},region),/面/,'a stale reference far from every matching plane is rejected');
 }
 }finally{faces.forEach(f=>f.delete());g.dispose();}
 return original;
}
const box=R.makeBox([0,0,0],[40,30,10]),round=filletSolid(box,2).shape,tilted=round.clone().rotate(37,[0,0,0],[1,2,3]).translate([.123456789,7.654321987,-3.14159265]),hole=R.makeCylinder(3,10,[20,15,0]),hollow=box.cut(hole),holeRound=filletSolid(hollow,1).shape;
try{
 const seed=await exercise(round,{name:'全辺フィレット・直方体'});await exercise(tilted,{name:'回転・移動した全辺フィレット'});await exercise(holeRound,{name:'穴のあるフィレット付き直方体',allFaces:false});
 await fs.writeFile(dir+'fixture.forma.json',JSON.stringify({format:'forma-cad',version:1,features:[seed]}));
 const proof={selections,operations,tangentBoundary:true,displayPrecision:true,allSixSides:true,rotatedAndTranslated:true,nativeAreaAndVolume:true,holesRetained:true,validSingleSolid:true,saveReload:true,historyReplay:true,sourcePreserved:true,staleReferencesRejected:true};await fs.writeFile(dir+'native-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
}finally{for(const shape of [holeRound,hollow,hole,tilted,round,box])shape.delete();}
