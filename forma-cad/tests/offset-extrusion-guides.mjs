import assert from 'node:assert/strict';
import * as THREE from 'three';
import {basisFor} from '../src/frames.js';
import {offsetExtrusionOutlinePaths} from '../src/offset-extrusion-preview.js';
import {offsetDragNormal,offsetDragValue} from '../src/offset-extrusion-guides.js';
const ring=[[-20,-10],[20,-10],[20,10],[-20,10]];
for(const plane of ['XY','XZ','YZ','CUSTOM'])for(const reverse of [false,true]){
 const region={id:'r',plane,offset:7,outer:reverse?[...ring].reverse():ring,holes:[],...(plane==='CUSTOM'?{frame:{u:[Math.SQRT1_2,0,-Math.SQRT1_2],v:[0,1,0],n:[Math.SQRT1_2,0,Math.SQRT1_2]}}:{})};
 const result=offsetExtrusionOutlinePaths([region],-2);assert.equal(result.dimensions[0].text,'36 × 16 mm');
 const guide=result.guides[0],basis=basisFor(region);
 for(let segment=0;segment<guide.points.length;segment++){
  const normal=offsetDragNormal(guide,segment),mid=new THREE.Vector3(...guide.world[segment]).add(new THREE.Vector3(...guide.world[(segment+1)%guide.world.length])).multiplyScalar(.5);
  assert(Math.abs(normal.length()-1)<1e-8);assert(Math.abs(normal.dot(basis.n))<1e-8);assert(normal.dot(mid)>0,'normal always points outwards');
  assert(Math.abs(offsetDragValue(-2,normal.dot(normal.clone().multiplyScalar(3)))-1)<1e-8);assert.equal(offsetDragValue(-2,3,true),-1.7);
 }
}
const circle=Array.from({length:96},(_,i)=>[10*Math.cos(i*Math.PI/48),10*Math.sin(i*Math.PI/48)]),region={id:'circle',plane:'XY',offset:0,outer:circle,holes:[]};
const result=offsetExtrusionOutlinePaths([region],-2);assert.equal(result.dimensions[0].text,'⌀16 mm');assert(Math.abs(result.dimensions[0].diameter-16)<1e-8);
assert.equal(offsetDragValue(9999,5),10000);assert.equal(offsetDragValue(-9999,-5),-10000);
assert.equal(offsetExtrusionOutlinePaths([{...region,outer:ring},{...region,id:'two',outer:ring.map(([x,y])=>[x+80,y])}],1).dimensions.length,2);
console.log('PASS OS dimensions, exact circular diameter, multiple profiles, drag winding and normal on all planes, fine adjustment and limits');
