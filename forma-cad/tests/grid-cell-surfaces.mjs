import init from '../node_modules/replicad-opencascadejs/dist/replicad_single.js';
import * as R from 'replicad';import * as THREE from 'three';import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {runOperation,kernelBodies} from '../src/kernel.js';import {defaults,rebuild,volume} from '../src/geometry.js';
import {faceGridCellRegions} from '../src/grid-cell.js';import {gridCellOccluders} from '../src/grid-cell-occlusion.js';import {solidMeshComplete} from '../src/solid-mesh.js';
R.setOC(await init({wasmBinary:await fs.readFile('node_modules/replicad-opencascadejs/dist/replicad_single.wasm')}));
const triangleArea=mesh=>{let area=0;for(let i=0;i<mesh.triangles.length;i+=3){const [a,b,c]=mesh.triangles.slice(i,i+3).map(j=>new THREE.Vector3().fromArray(mesh.vertices,j*3));area+=b.sub(a).cross(c.sub(a)).length()/2;}return area;};
for(const frame of [undefined,{u:[1,0,0],v:[0,0,1],n:[0,-1,0]}]){
 const region=(outer,offset=20)=>({plane:frame?'CUSTOM':'XY',frame,offset,outer,holes:[],area:1,sourceIds:[]}),extrusion=(id,r,depth=5)=>({...defaults,id,plane:r.plane,frame,kind:'extrusion',profile:'region',region:r,depth,operation:'join',target:'base'});
 const base={...defaults,id:'base',plane:frame?'CUSTOM':'XY',frame,width:80,height:60,depth:20};
 const slope=.81234,intercept=-.00001,ridge=extrusion('ridge',region([[-35,-35*slope+intercept],[35,35*slope+intercept],[35,35*slope+intercept+3],[-35,-35*slope+intercept+3]]));
 let history=[base,...runOperation([base],{type:'extrusionBatch',features:[ridge]}).features];
 const n=new THREE.Vector3(...(frame?.n||[0,0,1])),camera=new THREE.OrthographicCamera(-100,100,100,-100,.1,1000);camera.position.copy(n).multiplyScalar(100);camera.up.fromArray(frame?.v||[0,1,0]);camera.lookAt(n.clone().multiplyScalar(20));camera.updateMatrixWorld();
 let small=false;
 for(const [i,point] of [[5,5],[15,15],[25,25],[5,15],[15,5]].entries()){
  const bodies=rebuild(history),mesh=bodies.get('base');mesh.visible=true;mesh.userData.bodyId='base';
  const face=region([[-40,-30],[40,-30],[40,30],[-40,30]]),cells=faceGridCellRegions(face,point,10,{occluders:gridCellOccluders(face,point,10,[mesh],camera)});
  for(const body of bodies.values())body.geometry.dispose();assert.ok(cells.length);const cell=cells[0];small||=cell.area<20;
  const prior=kernelBodies(history);let before;try{before=R.measureVolume(prior.get('base'));}finally{for(const body of prior.values())body.delete();}
  const f=extrusion('cell'+i,cell),added=runOperation(history,{type:'extrusionBatch',features:[f]}).features,output=added[0].cadResult.outputs[0],shape=R.deserializeShape(output.brep).asShape3D();
  try{const check=new (R.getOC().BRepCheck_Analyzer)(shape.wrapped,true,false);try{assert.equal(check.IsValid(),true);}finally{check.delete();}
   assert.ok(Math.abs(R.measureVolume(shape)-(before+cell.area*5))<.01,'only the clipped triangular cell is added');
   assert.ok(Math.abs(triangleArea(output)-R.measureArea(shape))<.05,'all original and new surfaces remain triangulated');
   const restored=shape.mesh({tolerance:.08,angularTolerance:.15});assert.equal(solidMeshComplete(shape,restored),true,'saved CAD geometry can be remeshed without missing faces');
   const damaged=structuredClone(restored);damaged.faceGroups[0].count=0;assert.equal(solidMeshComplete(shape,damaged),false,'a missing face is rejected');
  }finally{shape.delete();}
  const original=kernelBodies(history);try{assert.ok(Math.abs(R.measureVolume(original.get('base'))-before)<1e-6,'fuse attempts do not mutate the cached original body');}finally{for(const body of original.values())body.delete();}
  history.push(...added);const saved=JSON.parse(JSON.stringify(history)),rendered=rebuild(saved).get('base');assert.ok(Math.abs(volume(rendered.geometry)-(before+cell.area*5))<.01);rendered.geometry.dispose();
 }
 assert.equal(small,true,'a small remaining triangle is exercised');
}
const cylinder=R.makeCylinder(30,40);try{assert.equal(solidMeshComplete(cylinder),true,'curved boundaries retain the intended mesh approximation');}finally{cylinder.delete();}
console.log('PASS clipped diagonal and small triangular grid extrusions, all-face coverage, exact/rendered volume, side frame, cache isolation, save/remesh and missing-face rejection');
