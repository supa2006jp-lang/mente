import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {offsetPlanePlacement,offsetPlaneFeature,offsetPlaneGridFace} from '../src/offset-plane.js';
import {scopedFaceGrid,faceGridBounds} from '../src/face-grid.js';
import {faceGridCellRegions} from '../src/grid-cell.js';
import {basisFor,worldPoint,validateFrame} from '../src/frames.js';
import {validateFeature,validateProject,defaults,makeGeometry} from '../src/geometry.js';
import {encodeProjectDocument,decodeProjectDocument} from '../src/project-codec.js';

const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('construction grids stay inside the displayed plane after translation and tilt',()=>{
 for(const plane of ['XY','XZ','YZ']){
  const feature=offsetPlaneFeature('plane',offsetPlanePlacement({plane,offset:20},10,[35,15,20],new THREE.Vector3(125,75,35))),original=JSON.stringify(feature),face=offsetPlaneGridFace(feature),b=basisFor(feature),center=new THREE.Vector3(...feature.anchor),bounds=faceGridBounds(face,'face'),grid=scopedFaceGrid(face,'face',10).grid;
  close(bounds.u[0],center.dot(b.u)-60);close(bounds.u[1],center.dot(b.u)+60);close(bounds.v[0],center.dot(b.v)-60);close(bounds.v[1],center.dot(b.v)+60);
  const p=grid.geometry.attributes.position;for(let i=0;i<p.count;i++){const world=worldPoint(face,[p.getX(i),p.getZ(i)]),relative=world.sub(center);assert.ok(Math.abs(relative.dot(b.u))<=60.0001);assert.ok(Math.abs(relative.dot(b.v))<=60.0001);close(relative.dot(b.n),0);}
  assert.equal(faceGridCellRegions(face,[bounds.u[1]+20,bounds.v[1]+20],10).length,0);assert.equal(JSON.stringify(feature),original);grid.geometry.dispose();grid.material.dispose();
 }
 const old=offsetPlaneGridFace({kind:'plane',id:'old',plane:'XY',offset:10});assert.deepEqual(faceGridBounds(old,'face'),{u:[-60,60],v:[-60,60]});
});
test('zero angles preserve the old offset for every principal plane and negative distances',()=>{
 for(const plane of ['XY','XZ','YZ'])for(const distance of [-12,0,25]){
  const source={plane,offset:20},state=offsetPlanePlacement(source,distance),basis=basisFor(source);
  close(state.offset,20+distance);state.frame.u.forEach((value,i)=>close(value,basis.u.toArray()[i]));
  close(state.origin.dot(basis.n),20+distance);validateFrame(state.frame);
 }
});
test('tilting rotates about the chosen face centre and recomputes the plane equation',()=>{
 const source={plane:'XY',offset:20},center=new THREE.Vector3(100,60,20),state=offsetPlanePlacement(source,10,[45,0,0],center);
 assert.deepEqual(state.origin.toArray(),[100,60,30]);close(state.frame.n[1],-Math.SQRT1_2);close(state.frame.n[2],Math.SQRT1_2);
 close(state.offset,-30*Math.SQRT1_2);validateFrame(state.frame);
 for(const p of [[0,0],[12,-4],[-20,30]])close(worldPoint({frame:state.frame,offset:state.offset},p).dot(new THREE.Vector3(...state.frame.n)),state.offset);
});
test('combined rotations and custom source planes keep a right-handed orthonormal frame',()=>{
 const first=offsetPlanePlacement({plane:'YZ',offset:40},-8,[25,-35,65],new THREE.Vector3(40,20,50));
 const feature=offsetPlaneFeature('plane1',first),next=offsetPlanePlacement(feature,12,[35,20,-80]);
 validateFrame(next.frame);close(next.origin.clone().sub(first.origin).dot(new THREE.Vector3(...first.frame.n)),12);
 validateFeature(feature);validateFeature(offsetPlaneFeature('plane2',next));
 const geometry=makeGeometry({...defaults,id:'extrusion',plane:'CUSTOM',frame:next.frame,x:next.origin.x,y:next.origin.y,z:next.origin.z,depth:5});
 try{const positions=geometry.attributes.position,normal=new THREE.Vector3(...next.frame.n),levels=[];for(let i=0;i<positions.count;i++)levels.push(new THREE.Vector3().fromBufferAttribute(positions,i).dot(normal));assert.ok(Math.abs(Math.min(...levels)-next.offset)<1e-4);assert.ok(Math.abs(Math.max(...levels)-next.offset-5)<1e-4);}finally{geometry.dispose();}
});
test('tilted plane and centre survive ordinary and lightweight saves',async()=>{
 const feature=offsetPlaneFeature('plane',offsetPlanePlacement({plane:'XY',offset:20},10,[45,15,0],new THREE.Vector3(100,60,20)));
 const project={format:'forma-cad',version:1,units:'mm',features:[feature]};
 for(const compress of [false,true]){const restored=(await decodeProjectDocument((await encodeProjectDocument(project,{compress})).text)).document;assert.deepEqual(restored,project);validateProject(restored);}
});
test('invalid dimensions, angles, base planes and saved centres fail explicitly',()=>{
 const source={plane:'XY',offset:0};
 for(const distance of [NaN,Infinity,10001])assert.throws(()=>offsetPlanePlacement(source,distance),/距離/);
 for(const angles of [[0,NaN,0],[0,0,361],[0,0]])assert.throws(()=>offsetPlanePlacement(source,10,angles),/角度/);
 assert.throws(()=>offsetPlanePlacement(null,10),/平面/);assert.throws(()=>offsetPlanePlacement({...source,offset:NaN},10),/位置/);
 const feature=offsetPlaneFeature('plane',offsetPlanePlacement(source,10));
 for(const anchor of [[0,0,0],[0,0],[NaN,0,10]])assert.throws(()=>validateFeature({...feature,anchor}),/中心位置/);
});
